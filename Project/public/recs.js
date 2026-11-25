import { api } from './api.js';

export function initRecommendations({ onStatus }) {
    const nextSummary = document.getElementById('nextSummary');
    const nextTableContainer = document.getElementById('nextTableContainer');

    let loggedIn = false;

    function renderEmpty(message) {
        if (nextSummary) {
            nextSummary.replaceChildren();
        }
        if (nextTableContainer) {
            nextTableContainer.replaceChildren();
            const p = document.createElement('p');
            p.textContent = message;
            nextTableContainer.appendChild(p);
        }
    }

    function renderSummary(summary = {}) {
        if (!nextSummary) return;
        nextSummary.replaceChildren();

        const genres = Array.isArray(summary.favorite_genres) ? summary.favorite_genres : [];
        const topGenreText =
            genres.length > 0
                ? genres.map((g) => `${g.name} (${g.read_count} read)`).join(', ')
                : 'None yet';

        const avgRatingText = summary.average_rating != null ? `${summary.average_rating} / 5` : 'No ratings yet';
        const p = document.createElement('p');
        p.textContent = `Top genres: ${topGenreText}  |  Average rating: ${avgRatingText}`;
        nextSummary.appendChild(p);
    }

    function renderTable(items = []) {
        if (!nextTableContainer) return;
        nextTableContainer.replaceChildren();

        if (!Array.isArray(items) || items.length === 0) {
            const p = document.createElement('p');
            p.textContent = 'No To Be Read books to rank right now.';
            nextTableContainer.appendChild(p);
            return;
        }

        const table = document.createElement('table');
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');

        ['Rank', 'Title', 'Author', 'Genres', 'Pages', 'Match Score'].forEach((text) => {
            const th = document.createElement('th');
            th.textContent = text;
            headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');

        items.forEach((item, index) => {
            const tr = document.createElement('tr');
            const rankTd = document.createElement('td');
            rankTd.textContent = `#${index + 1}`;
            tr.appendChild(rankTd);
            const titleTd = document.createElement('td');
            const strong = document.createElement('strong');
            strong.textContent = item.title ?? '';
            titleTd.appendChild(strong);
            tr.appendChild(titleTd);
            const authorTd = document.createElement('td');
            authorTd.textContent = item.author ?? '';
            tr.appendChild(authorTd);
            const genresTd = document.createElement('td');
            genresTd.textContent = item.genres || '—';
            tr.appendChild(genresTd);
            const pagesTd = document.createElement('td');
            pagesTd.textContent = item.pages != null ? String(item.pages) : '';
            tr.appendChild(pagesTd);
            const scoreTd = document.createElement('td');
            scoreTd.textContent = item.score != null ? String(item.score) : '0';
            tr.appendChild(scoreTd);
            tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        nextTableContainer.appendChild(table);
    }

    async function loadRecommendations() {
        if (!loggedIn) {
            renderEmpty("Log in to see personalized What's Next recommendations.");
            return;
        }

        try {
            const data = await api.getRecommendations();
            renderSummary(data?.summary || {});
            renderTable(data?.recommendations || []);
        } catch (err) {
            onStatus?.('error', err.message || 'Failed to load recommendations.');
        }
    }

    function setUser(user) {
        loggedIn = Boolean(user);
        loadRecommendations();
    }

    return {
        loadRecommendations,
        setUser,
    };
}