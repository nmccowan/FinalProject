<?php
class recService {
    private PDO $db;

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    public function getRecommendations(int $userId): array {
        // 1. Build genre affinity from read books (stronger weight for higher ratings)
        $genreStmt = $this->db->prepare(
            "SELECT bg.genre_id, g.name,
                    COUNT(*) AS read_count,
                    AVG(ub.rating) AS avg_rating
             FROM user_books ub
             JOIN book_genres bg ON ub.book_id = bg.book_id
             JOIN genres g ON bg.genre_id = g.id
             WHERE ub.user_id = ? AND ub.status = 'read'
             GROUP BY bg.genre_id, g.name"
        );
        $genreStmt->execute([$userId]);
        $genreRows = $genreStmt->fetchAll();

        $genreWeights = [];
        $favoriteGenres = [];
        foreach ($genreRows as $row) {
            $gid = (int)$row['genre_id'];
            $count = (int)$row['read_count'];
            $ratingBoost = $row['avg_rating'] !== null ? ((float)$row['avg_rating'] / 5.0) : 0.6;
            $weight = round(($count * 2.0) * (0.6 + 0.4 * $ratingBoost), 2);
            $genreWeights[$gid] = $weight;
            $favoriteGenres[] = [
                'id' => $gid,
                'name' => $row['name'],
                'read_count' => $count,
                'avg_rating' => $row['avg_rating'] !== null ? round((float)$row['avg_rating'], 1) : null,
                'weight' => $weight,
            ];
        }

        usort($favoriteGenres, fn($a, $b) => $b['weight'] <=> $a['weight']);

        // 2. Average pages of completed ('read') books + overall average rating
        $statsStmt = $this->db->prepare(
            "SELECT AVG(b.pages) FILTER (WHERE ub.status = 'read') AS avg_pages,
                    AVG(ub.rating) AS avg_rating,
                    COUNT(*) FILTER (WHERE ub.status = 'read') AS total_read
             FROM user_books ub
             JOIN books b ON ub.book_id = b.id
             WHERE ub.user_id = ?"
        );
        $statsStmt->execute([$userId]);
        $summaryRow = $statsStmt->fetch() ?: [];
        $targetPages = !empty($summaryRow['avg_pages']) ? (float)$summaryRow['avg_pages'] : 300.0;
        $avgRating = $summaryRow['avg_rating'] !== null ? round((float)$summaryRow['avg_rating'], 2) : null;

        // 3. Fetch candidate TBR books for this user
        $tbrStmt = $this->db->prepare(
            "SELECT ub.id AS shelf_id, b.id AS book_id, b.title, a.name AS author,
                    b.pages, b.published_year, ub.date_added,
                    COALESCE(STRING_AGG(DISTINCT g.name, ', ' ORDER BY g.name), '') AS genres,
                    COALESCE(ARRAY_REMOVE(ARRAY_AGG(DISTINCT bg.genre_id), NULL), ARRAY[]::integer[]) AS genre_ids
             FROM user_books ub
             JOIN books b ON ub.book_id = b.id
             JOIN authors a ON b.author_id = a.id
             LEFT JOIN book_genres bg ON b.id = bg.book_id
             LEFT JOIN genres g ON bg.genre_id = g.id
             WHERE ub.user_id = ? AND ub.status = 'tbr'
             GROUP BY ub.id, b.id, b.title, a.name, b.pages, b.published_year, ub.date_added"
        );
        $tbrStmt->execute([$userId]);
        $candidates = $tbrStmt->fetchAll();

        $ranked = [];
        foreach ($candidates as $book) {
            $rawIds = $book['genre_ids'] ?? '';
            $bookGenreIds = [];
            if (is_array($rawIds)) {
                $bookGenreIds = array_map('intval', $rawIds);
            } elseif (is_string($rawIds)) {
                $trimmed = trim($rawIds, '{}');
                if ($trimmed !== '') {
                    $bookGenreIds = array_map('intval', explode(',', $trimmed));
                }
            }

            $genreScore = 0.0;
            foreach ($bookGenreIds as $gid) {
                if (isset($genreWeights[$gid])) {
                    $genreScore += $genreWeights[$gid];
                }
            }

            $pages = (int)$book['pages'];
            $pageDiffRatio = min(1.0, abs($pages - $targetPages) / max(100.0, $targetPages));
            $lengthScore = round((1.0 - $pageDiffRatio) * 3.0, 2);
            $score = round($genreScore + $lengthScore, 2);
            $ranked[] = [
                'id' => (int)$book['shelf_id'],
                'book_id' => (int)$book['book_id'],
                'title' => $book['title'],
                'author' => $book['author'],
                'pages' => $pages,
                'published_year' => $book['published_year'] !== null ? (int)$book['published_year'] : null,
                'genres' => $book['genres'],
                'score' => $score,
                'genre_score' => round($genreScore, 2),
                'length_score' => $lengthScore,
            ];
        }

        usort($ranked, fn($a, $b) => $b['score'] <=> $a['score'] ?: strcmp($a['title'], $b['title']));

        return [
            'summary' => [
                'favorite_genres' => array_slice($favoriteGenres, 0, 3),
                'average_rating' => $avgRating,
                'target_pages' => (int)round($targetPages),
                'tbr_count' => count($ranked),
            ],
            'recommendations' => $ranked,
        ];
    }
}