function parseLocalDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr.trim());
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    return new Date(year, month, day);
}

function dayOfYear(date) {
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const diffMs = date - startOfYear;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

function totalDaysInYear(year) {
    const start = new Date(year, 0, 1);
    const end = new Date(year + 1, 0, 1);
    return Math.round((end - start) / (1000 * 60 * 60 * 24));
}

export function calculatePaceForecast(finishedDates = [], yearlyGoal = 20, referenceDate = new Date()) {
    const goal = Math.max(1, Number(yearlyGoal) || 20);
    const now = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
    const currentYear = now.getFullYear();

    const monthlyCounts = Array(12).fill(0);
    let completedInYear = 0;

    for (const rawDate of Array.isArray(finishedDates) ? finishedDates : []) {
        const parsed = parseLocalDate(rawDate);
        if (!parsed) continue;
        if (parsed.getFullYear() === currentYear) {
            completedInYear += 1;
            monthlyCounts[parsed.getMonth()] += 1;
        }
    }

    const elapsedDays = Math.max(1, dayOfYear(now));
    const daysInYear = totalDaysInYear(currentYear);
    const remainingDays = Math.max(0, daysInYear - elapsedDays);

    // Current daily & monthly pace in the active year
    const booksPerDay = completedInYear / elapsedDays;
    const projectedTotal = Number((booksPerDay * daysInYear).toFixed(1));
    const booksRemaining = Math.max(0, goal - completedInYear);

    // Required pace for the rest of the year (books per month over remaining months)
    const monthsElapsed = now.getMonth() + 1;
    const monthsRemaining = Math.max(1, 12 - monthsElapsed);
    const currentMonthlyPace = Number((completedInYear / monthsElapsed).toFixed(1));
    const neededMonthlyPace = Number((booksRemaining / monthsRemaining).toFixed(1));

    let statusLabel = 'On track';
    if (completedInYear >= goal) {
        statusLabel = 'Goal reached!';
    } else if (projectedTotal < goal) {
        statusLabel = 'Behind pace';
    }

    return {
        year: currentYear,
        goal,
        completedInYear,
        booksRemaining,
        elapsedDays,
        remainingDays,
        currentMonthlyPace,
        neededMonthlyPace,
        projectedTotal,
        onTrack: projectedTotal >= goal || completedInYear >= goal,
        statusLabel,
        monthlyCounts,
    };
}