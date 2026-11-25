import { hooks } from './api.js';
import { initAuth } from './auth.js';
import { initShelves } from './shelves.js';
import { initRecommendations } from './recommendations.js';
import { initStats } from './stats.js';

hooks.onLoading = setLoading;

const navButtons = document.querySelectorAll('.navigationBar[aria-label="Main sections"] button[data-view]');
const views = {
    shelves: document.getElementById('viewShelves'),
    add: document.getElementById('viewAdd'),
    next: document.getElementById('viewNext'),
    stats: document.getElementById('viewStats'),
};

const loadingIndicator = document.getElementById('loadingIndicator');
const statusBanner = document.getElementById('statusBanner');

function setLoading(isLoading) {
    loadingIndicator?.classList.toggle('hidden', !isLoading);
}

function showStatus(type, message) {
    if (!statusBanner) return;
    statusBanner.textContent = message;
    statusBanner.classList.remove('hidden', 'success', 'error');
    if (type === 'success' || type === 'error') {
        statusBanner.classList.add(type);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const recsController = initRecommendations({
        onStatus: showStatus,
    });

    const statsController = initStats({
        onStatus: showStatus,
        onGoalUpdated: () => {
            statsController.loadStats();
        },
    });

    const shelvesController = initShelves({
        onStatus: showStatus,
        onBooksUpdated: () => {
            recsController.loadRecommendations();
            statsController.loadStats();
        },
    });

    const authController = initAuth({
        onStatus: showStatus,
        onAuthChange: (user) => {
            shelvesController.setUser(user);
            recsController.setUser(user);
            statsController.setUser(user);
        },
    });

    function switchMainView(viewName) {
        const targetView = views[viewName] ? viewName : 'shelves';

        navButtons.forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.view === targetView);
        });

        Object.entries(views).forEach(([key, section]) => {
            section?.classList.toggle('hidden', key !== targetView);
        });

        if (targetView === 'next') {
            recsController.loadRecommendations();
        } else if (targetView === 'stats') {
            statsController.loadStats();
        } else if (targetView === 'shelves') {
            shelvesController.loadShelf();
        }
    }

    navButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            switchMainView(btn.dataset.view);
        });
    });

    switchMainView('shelves');
    await shelvesController.loadGenres();
    await authController.checkSession();
});

document.addEventListener('DOMContentLoaded', async () => {
    switchMainView('shelves');

    const shelvesController = initShelves({
        onStatus: showStatus,
        onBooksUpdated: () => {},
    });

    const authController = initAuth({
        onStatus: showStatus,
        onAuthChange: (user) => {
            shelvesController.setUser(user);
        },
    });

    await shelvesController.loadGenres();
    await authController.checkSession();
});