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
            `Current pace: ${forecast.currentMonthlyPace} books/mo (recent 3-mo weighted: ${forecast.recentWeightedMonthlyPace}/mo)`,
            `Projected year-end total: ${forecast.projectedTotal} books (range: ${forecast.projectedLow}–${forecast.projectedHigh})`,
            `Needed pace for remaining ${forecast.monthsRemaining} mo: ${forecast.neededMonthlyPace} books/mo`,
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
        const height = 280;
        const padLeft = 40;
        const padRight = 24;
        const padTop = 28;
        const padBottom = 44;
        const plotW = width - padLeft - padRight;
        const plotH = height - padTop - padBottom;
        const counts = forecast.monthlyCounts;
        const cum = forecast.cumulativeByMonth;
        const proj = forecast.projectedCumulativeByMonth;
        const maxVal = Math.max(4, forecast.goal, ...counts, ...cum, ...proj);
        const xCenter = (idx) => padLeft + (plotW / 12) * idx + (plotW / 12) / 2;
        const yPos = (val) => padTop + plotH - (Math.max(0, val) / maxVal) * plotH;
        const svg = document.createElementNS(svgNs, 'svg');
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.setAttribute('class', 'stats-chart-svg');
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', `Monthly books and cumulative forecast in ${forecast.year}`);

        // Baseline axis
        const axis = document.createElementNS(svgNs, 'line');
        axis.setAttribute('class', 'stats-axis');
        axis.setAttribute('x1', String(padLeft));
        axis.setAttribute('y1', String(padTop + plotH));
        axis.setAttribute('x2', String(width - padRight));
        axis.setAttribute('y2', String(padTop + plotH));
        svg.appendChild(axis);

        // Goal horizontal reference line
        const goalY = yPos(forecast.goal);
        const goalLine = document.createElementNS(svgNs, 'line');
        goalLine.setAttribute('x1', String(padLeft));
        goalLine.setAttribute('y1', String(goalY));
        goalLine.setAttribute('x2', String(width - padRight));
        goalLine.setAttribute('y2', String(goalY));
        goalLine.setAttribute('stroke', 'rgb(72, 97, 219)');
        goalLine.setAttribute('stroke-width', '1.5');
        goalLine.setAttribute('stroke-dasharray', '5 4');
        svg.appendChild(goalLine);
        const goalLabel = document.createElementNS(svgNs, 'text');
        goalLabel.setAttribute('class', 'stats-label');
        goalLabel.setAttribute('x', String(width - padRight - 2));
        goalLabel.setAttribute('y', String(Math.max(12, goalY - 5)));
        goalLabel.setAttribute('text-anchor', 'end');
        goalLabel.textContent = `Goal: ${forecast.goal}`;
        svg.appendChild(goalLabel);

        // Monthly bars + month labels
        const slotWidth = plotW / 12;
        const barWidth = Math.max(14, slotWidth * 0.52);

        counts.forEach((count, idx) => {
            const cx = xCenter(idx);
            const y = yPos(count);
            const barHeight = Math.max(0, padTop + plotH - y);
            const rect = document.createElementNS(svgNs, 'rect');
            rect.setAttribute('class', count > 0 ? 'stats-bar stats-bar--active' : 'stats-bar');
            rect.setAttribute('x', String(cx - barWidth / 2));
            rect.setAttribute('y', String(y));
            rect.setAttribute('width', String(barWidth));
            rect.setAttribute('height', String(barHeight));
            rect.setAttribute('rx', '3');
            svg.appendChild(rect);
            const monthText = document.createElementNS(svgNs, 'text');
            monthText.setAttribute('class', 'stats-label');
            monthText.setAttribute('x', String(cx));
            monthText.setAttribute('y', String(padTop + plotH + 18));
            monthText.textContent = MONTH_LABELS[idx];
            svg.appendChild(monthText);
        });

        // Cumulative actual line (through elapsed months)
        const elapsedIdx = Math.max(0, forecast.monthsElapsed - 1);
        const actualPoints = [];
        for (let i = 0; i <= elapsedIdx; i++) {
            actualPoints.push(`${xCenter(i)},${yPos(cum[i])}`);
        }
        if (actualPoints.length > 1) {
            const actualLine = document.createElementNS(svgNs, 'polyline');
            actualLine.setAttribute('fill', 'none');
            actualLine.setAttribute('stroke', '#1e7e34');
            actualLine.setAttribute('stroke-width', '2.5');
            actualLine.setAttribute('points', actualPoints.join(' '));
            svg.appendChild(actualLine);
        }

        // Projected cumulative line (from current month through December)
        const projPoints = [];
        for (let i = elapsedIdx; i < 12; i++) {
            projPoints.push(`${xCenter(i)},${yPos(proj[i])}`);
        }
        if (projPoints.length > 1) {
            const projLine = document.createElementNS(svgNs, 'polyline');
            projLine.setAttribute('fill', 'none');
            projLine.setAttribute('stroke', '#c5221f');
            projLine.setAttribute('stroke-width', '2');
            projLine.setAttribute('stroke-dasharray', '3 3');
            projLine.setAttribute('points', projPoints.join(' '));
            svg.appendChild(projLine);
        }

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