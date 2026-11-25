<?php
class UserBookRepo {
    private PDO $db;
    private array $sorts = [
        'added' => 'ub.date_added DESC',
        'title' => 'b.title ASC',
        'author' => 'a.name ASC',
        'rating' => 'ub.rating DESC NULLS LAST',
        'pages' => 'b.pages ASC',
    ];

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    public function getAll(int $userId, array $filters = []): array {
        $status = $filters['status'] ?? 'all';
        $search = trim((string)($filters['search'] ?? ''));
        $genreIdRaw = $filters['genre_id'] ?? '';
        $sortKey = (string)($filters['sort'] ?? 'added');
        $page = isset($filters['page']) ? filter_var($filters['page'], FILTER_VALIDATE_INT) : 1;
        $page = ($page === false || $page < 1) ? 1 : (int)$page;
        $perPage = isset($filters['per_page']) ? filter_var($filters['per_page'], FILTER_VALIDATE_INT) : 10;
        $perPage = ($perPage === false) ? 10 : min(max((int)$perPage, 1), 50);
        $orderBy = $this->sorts[$sortKey] ?? $this->sorts['added'];
        $where = ["ub.user_id = ?"];
        $params = [$userId];

        if ($status !== null && $status !== '' && $status !== 'all') {
            $status = validShelf::validateStatus((string)$status, true);
            $where[] = "ub.status = ?";
            $params[] = $status;
        }

        if ($search !== '') {
            $where[] = "(b.title ILIKE ? OR a.name ILIKE ?)";
            $like = '%' . $search . '%';
            $params[] = $like;
            $params[] = $like;
        }

        if ($genreIdRaw !== null && $genreIdRaw !== '') {
            $genreId = filter_var($genreIdRaw, FILTER_VALIDATE_INT);
            if ($genreId === false || $genreId <= 0) {
                throw new Exception("Invalid genre filter.", 400);
            }
            $where[] = "EXISTS (
                SELECT 1 FROM book_genres bg
                WHERE bg.book_id = b.id AND bg.genre_id = ?
            )";
            $params[] = (int)$genreId;
        }

        $whereSql = " WHERE " . implode(" AND ", $where);
        $countSql = "SELECT COUNT(*)
                     FROM user_books ub
                     JOIN books b ON ub.book_id = b.id
                     JOIN authors a ON b.author_id = a.id" . $whereSql;
        $countStmt = $this->db->prepare($countSql);
        $countStmt->execute($params);
        $total = (int)$countStmt->fetchColumn();
        $offset = ($page - 1) * $perPage;

        $sql = "SELECT ub.id, ub.user_id, ub.book_id, ub.status, ub.rating,
                       ub.date_added, ub.date_started, ub.date_finished,
                       b.title, a.name AS author, b.pages, b.published_year,
                       CASE
                           WHEN (
                               SELECT STRING_AGG(g.name, ', ' ORDER BY g.name)
                               FROM book_genres bg
                               JOIN genres g ON g.id = bg.genre_id
                               WHERE bg.book_id = b.id
                           ) IS NULL THEN ''
                           ELSE (
                               SELECT STRING_AGG(g.name, ', ' ORDER BY g.name)
                               FROM book_genres bg
                               JOIN genres g ON g.id = bg.genre_id
                               WHERE bg.book_id = b.id
                           )
                       END AS genres
                FROM user_books ub
                JOIN books b ON ub.book_id = b.id
                JOIN authors a ON b.author_id = a.id"
                . $whereSql
                . " ORDER BY {$orderBy}, ub.id ASC LIMIT :limit OFFSET :offset";

        $stmt = $this->db->prepare($sql);
        foreach ($params as $idx => $val) {
            $stmt->bindValue($idx + 1, $val);
        }
        $stmt->bindValue(':limit', $perPage, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll();

        return [
            'items' => $rows,
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
        ];
    }

    public function getFinishedDates(int $userId): array {
        $stmt = $this->db->prepare(
            "SELECT date_finished
             FROM user_books
             WHERE user_id = ? AND status = 'read' AND date_finished IS NOT NULL
             ORDER BY date_finished ASC"
        );
        $stmt->execute([$userId]);
        return array_map(
            fn($row) => $row['date_finished'],
            $stmt->fetchAll()
        );
    }

    public function create(int $userId, array $data): int {
        [$bookId, $status, $rating, $dateStarted, $dateFinished] = $this->validateCreate($userId, $data);
        $this->checkDuplicate($userId, $bookId);
        $stmt = $this->db->prepare(
            "INSERT INTO user_books (user_id, book_id, status, rating, date_started, date_finished)
             VALUES (?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([$userId, $bookId, $status, $rating, $dateStarted, $dateFinished]);
        return (int)$this->db->lastInsertId();
    }

    public function update(int $id, int $userId, array $data): void {
        if (!$this->existsForUser($id, $userId)) {
            throw new Exception("Shelf entry not found.", 404);
        }

        [$status, $rating, $dateStarted, $dateFinished] = ShelfValidator::validateShelfFields($data, true);
        $stmt = $this->db->prepare(
            "UPDATE user_books
             SET status = ?, rating = ?, date_started = ?, date_finished = ?
             WHERE id = ? AND user_id = ?"
        );
        $stmt->execute([$status, $rating, $dateStarted, $dateFinished, $id, $userId]);
    }

    public function delete(int $id, int $userId): void {
        if (!$this->existsForUser($id, $userId)) {
            throw new Exception("Shelf entry not found.", 404);
        }

        $stmt = $this->db->prepare("DELETE FROM user_books WHERE id = ? AND user_id = ?");
        $stmt->execute([$id, $userId]);
    }

    private function existsForUser(int $id, int $userId): bool {
        $stmt = $this->db->prepare("SELECT id FROM user_books WHERE id = ? AND user_id = ?");
        $stmt->execute([$id, $userId]);
        return (bool)$stmt->fetch();
    }

    private function bookExists(int $id): bool {
        $stmt = $this->db->prepare("SELECT id FROM books WHERE id = ?");
        $stmt->execute([$id]);
        return (bool)$stmt->fetch();
    }

    private function checkDuplicate(int $userId, int $bookId): void {
        $stmt = $this->db->prepare("SELECT id FROM user_books WHERE user_id = ? AND book_id = ?");
        $stmt->execute([$userId, $bookId]);
        if ($stmt->fetch()) {
            throw new Exception("This book is already on your shelf.", 409);
        }
    }

    private function validateCreate(int $userId, array $data): array {
        $bookId = filter_var($data['book_id'] ?? null, FILTER_VALIDATE_INT);
        if ($userId <= 0 || $bookId === false || $bookId <= 0) {
            throw new Exception("Valid book ID is required.", 400);
        }

        if (!$this->bookExists((int)$bookId)) {
            throw new Exception("Book not found.", 404);
        }

        [$status, $rating, $dateStarted, $dateFinished] = validShelf::validateShelfFields($data, true);
        return [(int)$bookId, $status, $rating, $dateStarted, $dateFinished];
    }
}