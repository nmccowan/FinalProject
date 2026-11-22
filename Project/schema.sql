CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(100)  NOT NULL UNIQUE CHECK (char_length(username) >= 3),
  email         VARCHAR(200) NOT NULL UNIQUE,
  password_hash VARCHAR(200) NOT NULL,
  yearly_goal   INTEGER      NOT NULL DEFAULT 20 CHECK (yearly_goal BETWEEN 1 AND 500),
  created_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS authors (
    id      SERIAL PRIMARY KEY,
    name    VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS genres (
    id      SERIAL PRIMARY KEY,
    name    VARCHAR(100) NOT NULL UNIQUE
);

-- ON DELETE RESTRICT on author: deleting an author must never delete a book silently.
CREATE TABLE IF NOT EXISTS books (
    id              SERIAL PRIMARY KEY,
    title           VARCHAR(200) NOT NULL,
    author_id       INTEGER NOT NULL REFERENCES authors(id) ON DELETE RESTRICT,
    pages           INTEGER NOT NULL CHECK (pages BETWEEN 1 AND 10000),
    published_year  INTEGER CHECK (published_year between 1 AND 2100),
    CONSTRAINT unique_book UNIQUE (title, author_id)
);

-- MANY-TO-MANY: a book has several genres; a genre has many books.
-- CASCADE on both sides: a link row is meaningless once either end is gone.
CREATE TABLE IF NOT EXISTS book_genres (
  book_id   INTEGER NOT NULL REFERENCES books(id)  ON DELETE CASCADE,
  genre_id  INTEGER NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
  PRIMARY KEY (book_id, genre_id)
);

-- CASCADE on user: deleting an account removes its shelves.
-- RESTRICT on book: a book someone has rated/shelved cannot vanish from the catalog.
CREATE TABLE IF NOT EXISTS user_books (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id       INTEGER NOT NULL REFERENCES books(id) ON DELETE RESTRICT,
  status        VARCHAR(10) NOT NULL CHECK (status IN ('tbr', 'reading', 'read', 'wishlist')),
  rating        INTEGER CHECK (rating BETWEEN 1 AND 5),
  date_added    DATE NOT NULL DEFAULT CURRENT_DATE,
  date_started  DATE,
  date_finished DATE,
  CONSTRAINT unique_user_book UNIQUE (user_id, book_id),
  CONSTRAINT rating_only_if_read CHECK (rating IS NULL OR status = 'read'),
  CONSTRAINT finished_only_if_read CHECK (date_finished IS NULL OR status = 'read'),
  CONSTRAINT finish_after_start CHECK (date_finished IS NULL OR date_started IS NULL OR date_finished >= date_started)
);

-- Indexes on join / filter columns (UNIQUE and PRIMARY KEY columns are already indexed).
CREATE INDEX IF NOT EXISTS idx_books_author ON books(author_id);
CREATE INDEX IF NOT EXISTS idx_book_genres_genre ON book_genres(genre_id);
CREATE INDEX IF NOT EXISTS idx_user_books_user_status ON user_books(user_id, status);
CREATE INDEX IF NOT EXISTS idx_user_books_finished ON user_books(user_id, date_finished);