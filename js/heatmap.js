/**
 * Heatmap Visualizer Module
 * Renders a GitHub-style contribution graph for spending habits.
 */

export class HeatmapVisualizer {
    constructor(tickets) {
        this.tickets = tickets;
        this.dailyData = this.groupExpensesByDay();
        // Configuration for intensity levels (can be adaptive in future)
        this.levels = [
            { min: 0, max: 0, class: 'level-0' },       // No spend
            { min: 0.01, max: 20, class: 'level-1' },   // Low
            { min: 20.01, max: 50, class: 'level-2' },  // Medium
            { min: 50.01, max: 100, class: 'level-3' }, // High
            { min: 100.01, max: Infinity, class: 'level-4' } // Extra High
        ];
    }

    groupExpensesByDay() {
        const data = {};
        this.tickets.forEach(ticket => {
            const date = ticket.date; // YYYY-MM-DD
            if (!data[date]) {
                data[date] = {
                    total: 0,
                    count: 0,
                    categories: {},
                    date: date
                };
            }
            data[date].total += ticket.total;
            data[date].count += 1;

            // Track dominant category
            ticket.items.forEach(item => {
                const cat = item.category || 'Otros';
                data[date].categories[cat] = (data[date].categories[cat] || 0) + item.price;
            });
        });
        return data;
    }

    calculateIntensity(amount) {
        if (amount === 0) return 0;
        if (amount <= 20) return 1;
        if (amount <= 50) return 2;
        if (amount <= 100) return 3;
        return 4;
    }

    getDominantCategory(categories) {
        let max = 0;
        let dominant = '-';
        for (const [cat, value] of Object.entries(categories)) {
            if (value > max) {
                max = value;
                dominant = cat;
            }
        }
        return dominant;
    }

    render(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';
        container.classList.add('heatmap-container');

        // Create Grid
        const grid = document.createElement('div');
        grid.className = 'heatmap-grid';

        // Generate last 365 days
        const today = new Date();
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - 364);

        // Adjust alignment: Determine day of week for startDate
        // 0 = Sunday, 1 = Monday, ... 6 = Saturday
        // We want rows to be Sun (row 1) -> Sat (row 7) or Mon (row 1) -> Sun (row 7)?
        // GitHub uses Sunday as row 1. Let's use Sunday (0) as row 1.
        const startDay = startDate.getDay(); // 0-6
        const gridRowStart = startDay + 1; // 1-7 (CSS Grid is 1-based)

        let isFirst = true;

        let currentDate = new Date(startDate);
        while (currentDate <= today) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const dayData = this.dailyData[dateStr] || { total: 0, count: 0, categories: {} };

            const level = this.calculateIntensity(dayData.total);
            const dominantCat = this.getDominantCategory(dayData.categories);

            const cell = document.createElement('div');
            cell.className = `day-cell level-${level}`;
            cell.dataset.date = dateStr;

            // Fix alignment on first cell
            if (isFirst) {
                cell.style.gridRowStart = gridRowStart;
                isFirst = false;
            }

            // Tooltip Logic
            const datePretty = currentDate.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });

            cell.innerHTML = `
                <div class="tooltip">
                    <strong style="text-transform:capitalize">${datePretty}</strong><br>
                    ${dayData.total > 0 ? `Total: ${dayData.total.toFixed(2)}€<br>` : 'Sin compras'}
                    ${dayData.count > 0 ? `${dayData.count} tickets<br>` : ''}
                    ${dayData.total > 0 ? `<span style="opacity:0.8; font-size:0.8em; color:var(--accent)">${dominantCat}</span>` : ''}
                </div>
            `;

            // Add click interaction
            if (dayData.count > 0) {
                cell.addEventListener('click', () => {
                    alert(`Detalle del ${datePretty}:\nTotal: ${dayData.total.toFixed(2)}€\n\n(Funcionalidad de ver tickets por día en desarrollo)`);
                });
            }

            grid.appendChild(cell);

            // Increment day
            currentDate.setDate(currentDate.getDate() + 1);
        }

        container.appendChild(grid);

        // Render Insights
        const insightsPanel = document.createElement('div');
        insightsPanel.className = 'heatmap-insights-panel';
        const insights = this.generateInsights();
        insights.forEach(text => {
            const p = document.createElement('p');
            p.innerHTML = text; // Trusted HTML from generateInsights
            insightsPanel.appendChild(p);
        });
        container.insertBefore(insightsPanel, grid); // Insights on top
    }

    generateInsights() {
        const insights = [];
        const daysOfWeek = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const dayCounts = [0, 0, 0, 0, 0, 0, 0];

        let totalShoppingDays = 0;
        let maxSpend = 0;
        let maxSpendDay = '';

        Object.values(this.dailyData).forEach(d => {
            if (d.total > 0.1) { // significant spend
                const date = new Date(d.date);
                dayCounts[date.getDay()]++;
                totalShoppingDays++;

                if (d.total > maxSpend) {
                    maxSpend = d.total;
                    maxSpendDay = d.date;
                }
            }
        });

        if (totalShoppingDays < 3) {
            insights.push(`<span class="insight-icon">ℹ️</span> Añade más tickets para detectar tus patrones de compra.`);
            return insights;
        }

        // 1. Usual Shopping Day
        let maxDayIndex = 0;
        for (let i = 1; i < 7; i++) {
            if (dayCounts[i] > dayCounts[maxDayIndex]) maxDayIndex = i;
        }

        // If the max day has distinctively more purchases (e.g. > 20% of total)
        if (dayCounts[maxDayIndex] > totalShoppingDays * 0.2) {
            insights.push(`<span class="insight-icon">📅</span> Tu día habitual de compra parece ser el <strong>${daysOfWeek[maxDayIndex]}</strong>.`);
        }

        // 2. High Spender
        if (maxSpend > 100) {
            insights.push(`<span class="insight-icon">💸</span> Tuviste un pico de gasto de <strong>${maxSpend.toFixed(2)}€</strong> el ${new Date(maxSpendDay).toLocaleDateString('es-ES')}.`);
        }

        // 3. Weekend Shopper?
        const weekendCount = dayCounts[0] + dayCounts[6]; // Sun + Sat
        if (weekendCount > totalShoppingDays * 0.5) {
            insights.push(`<span class="insight-icon">🏖️</span> Realizas la mayoría de tus compras en <strong>fin de semana</strong>.`);
        } else if (weekendCount === 0 && totalShoppingDays > 5) {
            insights.push(`<span class="insight-icon">💼</span> Sueles comprar <strong>entre semana</strong>.`);
        }

        return insights.slice(0, 2); // Return top 2
    }
}
