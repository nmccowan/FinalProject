<?php
class GenreRepo {
    private PDO $db;

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    public function getAll(): array {
        $stmt = $this->db->prepare("SELECT id, name FROM genres ORDER BY name ASC");
        $stmt->execute();
        return $stmt->fetchAll();
    }

    private function exists(int $id): bool {
        $stmt = $this->db->prepare("SELECT id FROM genres WHERE id = ?");
        $stmt->execute([$id]);
        return (bool)$stmt->fetch();
    }
}