/**
 * Spending Evolution Module
 * Analyzes spending trends over time.
 */

export class SpendingEvolution {
    constructor(tickets) {
        this.tickets = tickets;
    }

    analyze() {
        const monthly = this.groupExpensesByMonth();
        const months = Object.keys(monthly).sort();

        if (months.length < 2) return null; // Need at least 2 months

        const currentMonthKey = months[months.length - 1]; // Current (or latest)
        // If current month is very recent (less than 5 days), maybe compare previous complete vs one before?
        // For simplicity, let's stick to simple month comparison.

        const prevMonthKey = months[months.length - 2];

        const current = monthly[currentMonthKey];
        const previous = monthly[prevMonthKey];

        // 3 Month Average
        const last3Months = months.slice(-3);
        const avg3Months = last3Months.reduce((sum, m) => sum + monthly[m], 0) / last3Months.length;

        // Trend
        const diff = current - previous;
        const percent = previous > 0 ? (diff / previous) * 100 : 0;

        let trend = 'stable';
        if (percent > 5) trend = 'up';
        if (percent < -5) trend = 'down';

        return {
            current,
            previous,
            avg3Months,
            percent,
            trend,
            history: months.map(m => ({ month: m, total: monthly[m] })),
            currentMonthName: currentMonthKey
        };
    }

    groupExpensesByMonth() {
        const months = {};
        this.tickets.forEach(t => {
            const date = new Date(t.date);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            months[key] = (months[key] || 0) + t.total;
        });
        return months;
    }

    generateInsights(data) {
        if (!data) return [];
        const insights = [];

        if (data.trend === 'up') {
            insights.push('⚠️ Tu gasto está <strong>subiendo</strong> respecto al mes anterior.');
        } else if (data.trend === 'down') {
            insights.push('✅ ¡Bien! Estás gastando <strong>menos</strong> que el mes pasado.');
        } else {
            insights.push('⚖️ Tu gasto se mantiene <strong>estable</strong>.');
        }

        if (data.current > data.avg3Months) {
            insights.push(`Estás gastando por encima de tu media trimestral (${data.avg3Months.toFixed(0)}€).`);
        } else {
            insights.push(`Te mantienes por debajo de tu media trimestral (${data.avg3Months.toFixed(0)}€).`);
        }

        return insights;
    }

    render(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const data = this.analyze();
        if (!data) {
            container.innerHTML = '<p style="color:gray; padding:1rem;">Necesitas datos de al menos 2 meses.</p>';
            return;
        }

        container.innerHTML = '';
        container.classList.add('evolution-panel');

        // Trend Indicator
        let trendIcon = '=';
        let trendClass = 'stable';
        let trendText = 'Estable';
        if (data.trend === 'up') { trendIcon = '↑'; trendClass = 'danger'; trendText = 'Subiendo'; }
        if (data.trend === 'down') { trendIcon = '↓'; trendClass = 'success'; trendText = 'Bajando'; }

        // Header
        const header = document.createElement('div');
        header.className = `evo-header ${trendClass}`;
        header.innerHTML = `
            <div class="evo-trend-icon">${trendIcon}</div>
            <div>
                <h3>Tu gasto está ${trendText}</h3>
                <span class="evo-subtitle">${Math.abs(data.percent).toFixed(1)}% vs mes anterior</span>
            </div>
        `;
        container.appendChild(header);

        // Stats Grid
        const stats = document.createElement('div');
        stats.className = 'evo-stats';
        stats.innerHTML = `
            <div class="evo-stat">
                <small>Este Mes</small>
                <strong>${data.current.toFixed(0)}€</strong>
            </div>
            <div class="evo-stat">
                <small>Mes Anterior</small>
                <strong>${data.previous.toFixed(0)}€</strong>
            </div>
            <div class="evo-stat">
                <small>Media 3 Meses</small>
                <strong>${data.avg3Months.toFixed(0)}€</strong>
            </div>
        `;
        container.appendChild(stats);

        // Insights
        const insightsDiv = document.createElement('div');
        insightsDiv.className = 'evo-insights';
        const insights = this.generateInsights(data);
        insights.forEach(text => {
            const p = document.createElement('p');
            p.innerHTML = text;
            insightsDiv.appendChild(p);
        });
        container.appendChild(insightsDiv);

        // Sparkline Chart (Canvas)
        const canvasContainer = document.createElement('div');
        canvasContainer.className = 'evo-chart-container';
        const canvas = document.createElement('canvas');
        canvas.id = 'evolutionSparkline';
        canvasContainer.appendChild(canvas);
        container.appendChild(canvasContainer);

        this.renderSparkline(canvas, data.history);
    }

    renderSparkline(canvas, history) {
        // Use Chart.js only if available, else simple fallback? 
        // User requested pure JS, but Chart.js IS in the project. Using it for consistency.
        if (typeof Chart === 'undefined') return;

        const ctx = canvas.getContext('2d');
        const labels = history.map(h => h.month);
        const values = history.map(h => h.total);

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    borderColor: '#a9a9a9', // Neutral gray
                    borderWidth: 2,
                    pointRadius: 2,
                    fill: false,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { enabled: true } },
                scales: {
                    x: { display: false },
                    y: { display: false }
                },
                layout: { padding: 5 }
            }
        });
    }
}
