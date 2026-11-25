<?php
// Single entry point: routes by resource/action and HTTP method, returns JSON, maps errors to status codes.

header('Content-Type: application/json');
session_set_cookie_params(['httponly' => true, 'samesite' => 'Lax']);
session_start();

function requireLogin(): int {
    if (empty($_SESSION['user_id'])) {
        throw new Exception('Please log in.', 401);
    }
    return (int)$_SESSION['user_id'];
}

try {
    // 1. Include database connection
    require_once __DIR__ . '/../db.php';
    require_once __DIR__ . '/../Database.php';
    $pdo = (new Database())->connect();

    // 2. Include repository classes (assumes Project/src/ is copied to /var/www/src/)
    require_once __DIR__ . '/../src/GenreRepo.php';
    require_once __DIR__ . '/../src/BookRepo.php';
    require_once __DIR__ . '/../src/UserBookRepo.php';
    require_once __DIR__ . '/../src/AuthRepo.php';
    require_once __DIR__ . '/../src/recService.php';

    $method = $_SERVER['REQUEST_METHOD'];
    $resource = $_GET['resource'] ?? ($_GET['table'] ?? ($_GET['action'] ?? ''));
    $id = isset($_GET['id']) ? filter_var($_GET['id'], FILTER_VALIDATE_INT) : null;

    if (isset($_GET['id']) && ($id === false || $id <= 0)) {
        throw new Exception("Invalid record ID.", 400);
    }

    $input = [];
    if ($method === 'POST' || $method === 'PUT') {
        $raw = file_get_contents('php://input');
        if ($raw !== '' && $raw !== false) {
            $input = json_decode($raw, true);
            if (json_last_error() !== JSON_ERROR_NONE || !is_array($input)) {
                throw new Exception("Invalid JSON input.", 400);
            }
        }
    }

    // 3. Auth & Goal actions
    if ($resource === 'register') {
        if ($method !== 'POST') {
            throw new Exception("Method not allowed.", 405);
        }
        $authRepo = new AuthRepo($pdo);
        $user = $authRepo->register($input);
        session_regenerate_id(true);
        $_SESSION['user_id'] = (int)$user['id'];
        http_response_code(201);
        echo json_encode(['user' => $user, 'message' => 'Account created successfully']);
        exit();
    }

    if ($resource === 'login') {
        if ($method !== 'POST') {
            throw new Exception("Method not allowed.", 405);
        }
        $authRepo = new AuthRepo($pdo);
        $user = $authRepo->login($input);
        session_regenerate_id(true);
        $_SESSION['user_id'] = (int)$user['id'];
        echo json_encode(['user' => $user, 'message' => 'Logged in successfully']);
        exit();
    }

    if ($resource === 'logout') {
        if ($method !== 'POST') {
            throw new Exception("Method not allowed.", 405);
        }
        $_SESSION = [];
        session_destroy();
        echo json_encode(['message' => 'Logged out successfully']);
        exit();
    }

    if ($resource === 'me') {
        if ($method !== 'GET') {
            throw new Exception("Method not allowed.", 405);
        }
        if (empty($_SESSION['user_id'])) {
            echo json_encode(['user' => null]);
            exit();
        }
        $stmt = $pdo->prepare(
            "SELECT id, username, email, yearly_goal, created_at FROM users WHERE id = ?"
        );
        $stmt->execute([(int)$_SESSION['user_id']]);
        $user = $stmt->fetch() ?: null;
        echo json_encode(['user' => $user]);
        exit();
    }

    if ($resource === 'goal') {
        if ($method !== 'PUT' && $method !== 'POST') {
            throw new Exception("Method not allowed.", 405);
        }
        $userId = requireLogin();
        $yearlyGoal = filter_var($input['yearly_goal'] ?? null, FILTER_VALIDATE_INT);

        if ($yearlyGoal === false) {
            throw new Exception("Valid yearly_goal is required.", 400);
        }

        $authRepo = new AuthRepo($pdo);
        $user = $authRepo->updateGoal($userId, (int)$yearlyGoal);
        echo json_encode([
            'user' => $user,
            'yearly_goal' => (int)($user['yearly_goal'] ?? $yearlyGoal),
            'message' => 'Yearly goal updated successfully',
        ]);
        exit();
    }

    // 4. Genres endpoint (read-only)
    if ($resource === 'genres') {
        if ($method !== 'GET') {
            throw new Exception("Method not allowed.", 405);
        }
        $genreRepo = new GenreRepo($pdo);
        echo json_encode($genreRepo->getAll());
        exit();
    }

    // 5. Books endpoint (GET catalog; POST requires login and creates/shelves book)
    if ($resource === 'books') {
        $bookRepo = new BookRepo($pdo);
        switch ($method) {
            case 'GET':
                $filters = [
                    'search'   => $_GET['search'] ?? '',
                    'genre_id' => $_GET['genre_id'] ?? '',
                ];
                echo json_encode($bookRepo->getAll($filters));
                break;
            case 'POST':
                $userId = requireLogin();
                $result = $bookRepo->createAndShelve($userId, $input);
                http_response_code(201);
                echo json_encode($result + ['message' => 'Book saved to shelf successfully']);
                break;
            default:
                throw new Exception("Method not allowed.", 405);
        }
        exit();
    }

    // 6. User books / shelves endpoint (requires login)
    if ($resource === 'user_books' || $resource === 'shelves') {
        $userId = requireLogin();
        $userBookRepo = new UserBookRepo($pdo);
        switch ($method) {
            case 'GET':
                $filters = [
                    'status'   => $_GET['status'] ?? 'all',
                    'search'   => $_GET['search'] ?? '',
                    'genre_id' => $_GET['genre_id'] ?? '',
                    'sort'     => $_GET['sort'] ?? 'added',
                    'page'     => $_GET['page'] ?? 1,
                    'per_page' => $_GET['per_page'] ?? 10,
                ];
                echo json_encode($userBookRepo->getAll($userId, $filters));
                break;
            case 'POST':
                $newId = $userBookRepo->create($userId, $input);
                http_response_code(201);
                echo json_encode(['id' => $newId, 'message' => 'Shelf entry created successfully']);
                break;
            case 'PUT':
                if (!$id) throw new Exception("Record ID is required for updates.", 400);
                $userBookRepo->update((int)$id, $userId, $input);
                echo json_encode(['message' => 'Shelf entry updated successfully']);
                break;
            case 'DELETE':
                if (!$id) throw new Exception("Record ID is required for deletion.", 400);
                $userBookRepo->delete((int)$id, $userId);
                echo json_encode(['message' => 'Shelf entry deleted successfully']);
                break;
            default:
                throw new Exception("Method not allowed.", 405);
        }
        exit();
    }

    // 7. Recommendations ("What's Next") endpoint (requires login)
    if ($resource === 'recommendations') {
        if ($method !== 'GET') {
            throw new Exception("Method not allowed.", 405);
        }
        $userId = requireLogin();
        $recService = new recService($pdo);
        echo json_encode($recService->getRecommendations($userId));
        exit();
    }

    // 8. Reading stats endpoint (requires login)
    if ($resource === 'stats') {
        if ($method !== 'GET') {
            throw new Exception("Method not allowed.", 405);
        }
        $userId = requireLogin();
        $goalStmt = $pdo->prepare("SELECT yearly_goal FROM users WHERE id = ?");
        $goalStmt->execute([$userId]);
        $userRow = $goalStmt->fetch();
        if (!$userRow) {
            throw new Exception("User not found.", 404);
        }

        $datesStmt = $pdo->prepare(
            "SELECT date_finished
             FROM user_books
             WHERE user_id = ? AND status = 'read' AND date_finished IS NOT NULL
             ORDER BY date_finished ASC"
        );
        $datesStmt->execute([$userId]);
        $finishedDates = array_map(
            fn($row) => $row['date_finished'],
            $datesStmt->fetchAll()
        );

        echo json_encode([
            'yearly_goal'    => (int)$userRow['yearly_goal'],
            'finished_count' => count($finishedDates),
            'finished_dates' => $finishedDates,
        ]);
        exit();
    }

    throw new Exception("Invalid or missing resource.", 400);
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
        echo json_encode(['error' => 'A server error occurred.']);
    }
} catch (Exception $e) {
    $code = $e->getCode();

    if ($code < 400 || $code > 599) {
        $code = 500;
    }
    http_response_code($code);
    error_log("API Error: " . $e->getMessage());
    echo json_encode(['error' => $code >= 500 ? 'A server error occurred.' : $e->getMessage()]);
} catch (Throwable $e) {
    error_log("Unexpected API Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'A server error occurred.']);
}