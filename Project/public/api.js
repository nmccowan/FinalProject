const API_URL = 'api.php';

let pending = 0;
export const hooks = { onLoading: null };

function buildUrl(params = {}) {
    const url = new URL(API_URL, window.location.href);
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            url.searchParams.set(key, String(value));
        }
    });
    return url.toString();
}

async function fetchData(url, options = {}) {
    const fetchOptions = {
        method: options.method || 'GET',
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...(options.headers || {}),
        },
        ...(options.body ? { body: options.body } : {}),
    };

    pending++;
    hooks.onLoading?.(true);
    try {
        const response = await fetch(url, fetchOptions);
        let data = null;

        try {
            data = await response.json();
        } catch {
            data = null;
        }

        if (!response.ok) {
            throw new Error(
                (data && (data.error || data.message)) ||
                    `Request failed with status ${response.status}`
            );
        }

        return data;
    } finally {
        if (--pending === 0) {
            hooks.onLoading?.(false);
        }
    }
}

export const api = {
    // Session & Auth
    getSession() {
        return fetchData(buildUrl({ resource: 'me' }));
    },
    login(c) {
        return fetchData(buildUrl({ resource: 'login' }), {
            method: 'POST',
            body: JSON.stringify(c),
        });
    },
    register(u) {
        return fetchData(buildUrl({ resource: 'register' }), {
            method: 'POST',
            body: JSON.stringify(u),
        });
    },
    logout() {
        return fetchData(buildUrl({ resource: 'logout' }), {
            method: 'POST',
        });
    },

    // Genres, Shelf & Books
    getGenres() {
        return fetchData(buildUrl({ resource: 'genres' }));
    },
    getShelf(f = {}) {
        return fetchData(
            buildUrl({
                resource: 'shelves',
                status: f.status && f.status !== 'all' ? f.status : '',
                search: f.search,
                genre_id: f.genre_id,
                sort: f.sort,
                page: f.page,
                per_page: f.per_page,
            })
        );
    },
    addBook(data) {
        return fetchData(buildUrl({ resource: 'books' }), {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },
    updateShelfEntry(id, d) {
        return fetchData(buildUrl({ resource: 'shelves', id }), {
            method: 'PUT',
            body: JSON.stringify(d),
        });
    },
    deleteShelfEntry(id) {
        return fetchData(buildUrl({ resource: 'shelves', id }), {
            method: 'DELETE',
        });
    },

    // Algorithm endpoints
    getRecommendations() {
        return fetchData(buildUrl({ resource: 'recommendations' }));
    },
    getStats() {
        return fetchData(buildUrl({ resource: 'stats' }));
    },
    updateGoal(yearlyGoal) {
        return fetchData(buildUrl({ resource: 'goal' }), {
            method: 'PUT',
            body: JSON.stringify({ yearly_goal: yearlyGoal }),
        });
    },
};