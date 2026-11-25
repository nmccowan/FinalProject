<?php
class AuthRepo {
    private PDO $db;

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    public function register(array $data): array {
        $username = trim((string)($data['username'] ?? ''));
        $email = trim((string)($data['email'] ?? ''));
        $password = (string)($data['password'] ?? '');
        $yearlyGoal = isset($data['yearly_goal']) && $data['yearly_goal'] !== '' 
            ? filter_var($data['yearly_goal'], FILTER_VALIDATE_INT):20;

        if (mb_strlen($username) < 3 || mb_strlen($username) > 100) {
            throw new Exception("Username must be between 3 and 100 characters.", 400);
        }

        if ($email === '' || mb_strlen($email) > 200 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new Exception("A valid email address (up to 200 characters) is required.", 400);
        }

        if (strlen($password) < 8) {
            throw new Exception("Password must be at least 8 characters.", 400);
        }

        if ($yearlyGoal === false || $yearlyGoal < 1 || $yearlyGoal > 500) {
            throw new Exception("Yearly reading goal must be between 1 and 500.", 400);
        }

        $dupStmt = $this->db->prepare(
            "SELECT id FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)"
        );
        $dupStmt->execute([$username, $email]);
        if ($dupStmt->fetch()) {
            throw new Exception("An account with that username or email already exists.", 409);
        }

        $hash = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $this->db->prepare(
            "INSERT INTO users (username, email, password_hash, yearly_goal)
             VALUES (?, ?, ?, ?)
             RETURNING id, username, email, yearly_goal, created_at"
        );
        $stmt->execute([$username, $email, $hash, $yearlyGoal]);
        return $stmt->fetch();
    }

    public function login(array $data): array {
        $login = trim((string)($data['login'] ?? $data['username'] ?? $data['email'] ?? ''));
        $password = (string)($data['password'] ?? '');

        if ($login === '' || $password === '') {
            throw new Exception("Username/email and password are required.", 400);
        }

        $stmt = $this->db->prepare(
            "SELECT id, username, email, password_hash, yearly_goal, created_at
             FROM users
             WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)"
        );
        $stmt->execute([$login, $login]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            throw new Exception("Invalid credentials.", 401);
        }

        unset($user['password_hash']);
        return $user;
    }

    public function updateGoal(int $userId, int $yearlyGoal): array {
        if ($userId <= 0) {
            throw new Exception("Valid user ID is required.", 400);
        }
        if ($yearlyGoal < 1 || $yearlyGoal > 500) {
            throw new Exception("Yearly reading goal must be between 1 and 500.", 400);
        }

        $stmt = $this->db->prepare(
            "UPDATE users SET yearly_goal = ? WHERE id = ?
             RETURNING id, username, email, yearly_goal, created_at"
        );
        $stmt->execute([$yearlyGoal, $userId]);
        $updated = $stmt->fetch();

        if (!$updated) {
            throw new Exception("User not found.", 404);
        }

        return $updated;
    }

    public function findById(int $userId): ?array {
        if ($userId <= 0) {
            return null;
        }
        $stmt = $this->db->prepare(
            "SELECT id, username, email, yearly_goal, created_at FROM users WHERE id = ?"
        );
        $stmt->execute([$userId]);
        $user = $stmt->fetch();
        return $user ?: null;
    }

}