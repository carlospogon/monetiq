/**
 * Dashboard Controller using Chart.js
 */

export class Dashboard {
    constructor() {
        this.chart = null;
    }

    render(stats) {
        // Update KPI Cards
        document.getElementById('total-expense').textContent = stats.totalExpense.toFixed(2) + ' €';
        document.getElementById('total-tickets').textContent = stats.totalTickets;

        // Find top category
        let maxCat = '-';
        let maxVal = 0;
        for (const [cat, val] of Object.entries(stats.categoryBreakdown)) {
            if (val > maxVal) {
                maxVal = val;
                maxCat = cat;
            }
        }
        document.getElementById('top-category').textContent = maxCat;

        // Render Chart
        this.renderChart(stats.categoryBreakdown);

        // Render Top List
        this.renderTopList(stats.topItems);
    }

    renderChart(data) {
        const ctx = document.getElementById('categoryChart').getContext('2d');
        const labels = Object.keys(data);
        const values = Object.values(data);
        const backgroundColors = [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40',
            '#e7e9ed', '#71B37C', '#EC932F', '#5D6D7E'
        ];

        if (this.chart) {
            this.chart.destroy();
        }

        this.chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: backgroundColors,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { color: '#e0e0e0' }
                    }
                }
            }
        });
    }

    renderTopList(items) {
        const list = document.getElementById('top-expensive-list');
        list.innerHTML = '';

        items.slice(0, 5).forEach(item => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${item.description}</span>
                <span style="font-weight:bold">${item.price.toFixed(2)} €</span>
            `;
            list.appendChild(li);
        });
    }
}
