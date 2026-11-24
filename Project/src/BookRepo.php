<?php
class BookRepo {
    private PDO $db;
    private array $validStatuses = ['tbr', 'reading', 'read', 'wishlist'];

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    public function getAll(array $filters = []): array {
        $sql = "SELECT b.id, b.title, b.author_id, a.name AS author, b.pages, b.published_year,
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
                FROM books b
                JOIN authors a ON b.author_id = a.id";

        $params = [];
        $where = [];

        if (!empty($filters['search'])) {
            $where[] = "(b.title ILIKE ? OR a.name ILIKE ?)";
            $like = '%' . trim((string)$filters['search']) . '%';
            $params[] = $like;
            $params[] = $like;
        }

        if (!empty($filters['genre_id'])) {
            $genreId = filter_var($filters['genre_id'], FILTER_VALIDATE_INT);
            if ($genreId !== false && $genreId > 0) {
                $where[] = "EXISTS (
                    SELECT 1 FROM book_genres bg2
                    WHERE bg2.book_id = b.id AND bg2.genre_id = ?
                )";
                $params[] = $genreId;
            }
        }

        if (!empty($where)) {
            $sql .= " WHERE " . implode(" AND ", $where);
        }

        $sql .= " ORDER BY b.title ASC, a.name ASC, b.id ASC";
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    /**
     * Find or create a catalog book, sync genres, and add/update the user's shelf entry in one transaction.
     */
    public function createAndShelve(int $userId, array $data): array {
        [$title, $authorName, $pages, $publishedYear, $genreIds] = $this->validateBook($data);
        [$status, $rating, $dateStarted, $dateFinished] = $this->validateShelfFields($data);

        $this->db->beginTransaction();
        try {
            $authorId = $this->getOrCreateAuthor($authorName);
            $bookId = $this->findBookIdByTitleAndAuthor($title, $authorId);

            if ($bookId === null) {
                $stmt = $this->db->prepare(
                    "INSERT INTO books (title, author_id, pages, published_year)
                     VALUES (?, ?, ?, ?)"
                );
                $stmt->execute([$title, $authorId, $pages, $publishedYear]);
                $bookId = (int)$this->db->lastInsertId();
            } else {
                $stmt = $this->db->prepare(
                    "UPDATE books
                     SET pages = ?, published_year = ?
                     WHERE id = ?"
                );
                $stmt->execute([$pages, $publishedYear, $bookId]);
            }

            $this->syncBookGenres($bookId, $genreIds);

            $checkStmt = $this->db->prepare(
                "SELECT id FROM user_books WHERE user_id = ? AND book_id = ?"
            );
            $checkStmt->execute([$userId, $bookId]);
            $existingShelf = $checkStmt->fetch();

            if ($existingShelf) {
                $shelfId = (int)$existingShelf['id'];
                $updStmt = $this->db->prepare(
                    "UPDATE user_books
                     SET status = ?, rating = ?, date_started = ?, date_finished = ?
                     WHERE id = ? AND user_id = ?"
                );
                $updStmt->execute([$status, $rating, $dateStarted, $dateFinished, $shelfId, $userId]);
            } else {
                $insStmt = $this->db->prepare(
                    "INSERT INTO user_books (user_id, book_id, status, rating, date_started, date_finished)
                     VALUES (?, ?, ?, ?, ?, ?)"
                );
                $insStmt->execute([$userId, $bookId, $status, $rating, $dateStarted, $dateFinished]);
                $shelfId = (int)$this->db->lastInsertId();
            }

            $this->db->commit();
            return ['book_id' => $bookId, 'user_book_id' => $shelfId];
        } catch (Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $e;
        }
    }

    private function findBookIdByTitleAndAuthor(string $title, int $authorId): ?int {
        $stmt = $this->db->prepare("SELECT id FROM books WHERE LOWER(title) = LOWER(?) AND author_id = ?");
        $stmt->execute([$title, $authorId]);
        $row = $stmt->fetch();
        return $row ? (int)$row['id'] : null;
    }

    private function getOrCreateAuthor(string $name): int {
        $stmt = $this->db->prepare("SELECT id FROM authors WHERE LOWER(name) = LOWER(?)");
        $stmt->execute([$name]);
        $existing = $stmt->fetch();

        if ($existing) {
            return (int)$existing['id'];
        }

        $stmt = $this->db->prepare("INSERT INTO authors (name) VALUES (?)");
        $stmt->execute([$name]);
        return (int)$this->db->lastInsertId();
    }

    private function syncBookGenres(int $bookId, array $genreIds): void {
        $delStmt = $this->db->prepare("DELETE FROM book_genres WHERE book_id = ?");
        $delStmt->execute([$bookId]);

        if (empty($genreIds)) {
            return;
        }

        $insStmt = $this->db->prepare(
            "INSERT INTO book_genres (book_id, genre_id)
             VALUES (?, ?)
             ON CONFLICT DO NOTHING"
        );
        foreach ($genreIds as $genreId) {
            $insStmt->execute([$bookId, $genreId]);
        }
    }

    private function parseDate(?string $value, string $label): ?string {
        if ($value === null || trim($value) === '') {
            return null;
        }
        $trimmed = trim($value);
        $dt = DateTime::createFromFormat('!Y-m-d', $trimmed);
        if (!$dt || $dt->format('Y-m-d') !== $trimmed) {
            throw new Exception("Invalid {$label} date (expected YYYY-MM-DD).", 400);
        }
        return $dt->format('Y-m-d');
    }

    /**
     * @return array{0: string, 1: string, 2: int, 3: ?int, 4: int[]}
     */
    private function validateBook(array $data): array {
        $title = trim((string)($data['title'] ?? ''));
        $author = trim((string)($data['author'] ?? ''));

        if ($title === '' || $author === '' || !isset($data['pages']) || $data['pages'] === '') {
            throw new Exception("Title, author, and page count are required.", 400);
        }

        if (mb_strlen($title) > 200) {
            throw new Exception("Title must be at most 200 characters.", 400);
        }

        if (mb_strlen($author) > 100) {
            throw new Exception("Author name must be at most 100 characters.", 400);
        }

        $pages = filter_var($data['pages'], FILTER_VALIDATE_INT);
        if ($pages === false || $pages < 1 || $pages > 10000) {
            throw new Exception("Pages must be a whole number between 1 and 10000.", 400);
        }

        $publishedYear = null;
        if (isset($data['published_year']) && $data['published_year'] !== '') {
            $year = filter_var($data['published_year'], FILTER_VALIDATE_INT);
            if ($year === false || $year < 1 || $year > 2100) {
                throw new Exception("Published year must be a whole number between 1 and 2100.", 400);
            }
            $publishedYear = $year;
        }

        $genreIds = [];
        if (isset($data['genre_ids'])) {
            if (!is_array($data['genre_ids'])) {
                throw new Exception("genre_ids must be an array.", 400);
            }
            foreach ($data['genre_ids'] as $gid) {
                $id = filter_var($gid, FILTER_VALIDATE_INT);
                if ($id === false || $id <= 0) {
                    throw new Exception("Invalid genre ID provided.", 400);
                }
                $checkStmt = $this->db->prepare("SELECT id FROM genres WHERE id = ?");
                $checkStmt->execute([$id]);
                if (!$checkStmt->fetch()) {
                    throw new Exception("Selected genre does not exist.", 404);
                }
                $genreIds[] = $id;
            }
            $genreIds = array_values(array_unique($genreIds));
        }

        return [$title, $author, $pages, $publishedYear, $genreIds];
    }

    /**
     * @return array{0: string, 1: ?int, 2: ?string, 3: ?string}
     */
    private function validateShelfFields(array $data): array {
        $status = trim((string)($data['status'] ?? 'tbr'));
        if (!in_array($status, $this->validStatuses, true)) {
            throw new Exception("Status must be one of: tbr, reading, read, or wishlist.", 400);
        }

        $rating = null;
        if (isset($data['rating']) && $data['rating'] !== '') {
            $parsedRating = filter_var($data['rating'], FILTER_VALIDATE_INT);
            if ($parsedRating === false || $parsedRating < 1 || $parsedRating > 5) {
                throw new Exception("Rating must be a whole number between 1 and 5.", 400);
            }
            $rating = $parsedRating;
        }

        $dateStarted = $this->parseDate($data['date_started'] ?? null, 'start');
        $dateFinished = $this->parseDate($data['date_finished'] ?? null, 'finish');

        if ($status !== 'read' && ($rating !== null || $dateFinished !== null)) {
            throw new Exception("Rating and finish date are only allowed when status is 'read'.", 400);
        }

        if ($dateStarted !== null && $dateFinished !== null && $dateFinished < $dateStarted) {
            throw new Exception("Finish date cannot be before start date.", 400);
        }

        return [$status, $rating, $dateStarted, $dateFinished];
    }
}