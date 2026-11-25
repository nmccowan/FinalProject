//Combines least-squares regression on cumulative monthly completions with a weighted recent 3-month pace to project a low/high year-end range.
function parseLocalDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr.trim());
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    return new Date(year, month, day);
}

//Fits y = m * x + b via ordinary least squares over (x, y) points.
function fitLinearRegression(points) {
    const n = points.length;
    if (n === 0) return { slope: 0, intercept: 0 };
    if (n === 1) return { slope: 0, intercept: points[0].y };

    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (const pt of points) {
        sumX += pt.x;
        sumY += pt.y;
        sumXY += pt.x * pt.y;
        sumXX += pt.x * pt.x;
    }

    const denom = n * sumXX - sumX * sumX;
    if (denom === 0) {
        return { slope: 0, intercept: sumY / n };
    }

    const slope = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;
    return { slope, intercept };
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

    // Build cumulative monthly totals through the current month (1..12)
    const monthsElapsed = Math.max(1, now.getMonth() + 1);
    const monthsRemaining = Math.max(0, 12 - monthsElapsed);
    const booksRemaining = Math.max(0, goal - completedInYear);
    const cumulativeByMonth = [];
    const regressionPoints = [];
    let runningTotal = 0;
    for (let m = 0; m < 12; m++) {
        runningTotal += monthlyCounts[m];
        cumulativeByMonth.push(runningTotal);
        if (m < monthsElapsed) {
            regressionPoints.push({ x: m + 1, y: runningTotal });
        }
    }

    // 1. Ordinary least-squares trend on cumulative books through month 12
    const { slope, intercept } = fitLinearRegression(regressionPoints);
    const regressionDecTotal = Math.max(completedInYear, slope * 12 + intercept);
    const regressionMonthlySlope = Math.max(0, slope);

    // 2. Weighted average of the most recent up-to-3 months (weights: most recent = 3, prior = 2, earlier = 1)
    const windowSize = Math.min(3, monthsElapsed);
    const recentSlice = monthlyCounts.slice(monthsElapsed - windowSize, monthsElapsed);
    const weights = windowSize === 3 ? [1, 2, 3] : windowSize === 2 ? [1, 2] : [1];
    let weightedSum = 0;
    let weightTotal = 0;
    for (let i = 0; i < recentSlice.length; i++) {
        weightedSum += recentSlice[i] * weights[i];
        weightTotal += weights[i];
    }
    const recentWeightedMonthlyPace = weightTotal > 0 ? weightedSum / weightTotal : 0;

    // 3. Blend regression trend (60%) and recent 3-month weighted pace (40%)
    const blendedMonthlyPace = 0.6 * regressionMonthlySlope + 0.4 * recentWeightedMonthlyPace;
    const blendedYearEnd = Math.max(completedInYear,completedInYear + blendedMonthlyPace * monthsRemaining);

    // Build projected cumulative curve for remaining months (index monthsElapsed .. 11)
    const projectedCumulativeByMonth = cumulativeByMonth.map((val, idx) => idx < monthsElapsed - 1 ? val : Number(val.toFixed(1)));
    for (let m = monthsElapsed; m < 12; m++) {
        const stepsAhead = m - (monthsElapsed - 1);
        projectedCumulativeByMonth[m] = Number(Math.max(completedInYear, completedInYear + blendedMonthlyPace * stepsAhead).toFixed(1));
    }

    // 4. Low/high projection range around the blended & regression estimates
    const spread = Math.max(0.5, Math.abs(regressionDecTotal - (completedInYear + recentWeightedMonthlyPace * monthsRemaining)) * 0.5);
    const projectedLow = Number(Math.max(completedInYear, blendedYearEnd - spread).toFixed(1));
    const projectedHigh = Number(Math.max(projectedLow, blendedYearEnd + spread).toFixed(1));
    const projectedTotal = Number(blendedYearEnd.toFixed(1));
    const currentMonthlyPace = Number((completedInYear / monthsElapsed).toFixed(1));
    const neededMonthlyPace = monthsRemaining > 0 ? Number((booksRemaining / monthsRemaining).toFixed(1)) : 0;

    let statusLabel = 'On track';
    if (completedInYear >= goal) {
        statusLabel = 'Goal reached!';
    } else if (projectedHigh < goal) {
        statusLabel = 'Behind pace';
    } else if (projectedLow < goal) {
        statusLabel = 'Borderline';
    }

    return {
        year: currentYear,
        goal,
        completedInYear,
        booksRemaining,
        monthsElapsed,
        monthsRemaining,
        currentMonthlyPace,
        recentWeightedMonthlyPace: Number(recentWeightedMonthlyPace.toFixed(1)),
        neededMonthlyPace,
        projectedTotal,
        projectedLow,
        projectedHigh,
        onTrack: projectedTotal >= goal || completedInYear >= goal,
        statusLabel,
        monthlyCounts,
        cumulativeByMonth,
        projectedCumulativeByMonth,
    };
}