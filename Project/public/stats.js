function renderSvgChart(forecast) {
    if (!statsChart) return;
    statsChart.replaceChildren();

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

    statsChart.appendChild(svg);
}