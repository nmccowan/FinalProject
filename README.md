# Final Project - Personal Library
A complete personal library catalog including reading stats like yearly goal, books read, and pace tracker. Each user is provided their own account and personal library, with simple login/logout via the top right corner. Users can organize their personal library by populating books across their shelves between the categories of 'To Be Read' for books on your shelves already, 'Reading', 'Read', and 'Wishlist' books you want to purchase/read. Once done all can be easily found in the appropriate category under "My Shelves", and filtered through their collection with different parameters and search such as; 'Title', 'Genre', and 'Author' among a few others. The books can be edited once they've been read/bought to another more appropriate tab, or  deleted all together if you were to add a book by mistake or get rid of/give to someone via the 'Edit' and 'Delete' buttons on the right side. Moving out of our shelves and into the "Add Book" tab which is just to add a new book to any of the provided categories with 'Title', 'Author', 'Number of Pages', 'Publication Year', 'Genre', and 'Status' with more categories depending on the provided status. Additionally in the "What's Next" tab users will get personalized recommendations directly from your TBR list for what to read next based on the previous books they've read and enjoyed. The last tab being the "Reading Stats", users provide their yearly reading goal which is then tracked according to the data they have populated in the categories/"My Shelves" for their annual reading pace with an accompanying forecast chart.

- **Live App:** [https://personal-library-f1hc.onrender.com/](https://personal-library-f1hc.onrender.com/)

## Login Info for Demo
- **Demo Account Information:**
    - **Username:** 'demo'
    - **Password:** 'password'

## Deployment
The app is configured for Render using `render.yaml`, a multi-stage-style `Dockerfile`, and `docker-entrypoint.sh`:

1. **Container Build (`Dockerfile`):** Starts from `php:8.3-apache`, installs `libpq-dev`, `postgresql-client`, and `pdo_pgsql`, enables a default `ServerName`, and copies `Project/public/` to `/var/www/html/`, `Project/src/` to `/var/www/src/`, and `Database.php`, `db.php`, `schema.sql`, `seed.sql`, and `docker-entrypoint.sh` into place.
2. **Startup & Seed (`docker-entrypoint.sh`):** Waits for PostgreSQL to become reachable, applies `schema.sql`, and runs `seed.sql` with `ON_ERROR_STOP=1` (using `ON CONFLICT DO NOTHING` so repeated deploys stay idempotent) before starting Apache in the foreground.
3. **Database Connection (`db.php` & `Database.php`):** Reads database credentials/URL from environment variables and creates a `PDO` connection to PostgreSQL.

## API Endpoints (`public/api.php`)
All endpoints return JSON and map validation, auth, and database errors to HTTP status codes:

- `POST /api.php?resource=register` — Create a user account and start a session.
- `POST /api.php?resource=login` — Authenticate a user and regenerate the session ID.
- `POST /api.php?resource=logout` — Clear and destroy the active session.
- `GET /api.php?resource=me` — Return the currently authenticated user (`null` if logged out).
- `PUT` / `POST /api.php?resource=goal` — Update the authenticated user's `yearly_goal`.
- `GET /api.php?resource=genres` — List available genres.
- `GET /api.php?resource=books` — Search/filter the shared book catalog.
- `POST /api.php?resource=books` — Create a catalog book (or reuse an existing one and add missing genres) and save it to the user's shelf.
- `GET` / `POST` / `PUT` / `DELETE /api.php?resource=shelves` (or `user_books`) — List (with status, search, genre, sort, and pagination), create, update, or delete shelf entries for the logged-in user.
- `GET /api.php?resource=recommendations` — Return ranked **To Be Read** recommendations and summary stats for the logged-in user.
- `GET /api.php?resource=stats` — Return the user's `yearly_goal`, finished book count, and sorted `date_finished` list for completed books.

## Algorithms
- **TBR Recommendation Ranking (`src/recService.php`):** Computes genre weights from books marked 'read' (scaling read count by rating boost), calculates the user's target page count from completed ('read') books, and scores each 'tbr' book by summing matching genre weights plus a proximity bonus for matching typical page length.
- **Reading Pace Forecast (`public/paceForecast.js`):** Aggregates finished dates in the active year into monthly and cumulative counts, fits an ordinary least-squares linear regression to cumulative monthly progress, blends the regression slope with a weighted average of the most recent up-to-3 months (`[1, 2, 3]` weights), and computes a projected year-end total along with a low/high range.

## Project Structure
Project/
├── Dockerfile # Builds PHP 8.3 Apache container with PostgreSQL extensions
├── render.yaml # Render web service & managed PostgreSQL blueprint
├── docker-entrypoint.sh # Waits for DB, applies schema.sql & idempotent seed.sql, starts Apache
├── schema.sql # PostgreSQL tables, foreign keys, constraints, and indexes
├── seed.sql # Idempotent demo user, authors, genres, books, and shelf entries
├── db.php # Environment-based database configuration loader
├── Database.php # PDO PostgreSQL connection wrapper
├── src/
│   ├── AuthRepo.php # User registration, login verification, profile lookup, and goal updates
│   ├── BookRepo.php # Catalog search and transactional book/genre/shelf creation
│   ├── GenreRepo.php # Read-only genre lookup
│   ├── UserBookRepo.php # Paginated shelf queries, CRUD operations, and finished-date retrieval
│   ├── recService.php # Genre-affinity and page-length TBR ranking engine
│   └── validShelf.php # Shared validation for shelf statuses, ratings, and YYYY-MM-DD dates
└── public/
    ├── index.html # Single-page shell with accessible forms, tabs, and views
    ├── style.css # Responsive layout, status banners, tables, and SVG chart styles
    ├── api.php # Single JSON API entry point and session controller
    ├── api.js # Frontend Fetch wrapper with loading state hooks
    ├── main.js # Application bootstrap, view switching, and controller coordination
    ├── auth.js # Login, registration, logout, and session check UI
    ├── shelves.js # Shelf table, filters, sorting, pagination, add/edit/delete handlers
    ├── recs.js # "What's Next" recommendations UI renderer
    ├── stats.js # Goal update form, stats summary, and SVG chart renderer
    └── paceForecast.js # Pure-JS least-squares regression & 3-month weighted pace forecaster