<?php
// Class wrapper around the provided db() function.
class Database {
    public function connect(): PDO {
        return db();
    }
}