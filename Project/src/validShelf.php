<?php
//Shared validation helpers for shelf statuses, ratings, and YYYY-MM-DD dates.
class validShelf{
    public const VALID_STATUSES = ['tbr', 'reading', 'read', 'wishlist'];

    public static function validateStatus(string $status, bool $required = false): string {
        $normalized = trim($status);
        if ($normalized === '') {
            if ($required) {
                throw new Exception("Status is required.", 400);
            }
            return 'tbr';
        }
        if (!in_array($normalized, self::VALID_STATUSES, true)) {
            throw new Exception("Status must be one of: tbr, reading, read, or wishlist.", 400);
        }
        return $normalized;
    }

    public static function validateRating($rawRating): ?int {
        if ($rawRating === null || $rawRating === '') {
            return null;
        }
        $parsed = filter_var($rawRating, FILTER_VALIDATE_INT);
        if ($parsed === false || $parsed < 1 || $parsed > 5) {
            throw new Exception("Rating must be a whole number between 1 and 5.", 400);
        }
        return (int)$parsed;
    }

    public static function parseDate(?string $value, string $label): ?string {
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

    // Validates status, rating, start date, and finish date together.
    public static function validateShelfFields(array $data, bool $statusRequired = false): array {
        $status = self::validateStatus((string)($data['status'] ?? ''), $statusRequired);
        $rating = self::validateRating($data['rating'] ?? null);
        $dateStarted = self::parseDate($data['date_started'] ?? null, 'start');
        $dateFinished = self::parseDate($data['date_finished'] ?? null, 'finish');

        // Ratings and finish dates only apply to completed ("read") books
        if ($status !== 'read' && ($rating !== null || $dateFinished !== null)) {
            throw new Exception("Rating and finish date are only allowed when status is 'read'.", 400);
        }

        if ($dateStarted !== null && $dateFinished !== null && $dateFinished < $dateStarted) {
            throw new Exception("Finish date cannot be before start date.", 400);
        }

        return [$status, $rating, $dateStarted, $dateFinished];
    }
}