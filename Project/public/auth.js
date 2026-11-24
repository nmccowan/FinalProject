import { api } from './api.js';

export function initAuth({ onAuthChange, onStatus }) {
    const authGuestControls = document.getElementById('authGuestControls');
    const authUserControls = document.getElementById('authUserControls');
    const currentUserLabel = document.getElementById('currentUserLabel');
    const btnToggleAuth = document.getElementById('btnToggleAuth');
    const authPanel = document.getElementById('authPanel');
    const btnCloseAuth = document.getElementById('btnCloseAuth');
    const btnShowRegister = document.getElementById('btnShowRegister');
    const registerPanel = document.getElementById('registerPanel');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const btnLogout = document.getElementById('btnLogout');

    let currentUser = null;

    function renderAuthState(user) {
        currentUser = user || null;

        if (currentUser) {
            authGuestControls?.classList.add('hidden');
            authUserControls?.classList.remove('hidden');
            authPanel?.classList.add('hidden');
            registerPanel?.classList.add('hidden');

            const displayName =
                currentUser.username || currentUser.email || `User #${currentUser.id}`;
            if (currentUserLabel) {
                currentUserLabel.textContent = `Signed in as ${displayName}`;
            }
        } else {
            authUserControls?.classList.add('hidden');
            authGuestControls?.classList.remove('hidden');
            if (currentUserLabel) {
                currentUserLabel.textContent = '';
            }
        }

        if (typeof onAuthChange === 'function') {
            onAuthChange(currentUser);
        }
    }

    btnToggleAuth?.addEventListener('click', () => {
        authPanel?.classList.toggle('hidden');
    });

    btnCloseAuth?.addEventListener('click', () => {
        authPanel?.classList.add('hidden');
        registerPanel?.classList.add('hidden');
    });

    btnShowRegister?.addEventListener('click', () => {
        registerPanel?.classList.toggle('hidden');
    });

    loginForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(loginForm);
        const payload = {
            login: String(formData.get('login') || '').trim(),
            password: String(formData.get('password') || ''),
        };

        try {
            const res = await api.login(payload);
            const user = res?.user || res;
            loginForm.reset();
            renderAuthState(user);
            onStatus?.('success', `Welcome back, ${user?.username || payload.login}!`);
        } catch (err) {
            onStatus?.('error', err.message || 'Login failed.');
        }
    });

    registerForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(registerForm);
        const payload = {
            username: String(formData.get('username') || '').trim(),
            email: String(formData.get('email') || '').trim(),
            password: String(formData.get('password') || ''),
            yearly_goal: Number(formData.get('yearly_goal') || 20),
        };

        try {
            const res = await api.register(payload);
            const user = res?.user || res;
            registerForm.reset();
            registerPanel?.classList.add('hidden');
            renderAuthState(user);
            onStatus?.('success', 'Account created and signed in!');
        } catch (err) {
            onStatus?.('error', err.message || 'Registration failed.');
        }
    });

    btnLogout?.addEventListener('click', async () => {
        try {
            await api.logout();
            renderAuthState(null);
            onStatus?.('success', 'Logged out.');
        } catch (err) {
            onStatus?.('error', err.message || 'Logout failed.');
        }
    });

    async function checkSession() {
        try {
            const res = await api.getSession();
            renderAuthState(res?.user || null);
        } catch {
            renderAuthState(null);
        }
    }

    return {
        checkSession,
        getUser: () => currentUser,
    };
}