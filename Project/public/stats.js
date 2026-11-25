import { api } from './api.js';
import { calculatePaceForecast } from './paceForecast.js';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function initStats({ onStatus, onGoalUpdated }) {
    const statsSummary = document.getElementById('statsSummary');
    const paceForecastContainer = document.getElementById('paceForecastContainer');
    const goalForm = document.getElementById('goalForm');
    const goalInput = document.getElementById('yearlyGoal');

    let loggedIn = false;
    let currentGoal = 20;

    function setGoalInputValue(value) {
        if (!goalInput || value == null) return;
        goalInput.value = String(value);
    }

    function renderEmpty(message) {
        if (statsSummary) {
            statsSummary.replaceChildren();
            const p = document.createElement('p');
            p.textContent = message;
            statsSummary.appendChild(p);
        }
        if (paceForecastContainer) {
            paceForecastContainer.replaceChildren();
        }
    }

    function renderSummary(forecast) {
        if (!statsSummary) return;
        statsSummary.replaceChildren();

        const list = document.createElement('ul');
        const items = [
            `Year: ${forecast.year}`,
            `Completed this year: ${forecast.completedInYear} / ${forecast.goal} books (${forecast.booksRemaining} remaining)`,
            `Current pace: ${forecast.currentMonthlyPace} books/month (projected ${forecast.projectedTotal} by year-end)`,
            `Needed pace for rest of year: ${forecast.neededMonthlyPace} books/month`,
            `Status: ${forecast.statusLabel}`,
        ];

        items.forEach((text) => {
            const li = document.createElement('li');
            li.textContent = text;
            list.appendChild(li);
        });

        statsSummary.appendChild(list);
    }

    function renderSvgChart(forecast) {
        if (!paceForecastContainer) return;
        paceForecastContainer.replaceChildren();

        const svgNs = 'http://www.w3.org/2000/svg';
        const width = 640;
        const height = 260;
        const padLeft = 40;
        const padRight = 20;
        const padTop = 24;
        const padBottom = 42;
        const plotW = width - padLeft - padRight;
        const plotH = height - padTop - padBottom;
        const counts = forecast.monthlyCounts;
        const maxCount = Math.max(4, ...counts);
        const slotWidth = plotW / counts.length;
        const barWidth = Math.max(14, slotWidth * 0.58);

        const svg = document.createElementNS(svgNs, 'svg');
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.setAttribute('class', 'stats-chart-svg');
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', `Monthly books finished in ${forecast.year}`);

        const axis = document.createElementNS(svgNs, 'line');
        axis.setAttribute('class', 'stats-axis');
        axis.setAttribute('x1', String(padLeft));
        axis.setAttribute('y1', String(padTop + plotH));
        axis.setAttribute('x2', String(width - padRight));
        axis.setAttribute('y2', String(padTop + plotH));
        svg.appendChild(axis);

        counts.forEach((count, idx) => {
            const barHeight = (count / maxCount) * plotH;
            const x = padLeft + idx * slotWidth + (slotWidth - barWidth) / 2;
            const y = padTop + plotH - barHeight;

            const rect = document.createElementNS(svgNs, 'rect');
            rect.setAttribute('class', count > 0 ? 'stats-bar stats-bar--active' : 'stats-bar');
            rect.setAttribute('x', String(x));
            rect.setAttribute('y', String(y));
            rect.setAttribute('width', String(barWidth));
            rect.setAttribute('height', String(barHeight));
            rect.setAttribute('rx', '3');
            svg.appendChild(rect);

            if (count > 0) {
                const countText = document.createElementNS(svgNs, 'text');
                countText.setAttribute('class', 'stats-label');
                countText.setAttribute('x', String(x + barWidth / 2));
                countText.setAttribute('y', String(Math.max(12, y - 4)));
                countText.textContent = String(count);
                svg.appendChild(countText);
            }

            const monthText = document.createElementNS(svgNs, 'text');
            monthText.setAttribute('class', 'stats-label');
            monthText.setAttribute('x', String(x + barWidth / 2));
            monthText.setAttribute('y', String(padTop + plotH + 18));
            monthText.textContent = MONTH_LABELS[idx];
            svg.appendChild(monthText);
        });

        paceForecastContainer.appendChild(svg);
    }

    async function loadStats() {
        if (!loggedIn) {
            renderEmpty('Log in to view your reading stats and pace forecast.');
            return;
        }

        try {
            const data = await api.getStats();
            const goal = Number(data?.yearly_goal ?? currentGoal) || 20;
            currentGoal = goal;
            setGoalInputValue(goal);

            const finishedDates = Array.isArray(data?.finished_dates) ? data.finished_dates : [];
            const forecast = calculatePaceForecast(finishedDates, goal);

            renderSummary(forecast);
            renderSvgChart(forecast);
        } catch (err) {
            onStatus?.('error', err.message || 'Failed to load reading stats.');
        }
    }

    function setUser(user) {
        loggedIn = Boolean(user);
        if (user && user.yearly_goal != null) {
            currentGoal = Number(user.yearly_goal) || 20;
            setGoalInputValue(currentGoal);
        }
        loadStats();
    }

    goalForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!loggedIn) {
            onStatus?.('error', 'Please log in to update your yearly reading goal.');
            return;
        }

        const fd = new FormData(goalForm);
        const parsedGoal = Number(fd.get('yearly_goal') ?? goalInput?.value);

        if (!Number.isInteger(parsedGoal) || parsedGoal < 1 || parsedGoal > 500) {
            onStatus?.('error', 'Yearly goal must be a whole number between 1 and 500.');
            return;
        }

        try {
            const res = await api.updateGoal(parsedGoal);
            currentGoal = Number(res?.yearly_goal ?? parsedGoal) || parsedGoal;
            setGoalInputValue(currentGoal);
            onStatus?.('success', `Yearly reading goal updated to ${currentGoal}.`);
            await loadStats();
            onGoalUpdated?.(currentGoal);
        } catch (err) {
            onStatus?.('error', err.message || 'Could not update yearly goal.');
        }
    });

    return {
        loadStats,
        setUser,
    };
}