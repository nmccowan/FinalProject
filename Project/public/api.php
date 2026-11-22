<?php
// Single entry point: routes by HTTP method, returns JSON, maps errors to status codes.

// Set headers for JSON response and cross-origin flexibility
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

try {
    // 1. Include database connection (provided db.php file)
    require_once __DIR__ . '/db.php';
    require_once __DIR__ . '/Database.php';
    $pdo = (new Database())->connect();

    // 2. Include all model classes
    require_once __DIR__ . '/Student.php';
    require_once __DIR__ . '/Course.php';
    require_once __DIR__ . '/Prerequisite.php';
    require_once __DIR__ . '/Enrollment.php';

    $method = $_SERVER['REQUEST_METHOD'];
    $table = $_GET['table'] ?? '';
    $id = isset($_GET['id']) ? (int)$_GET['id'] : null;
    $isTranscript = isset($_GET['transcript']) && $_GET['transcript'] === 'true';

    // Helper to instantiate the correct class based on the table name
    $getModel = function(string $tableName) use ($pdo) {
        switch ($tableName) {
            case 'students': return new Student($pdo);
            case 'courses': return new Course($pdo);
            case 'prerequisites': return new Prerequisite($pdo);
            case 'enrollments': return new Enrollment($pdo);
            default: throw new Exception("Invalid table specified.", 400);
        }
    };

    // 3. Handle Transcript Request
    if ($isTranscript) {
        $studentId = isset($_GET['student_id']) ? (int)$_GET['student_id'] : 0;
        if ($studentId <= 0) {
            throw new Exception("Valid student ID is required for transcripts.", 400);
        }
        $enrollmentModel = new Enrollment($pdo);
        $courses = $enrollmentModel->getTranscript($studentId);
        echo json_encode(['courses' => $courses]);
        exit();
    }

    if (empty($table)) {
        throw new Exception("No table specified.", 400);
    }

    $model = $getModel($table);
    $input = [];

    if ($method === 'POST' || $method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);

        if (json_last_error() !== JSON_ERROR_NONE || !is_array($input)) {
            throw new Exception("Invalid JSON input.", 400);
        }
    }
    // 4. Route based on HTTP Method
    switch ($method) {
        case 'GET':
            echo json_encode($model->getAll());
            break;
        case 'POST':
            $newId = $model->create($input);
            http_response_code(201);
            echo json_encode(['id' => $newId, 'message' => 'Record created successfully']);
            break;
        case 'PUT':
            if (!$id) throw new Exception("Record ID is required for updates.", 400);
            $model->update($id, $input);
            echo json_encode(['message' => 'Record updated successfully']);
            break;
        case 'DELETE':
            if (!$id) throw new Exception("Record ID is required for deletion.", 400);
            $model->delete($id);
            echo json_encode(['message' => 'Record deleted successfully']);
            break;
        default:
            throw new Exception("Method not allowed.", 405);
    }
} catch (PDOException $e) {
    error_log("Database Error: " . $e->getMessage());

    $sqlState = $e->errorInfo[0] ?? '';

    if ($sqlState === '23505') {
        http_response_code(409);
        echo json_encode(['error' => 'This record already exists.']);
    } elseif ($sqlState === '23503') {
        http_response_code(409);
        echo json_encode(['error' => 'This record is still being used by another record.']);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'A database error occurred. Please try again.']);
    }
} catch (Exception $e) {
    $code = $e->getCode();

    if ($code < 400 || $code > 599) {
        $code = 500;
    }
    http_response_code($code);
    error_log("API Error: " . $e->getMessage());
    echo json_encode(['error' => $e->getMessage()]);
} catch (Throwable $e) {
    error_log("Unexpected API Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'An unexpected server error occurred.']);
}
