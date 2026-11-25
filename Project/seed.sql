-- Demo account password (for local/demo seed only): password
-- Generate your own hash with PHP's password_hash() and test it with password_verify() once the login code exists.-- 
INSERT INTO users (username, email, password_hash, yearly_goal) VALUES
  ('demo', 'demo@example.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 15)
ON CONFLICT DO NOTHING;

INSERT INTO genres (name) VALUES 
    ('Fantasy'), ('Science Fiction'), ('Mystery'), ('Thriller'), ('Horror'), ('Dystopian'),('Young Adult Fiction')
    ('Romance'), ('Non-Fiction'), ('Memoir'), ('Historical Fiction'), ('Literary Fiction'), ('Gothic')
ON CONFLICT DO NOTHING;


INSERT INTO authors (name) VALUES 
    ('Suzanne Collins'), ('Madeline Miller'), ('Bram Stoker'), ('Gillian Flynn'), ('Stephen King'), ('Daphne du Maurier'), ('Natalie Haynes'),('Richard Osman'),('Laura Elliot'), ('Mary Renault'),
    ('Michelle Obama'), ('Ashley Flowers'), ('J.K. Rowling'), ('Rick Riordan'), ('Alex Michaelides'), ('Jennifer Saint'), ('Costanza Casati'), ('John Green'), ('Pierce Brown'), ('Lynn Weingarten'),('Claire Heywood')
ON CONFLICT DO NOTHING;


INSERT INTO books (title, author_id, pages, published_year)
SELECT v.title, a.id, v.pages, v.yr
FROM (VALUES 
    ('The Hunger Games', 'Suzanne Collins', 374, 2008),
    ('Circe', 'Madeline Miller', 393, 2018),
    ('The Song of Achilles', 'Madeline Miller', 352, 2011),
    ('Dracula', 'Bram Stoker', 418, 1897),
    ('Gone Girl', 'Gillian Flynn', 422, 2012),
    ('IT', 'Stephen King', 1138, 1986),
    ('Fairy Tale', 'Stephen King', 608, 2022),
    ('Misery', 'Stephen King', 310, 1987),
    ('Rebecca', 'Daphne du Maurier', 449, 1938),
    ('The Fault in Our Stars', 'John Green', 313, 2012),
    ('Becoming', 'Michelle Obama', 448, 2018),
    ('All Good People Here', 'Ashley Flowers', 320, 2022),
    ('Harry Potter and the Goblet of Fire', 'J.K. Rowling', 636, 2000),
    ('Percy Jackson and the Lightning Thief', 'Rick Riordan', 375, 2005),
    ('The Silent Patient', 'Alex Michaelides', 336, 2019),
    ('Stone Blind', 'Natalie Haynes', 384, 2022),
    ('Atalanta', 'Jennifer Saint', 304, 2023),
    ('Elektra', 'Jennifer Saint', 304, 2022),
    ('Clytemnestra', 'Costanza Casati', 448, 2023),
    ('The Thursday Murder Club', 'Richard Osman', 382, 2020),
    ('Red Rising', 'Pierce Brown', 382, 2014),
    ('Looking for Alaska', 'John Green', 297, 2005),
    ('Guilty', 'Laura Elliot', 394, 2017),
    ("Pandora's Jar", 'Natalie Haynes', 308, 2020)
    ('Suicide Notes from Beautiful Girls', 'Lynn Weingarten', 336, 2015), 
    ('Ariadne', 'Jennifer Saint', 308, 2021),
    ('The King Must Die', 'Mary Renault', 338, 1958),
    ('The Shadow of Perseus', 'Claire Heywood', 304, 2023)
) AS v(title, author, pages, yr)
JOIN authors a ON a.name = v.author
ON CONFLICT DO NOTHING;


INSERT INTO book_genres (book_id, genre_id)
SELECT b.id, g.id
FROM (VALUES 
    ('The Hunger Games', 'Dystopian'), ('The Hunger Games', 'Science Fiction'),
    ('Circe', 'Fantasy'), ('Circe', 'Literary Fiction'),
    ('The Song of Achilles', 'Historical Fiction'), ('The Song of Achilles', 'Fantasy'), ('The Song of Achilles', 'Literary Fiction'),
    ('Dracula', 'Horror'), ('Dracula', 'Gothic'),
    ('Gone Girl', 'Thriller'), ('Gone Girl', 'Mystery'),
    ('IT', 'Horror'), ('IT', 'Thriller'),
    ('Fairy Tale', 'Fantasy'),
    ('Misery', 'Thriller'), ('Misery', 'Horror'),
    ('Rebecca', 'Mystery'), ('Rebecca', 'Romance'),
    ('The Fault in Our Stars', 'Romance'),
    ('Becoming', 'Memoir'), ('Becoming', 'Non-Fiction'),
    ('All Good People Here', 'Mystery'), ('All Good People Here', 'Thriller'),
    ('Harry Potter and the Goblet of Fire', 'Fantasy'),
    ('Percy Jackson and the Lightning Thief', 'Fantasy'),
    ('The Silent Patient', 'Thriller'), ('The Silent Patient', 'Mystery'),
    ('Stone Blind','Historical Fiction'), ('Stone Blind', 'Fantasy'), ('Stone Blind', 'Literary Fiction'),
    ('Atalanta', 'Historical Fiction'), ('Atalanta', 'Fantasy'), ('Atalanta', 'Literary Fiction'),
    ('Elektra', 'Historical Fiction'), ('Elektra', 'Fantasy'), ('Elektra', 'Literary Fiction'),
    ('Clytemnestra','Historical Fiction'), ('Clytemnestra', 'Literary Fiction'), 
    ('The Thursday Murder Club', 'Mystery'),
    ('Red Rising', 'Science Fiction'),
    ('Looking for Alaska', 'Young Adult Fiction'), 
    ('Guilt', 'Mystery'), ('Guilty', 'Thriller'),
    ("Pandora's Jar", 'Non-Fiction'),
    ('The Children of Jocasta', 'Historical Fiction'), ('The Children of Jocasta', 'Literary Fiction'), 
    ('Suicide Notes from Beautiful Girls', 'Young Adult Fiction'), ('Suicide Notes from Beautiful Girls', 'Mystery'), 
    ('Ariadne', 'Fanatasy'), ('Ariadne', 'Historical Fiction'),
    ('The King Must Die', 'Historical Fiction'),
    ('The Shadow of Perseus', 'Historical Fiction'),  ('The Shadow of Perseus', 'Fantasy')
) AS v(title, genre)
JOIN books b ON b.title = v.title
JOIN genres g ON g.name = v.genre
ON CONFLICT DO NOTHING;


INSERT INTO user_books (user_id, book_id, status, rating, date_added, date_started, date_finished)
SELECT u.id, b.id, v.status, v.rating, v.added::date, v.started::date, v.finished::date
FROM (VALUES
    ('The Hunger Games', 'read', 5, '2026-11-22', '2016-12-25', '2017-01-28'),
    ('Circe', 'read', 4, '2026-11-22' , '2026-02-12', '2026-02-27'),
    ('The Song of Achilles', 'read', 4, '2026-11-22', '2026-01-01', '2026-01-10'),
    ('Dracula', 'wishlist', NULL, '2026-11-22', NULL, NULL),
    ('Gone Girl', 'read', 4, '2026-11-22', '2024-06-06', '2024-06-28'),
    ('IT', 'tbr', NULL, '2026-11-22', NULL , NULL),
    ('Fairy Tale', 'tbr', NULL, '2026-11-22', NULL, NULL),
    ('Misery', 'read', 4, '2026-11-22', '2024-07-01', '2024-08-08'),
    ('Rebecca', 'wishlist', NULL, '2026-11-22', NULL, NULL),
    ('The Fault in Our Stars', 'read', 3, '2026-11-22', '2018-12-25', '2019-01-25'),
    ('Becoming', 'wishlist', NULL, '2026-11-22', NULL, NULL),
    ('All Good People Here', 'read', 3, '2026-11-22', '2022-12-25', '2023-01-25'),
    ('Harry Potter and the Goblet of Fire', 'read', 4, '2026-11-22', '2014-11-05', '2014-12-28'),
    ('Percy Jackson and the Lightning Thief', 'read', 4, '2026-11-22', '2015-01-01', '2015-02-20'),
    ('The Silent Patient', 'read', 4, '2026-11-22', '2026-01-10', '2026-02-10'),
    ('Stone Blind', 'read', 3, '2026-11-22', '2026-03-22', '2026-04-06'),
    ('Atalanta', 'reading', NULL, '2026-11-22', '2026-11-01', NULL),
    ('Elektra', 'tbr', NULL, '2026-11-22', NULL, NULL),
    ('Clytemnestra', 'read', 5, '2026-11-22', '2025-11-12', '2025-12-19'),
    ('The Thursday Murder Club','tbr', NULL, '2026-11-22', NULL, NULL),
    ('Red Rising','wishlist', NULL, '2026-11-22', NULL, NULL),
    ('Looking for Alaska', 'read', 3, '2026-11-22', '2026-05-30', '2026-06-25')
    ('Guilt', 'read', 3, '2026-11-22', '2026-06-27', '2026-07-14'),
    ("Pandora's Jar", 'read', 4, '2026-11-22', '2026-03-02', '2026-03-22'),
    ('The Children of Jocasta', 'read', 4, '2026-11-22', '2026-07-23', '2026-08-09'), 
    ('Suicide Notes for Beautiful Girls', 'read', 2, '2026-11-22', '2026-08-11', '2026-08-29'),
    ('Ariadne', 'read', 5, '2026-11-22', '2026-09-09', '2026-09-16'),
    ('The King Must Die', 'tbr', NULL, '2026-11-22', NULL, NULL),
    ('The Shadows of Perseus', 'tbr', NULL, '2026-11-22', NULL, NULL)
) AS v(title, status, rating, added, started, finished)
JOIN users u ON u.username = 'demo'
JOIN books b ON b.title = v.title
ON CONFLICT DO NOTHING;

--Go back in and add more data before final turn in so things look more even and cohesive. change added dates--