/**
 * Leak Detector Module
 * Analyzes spending habits to find "money leaks" and silent spending.
 */

export class LeakDetector {
    constructor(tickets) {
        this.tickets = tickets;
        this.leaks = [];
        this.stats = {};
    }

    analyze() {
        if (!this.tickets || this.tickets.length === 0) return null;

        const productStats = this.calculateProductStats();
        const silentLeaks = this.detectSilentLeaks(productStats);
        const topSpenders = this.getTopSpenders(productStats);
        const insights = this.generateInsights(productStats, silentLeaks);

        return {
            topSpenders,
            silentLeaks,
            insights
        };
    }

    calculateProductStats() {
        const stats = {};
        let totalDays = 0;

        // Calculate time range to estimate monthly spend
        const dates = this.tickets.map(t => new Date(t.date).getTime());
        if (dates.length > 0) {
            const min = Math.min(...dates);
            const max = Math.max(...dates);
            const diffDays = (max - min) / (1000 * 60 * 60 * 24);
            totalDays = Math.max(diffDays, 1); // Avoid division by zero
        }

        const months = Math.max(totalDays / 30, 1);

        this.tickets.forEach(ticket => {
            ticket.items.forEach(item => {
                const name = item.description.trim().toUpperCase();

                if (!stats[name]) {
                    stats[name] = {
                        name: item.description, // Keep original casing for display
                        totalSpend: 0,
                        count: 0,
                        category: item.category || 'Otros',
                        history: []
                    };
                }

                stats[name].totalSpend += item.price;
                stats[name].count += 1;
                stats[name].history.push({ date: ticket.date, price: item.price });
            });
        });

        // Post-process for averages
        Object.values(stats).forEach(stat => {
            stat.monthlySpend = stat.totalSpend / months;
            stat.avgPrice = stat.totalSpend / stat.count;
            // Detect price trend (simple comparison first vs last)
            if (stat.history.length > 1) {
                // Sort history by date
                stat.history.sort((a, b) => new Date(a.date) - new Date(b.date));
                const first = stat.history[0].price;
                const last = stat.history[stat.history.length - 1].price;
                stat.priceIncrease = last > first;
                stat.priceDiffPercent = first > 0 ? ((last - first) / first) * 100 : 0;
            }
        });

        return stats;
    }

    getTopSpenders(stats) {
        return Object.values(stats)
            .sort((a, b) => b.totalSpend - a.totalSpend)
            .slice(0, 5);
    }

    detectSilentLeaks(stats) {
        // Categories prone to silent leaks
        const riskyCategories = ['Snacks', 'Bebidas', 'Postres', 'Dulces', 'Caprichos', 'Otros'];

        return Object.values(stats)
            .filter(s => {
                // Criteria: Risky category OR High Frequency (> 3 times) AND Significant Monthly Spend (> 5€)
                const isRiskyCat = riskyCategories.some(c => s.category.includes(c));
                return (isRiskyCat || s.count > 3) && s.monthlySpend > 5;
            })
            .sort((a, b) => b.monthlySpend - a.monthlySpend)
            .slice(0, 5);
    }

    generateInsights(stats, leaks) {
        const insights = [];

        // 1. Top Spender Insight
        const top = this.getTopSpenders(stats)[0];
        if (top) {
            insights.push({
                type: 'danger',
                text: `🔥 El producto que más drena tu bolsillo es **${top.name}** (${top.monthlySpend.toFixed(2)}€/mes).`
            });
        }

        // 2. Silent Leaks Insight
        const totalLeakSpend = leaks.reduce((sum, l) => sum + l.monthlySpend, 0);
        if (totalLeakSpend > 20) {
            insights.push({
                type: 'warning',
                text: `💸 Tus "pequeños gastos" (snacks, bebidas...) suman **${totalLeakSpend.toFixed(2)}€/mes**. ¡Cuidado!`
            });
        }

        // 3. Inflation Insight
        const inflated = Object.values(stats).find(s => s.priceIncrease && s.priceDiffPercent > 10 && s.count > 2);
        if (inflated) {
            insights.push({
                type: 'info',
                text: `📈 **${inflated.name}** ha subido un **${inflated.priceDiffPercent.toFixed(0)}%** de precio recientemente.`
            });
        }

        return insights;
    }

    render(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const data = this.analyze();
        if (!data) {
            container.innerHTML = '<p style="color:gray; padding:1rem;">Añade tickets para detectar fugas.</p>';
            return;
        }

        container.innerHTML = '';

        // Header handled in HTML

        // 1. Insights Panel
        const insightsDiv = document.createElement('div');
        insightsDiv.className = 'leak-insights';
        data.insights.forEach(ins => {
            const p = document.createElement('p');
            p.className = `leak-insight ${ins.type}`;
            p.innerHTML = ins.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            insightsDiv.appendChild(p);
        });
        container.appendChild(insightsDiv);

        // 2. Leaks Table
        const table = document.createElement('table');
        table.className = 'simple-table leak-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Producto / Fuga</th>
                    <th>Mensual (Est.)</th>
                    <th>Impacto</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;

        const tbody = table.querySelector('tbody');

        // Combine Silent Leaks + Top Spenders for the table to ensure it's not empty
        let itemsToShow = [...data.silentLeaks];

        // If few leaks, add top spenders that aren't already in list
        if (itemsToShow.length < 5) {
            const existingNames = new Set(itemsToShow.map(i => i.name));
            data.topSpenders.forEach(spender => {
                if (!existingNames.has(spender.name) && itemsToShow.length < 5) {
                    // Mark as "Gasto Alto" instead of leakage if you want, or just generic
                    spender.isTop = true;
                    itemsToShow.push(spender);
                }
            });
        }

        if (itemsToShow.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:1rem; color:gray">No hay suficientes datos para detectar fugas aún.</td></tr>';
        } else {
            itemsToShow.forEach(leak => {
                const tr = document.createElement('tr');

                let impactClass = 'badge-low';
                let impactLabel = 'BAJO';
                if (leak.monthlySpend > 20) { impactClass = 'badge-high'; impactLabel = 'ALTO'; }
                else if (leak.monthlySpend > 10) { impactClass = 'badge-medium'; impactLabel = 'MEDIO'; }

                const tag = leak.isTop ? '<span style="color:var(--text-secondary); font-size:0.7em"> (Top Gasto)</span>' : '';

                tr.innerHTML = `
                    <td>
                        <div style="font-weight:500">${leak.name}${tag}</div>
                        <small style="color:gray">${leak.category}</small>
                    </td>
                    <td><strong>${leak.monthlySpend.toFixed(2)}€</strong></td>
                    <td><span class="badge ${impactClass}">${impactLabel}</span></td>
                `;
                tbody.appendChild(tr);
            });
        }

        container.appendChild(table);
    }
}
