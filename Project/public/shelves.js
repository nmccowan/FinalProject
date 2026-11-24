import { api } from './api.js';

const STATUS_LABELS = {
    tbr: 'To Be Read',
    reading: 'Reading',
    read: 'Read',
    wishlist: 'Wishlist',
};

function validateForm(form) {
    if (!form) return false;
    if (!form.checkValidity()) {
        form.reportValidity();
        return false;
    }
    return true;
}

function shelfFields(status, get) {
    return {
        status,
        date_started:
            status === 'reading' || status === 'read' ? get('date_started') || null : null,
        rating:
            status === 'read' && get('rating') ? Number(get('rating')) : null,
        date_finished: status === 'read' ? get('date_finished') || null : null,
    };
}

function formatStatusLabel(status) {
    if (!status) return '—';
    return STATUS_LABELS[status] || status;
}

export function initShelves({ onStatus, onBooksUpdated }) {
    const subNavButtons = document.querySelectorAll('#subNavigation button[data-view]');
    const shelfSearch = document.getElementById('shelfSearch');
    const shelfGenreFilter = document.getElementById('shelfGenreFilter');
    const shelfSort = document.getElementById('shelfSort');
    const shelvesTableContainer = document.getElementById('shelvesTableContainer');
    const shelfPagination = document.getElementById('shelfPagination');
    const editShelfContainer = document.getElementById('editShelfContainer');
    const bookForm = document.getElementById('bookForm');
    const bookGenresContainer = document.getElementById('bookGenresContainer');
    const bookStatus = document.getElementById('bookStatus');
    const startingField = document.getElementById('startingField');
    const readFields = document.getElementById('readFields');
    let genres = [];
    let activeStatus = 'all';
    let searchQuery = '';
    let selectedGenreId = '';
    let sortKey = shelfSort?.value || 'added';
    let page = 1;
    const perPage = 10;
    let total = 0;
    let loggedIn = false;
    let searchTimer = null;

    function updateAddStatusFields() {
        const status = bookStatus?.value || 'tbr';
        startingField?.classList.toggle('hidden', status !== 'reading' && status !== 'read');
        readFields?.classList.toggle('hidden', status !== 'read');
    }

    function renderGenres() {
        if (shelfGenreFilter) {
            const currentVal = shelfGenreFilter.value;
            shelfGenreFilter.replaceChildren();
            const allOpt = document.createElement('option');
            allOpt.value = '';
            allOpt.textContent = 'All Genres';
            shelfGenreFilter.appendChild(allOpt);

            genres.forEach((g) => {
                const opt = document.createElement('option');
                opt.value = g.id;
                opt.textContent = g.name;
                shelfGenreFilter.appendChild(opt);
            });

            shelfGenreFilter.value = currentVal;
        }

        if (bookGenresContainer) {
            bookGenresContainer.replaceChildren();

            genres.forEach((g) => {
                const label = document.createElement('label');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.name = 'genre_ids';
                checkbox.value = g.id;
                const span = document.createElement('span');
                span.textContent = g.name;
                label.appendChild(checkbox);
                label.appendChild(span);
                bookGenresContainer.appendChild(label);
            });
        }
    }

    function addCell(tr, text) {
        const td = document.createElement('td');
        td.textContent = text ?? '';
        tr.appendChild(td);
        return td;
    }

    function renderBooksTable(items) {
        if (!shelvesTableContainer) return;
        shelvesTableContainer.replaceChildren();

        if (!Array.isArray(items) || items.length === 0) {
            const p = document.createElement('p');
            p.textContent = 'No books found for this view.';
            shelvesTableContainer.appendChild(p);
            return;
        }

        const table = document.createElement('table');
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');

        ['Title', 'Author', 'Genres', 'Pages', 'Status', 'Rating', 'Actions'].forEach((text) => {
            const th = document.createElement('th');
            th.textContent = text;
            headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');

        items.forEach((entry) => {
            const tr = document.createElement('tr');
            const titleTd = document.createElement('td');
            const strong = document.createElement('strong');
            strong.textContent = entry.title ?? '';
            titleTd.appendChild(strong);
            tr.appendChild(titleTd);

            addCell(tr, entry.author || entry.author_name || '');
            addCell(tr, entry.genres || '—');
            addCell(tr, entry.pages ?? '');
            addCell(tr, formatStatusLabel(entry.status));
            addCell(tr, entry.rating ? `${entry.rating}/5` : '—');

            const actionTd = document.createElement('td');
            const editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.className = 'linkBtn';
            editBtn.textContent = 'Edit';
            editBtn.addEventListener('click', () => openEditForm(entry));
            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'deleteBtn';
            deleteBtn.textContent = 'Remove';
            deleteBtn.addEventListener('click', () => deleteShelfEntry(entry));
            actionTd.appendChild(editBtn);
            actionTd.appendChild(deleteBtn);
            tr.appendChild(actionTd);
            tbody.appendChild(tr);
        });

        table.appendChild(tbody);
        shelvesTableContainer.appendChild(table);
    }

    function renderPagination() {
        if (!shelfPagination) return;
        shelfPagination.replaceChildren();

        const totalPages = Math.max(1, Math.ceil((Number(total) || 0) / perPage));
        if (page > totalPages) {
            page = totalPages;
        }

        const prevBtn = document.createElement('button');
        prevBtn.type = 'button';
        prevBtn.textContent = 'Previous';
        prevBtn.disabled = page <= 1;
        prevBtn.addEventListener('click', () => {
            if (page > 1) {
                page -= 1;
                loadShelf();
            }
        });

        const pageLabel = document.createElement('span');
        pageLabel.textContent = ` Page ${page} of ${totalPages} `;
        pageLabel.className = 'pageLabel';
        const nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.textContent = 'Next';
        nextBtn.disabled = page >= totalPages;
        nextBtn.addEventListener('click', () => {
            if (page < totalPages) {
                page += 1;
                loadShelf();
            }
        });

        shelfPagination.appendChild(prevBtn);
        shelfPagination.appendChild(pageLabel);
        shelfPagination.appendChild(nextBtn);
    }

    function cancelEdit() {
        if (!editShelfContainer) return;
        editShelfContainer.replaceChildren();
        editShelfContainer.classList.add('hidden');
    }

    function openEditForm(entry) {
        if (!editShelfContainer || !entry) return;
        editShelfContainer.replaceChildren();
        editShelfContainer.classList.remove('hidden');
        const card = document.createElement('div');
        card.className = 'card';
        const heading = document.createElement('h3');
        heading.textContent = `Edit Shelf Entry: ${entry.title ?? ''}`;
        card.appendChild(heading);
        const form = document.createElement('form');
        const statusLabel = document.createElement('label');
        statusLabel.htmlFor = 'editShelfStatus';
        statusLabel.textContent = 'Status';
        const statusSelect = document.createElement('select');
        statusSelect.id = 'editShelfStatus';
        statusSelect.name = 'status';
        statusSelect.required = true;

        Object.entries(STATUS_LABELS).forEach(([val, labelText]) => {
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = labelText;
            statusSelect.appendChild(opt);
        });
        statusSelect.value = entry.status || 'tbr';
        form.appendChild(statusLabel);
        form.appendChild(statusSelect);
        const startWrap = document.createElement('div');
        const startLabel = document.createElement('label');
        startLabel.htmlFor = 'editDateStarted';
        startLabel.textContent = 'Date Started';
        const startInput = document.createElement('input');
        startInput.id = 'editDateStarted';
        startInput.name = 'date_started';
        startInput.type = 'date';
        startInput.value = entry.date_started ?? '';
        startWrap.appendChild(startLabel);
        startWrap.appendChild(startInput);
        form.appendChild(startWrap);
        const readWrap = document.createElement('div');
        const ratingLabel = document.createElement('label');
        ratingLabel.htmlFor = 'editRating';
        ratingLabel.textContent = 'Rating (1-5)';
        const ratingInput = document.createElement('input');
        ratingInput.id = 'editRating';
        ratingInput.name = 'rating';
        ratingInput.type = 'number';
        ratingInput.min = 1;
        ratingInput.max = 5;
        ratingInput.value = entry.rating ?? '';
        const finishedLabel = document.createElement('label');
        finishedLabel.htmlFor = 'editDateFinished';
        finishedLabel.textContent = 'Date Finished';
        const finishedInput = document.createElement('input');
        finishedInput.id = 'editDateFinished';
        finishedInput.name = 'date_finished';
        finishedInput.type = 'date';
        finishedInput.value = entry.date_finished ?? '';
        readWrap.appendChild(ratingLabel);
        readWrap.appendChild(ratingInput);
        readWrap.appendChild(finishedLabel);
        readWrap.appendChild(finishedInput);
        form.appendChild(readWrap);

        const syncEditFields = () => {
            const current = statusSelect.value;
            startWrap.classList.toggle('hidden', current !== 'reading' && current !== 'read');
            readWrap.classList.toggle('hidden', current !== 'read');
        };
        syncEditFields();
        statusSelect.addEventListener('change', syncEditFields);
        const actionsRow = document.createElement('div');
        const saveBtn = document.createElement('button');
        saveBtn.type = 'submit';
        saveBtn.textContent = 'Save Shelf Changes'
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', cancelEdit);
        actionsRow.appendChild(saveBtn);
        actionsRow.appendChild(cancelBtn);
        form.appendChild(actionsRow);

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!validateForm(form)) return;

            const fd = new FormData(form);
            const chosenStatus = String(fd.get('status') || 'tbr');
            const payload = shelfFields(chosenStatus, (name) => fd.get(name));

            try {
                await api.updateShelfEntry(entry.id, payload);
                cancelEdit();
                onStatus?.('success', 'Shelf entry updated.');
                await loadShelf();
                onBooksUpdated?.();
            } catch (err) {
                onStatus?.('error', err.message || 'Could not update shelf entry.');
            }
        });

        card.appendChild(form);
        editShelfContainer.appendChild(card);
    }

    async function deleteShelfEntry(entry) {
        if (!confirm('Remove from your shelf?')) {
            return;
        }

        try {
            await api.deleteShelfEntry(entry.id);
            onStatus?.('success', 'Removed from your shelf.');
            await loadShelf();
            onBooksUpdated?.();
        } catch (err) {
            onStatus?.('error', err.message || 'Could not remove from shelf.');
        }
    }

    async function loadGenres() {
        try {
            const data = await api.getGenres();
            genres = Array.isArray(data) ? data : data?.genres || [];
            renderGenres();
        } catch (err) {
            onStatus?.('error', err.message || 'Failed to load genres.');
        }
    }

    async function loadShelf() {
        if (!loggedIn) {
            shelvesTableContainer?.replaceChildren();
            const p = document.createElement('p');
            p.textContent = 'Log in to see your shelves.';
            shelvesTableContainer?.appendChild(p);
            shelfPagination?.replaceChildren();
            return;
        }

        try {
            const data = await api.getShelf({
                status: activeStatus,
                search: searchQuery,
                genre_id: selectedGenreId,
                sort: sortKey,
                page,
                per_page: perPage,
            });
            total = Number(data?.total) || 0;

            if ((data?.items || []).length === 0 && page > 1) {
                page -= 1;
                return loadShelf();
            }

            renderBooksTable(data?.items || []);
            renderPagination();

        } catch (err) {
            onStatus?.('error', err.message || 'Failed to load shelf.');
        }
    }

    function setUser(user) {
        loggedIn = Boolean(user);
        page = 1;
        cancelEdit();
        loadShelf();
    }

    subNavButtons.forEach((btn) => {
        btn.addEventListener('click', async () => {
            subNavButtons.forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            activeStatus = btn.dataset.view || 'all';
            page = 1;
            await loadShelf();
        });
    });

    shelfSearch?.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(async () => {
            searchQuery = shelfSearch.value.trim();
            page = 1;
            await loadShelf();
        }, 200);
    });

    shelfGenreFilter?.addEventListener('change', async () => {
        selectedGenreId = shelfGenreFilter.value;
        page = 1;
        await loadShelf();
    });

    shelfSort?.addEventListener('change', async () => {
        sortKey = shelfSort.value || 'added';
        page = 1;
        await loadShelf();
    });

    bookStatus?.addEventListener('change', updateAddStatusFields);

    bookForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!validateForm(bookForm)) return;

        const fd = new FormData(bookForm);
        const checkedGenres = Array.from(
            bookForm.querySelectorAll('input[name="genre_ids"]:checked')
        ).map((cb) => Number(cb.value));

        const chosenStatus = String(fd.get('status') || 'tbr');
        const bookFields = {
            title: String(fd.get('title') || '').trim(),
            author: String(fd.get('author') || '').trim(),
            pages: Number(fd.get('pages')),
            published_year: fd.get('published_year') ? Number(fd.get('published_year')) : null,
            genre_ids: checkedGenres,
        };

        const payload = {
            ...bookFields,
            ...shelfFields(chosenStatus, (name) => fd.get(name)),
        };

        try {
            await api.addBook(payload);
            bookForm.reset();
            updateAddStatusFields();
            onStatus?.('success', 'Book added to library.');
            await loadShelf();
            onBooksUpdated?.();
        } catch (err) {
            onStatus?.('error', err.message || 'Could not add book.');
        }
    });

    updateAddStatusFields();

    return {
        loadGenres,
        loadShelf,
        setUser,
    };
}