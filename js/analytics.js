/**
 * Analytics Engine: Aggregates raw ticket data into statistical models.
 */

export class AnalyticsEngine {
    constructor(tickets) {
        this.tickets = this.sortTickets(tickets);
    }

    sortTickets(tickets) {
        return [...tickets].sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    // 1. Time Analysis
    getTimeAnalysis() {
        if (this.tickets.length === 0) return null;

        const dateMap = {}; // YYYY-MM-DD -> total
        const monthMap = {}; // YYYY-MM -> total
        const dayOfWeekMap = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

        let totalSpend = 0;

        this.tickets.forEach(t => {
            const d = new Date(t.date);
            const ymd = t.date; // already YYYY-MM-DD
            const ym = t.date.substring(0, 7);
            const day = d.getDay();

            dateMap[ymd] = (dateMap[ymd] || 0) + t.total;
            monthMap[ym] = (monthMap[ym] || 0) + t.total;
            dayOfWeekMap[day] += t.total;
            totalSpend += t.total;
        });

        const uniqueDates = Object.keys(dateMap).length;
        const avgTicket = uniqueDates ? totalSpend / this.tickets.length : 0; // Average per visit

        return {
            daily: dateMap,
            monthly: monthMap,
            dayOfWeek: dayOfWeekMap,
            totalSpend,
            ticketCount: this.tickets.length,
            avgTicket
        };
    }

    // 2. Category Analysis
    getCategoryAnalysis() {
        const catMap = {}; // Name -> { total, count, history: { YYYY-MM: val } }

        this.tickets.forEach(t => {
            const ym = t.date.substring(0, 7);
            t.items.forEach(item => {
                const cat = item.category || 'Otros';
                if (!catMap[cat]) {
                    catMap[cat] = { total: 0, count: 0, history: {} };
                }
                catMap[cat].total += item.price;
                catMap[cat].count += 1; // Assuming qty 1 if not parsed
                catMap[cat].history[ym] = (catMap[cat].history[ym] || 0) + item.price;
            });
        });

        // Calculate trends (Simple slope: Last Month vs Avg)
        const categories = Object.entries(catMap).map(([name, data]) => {
            const months = Object.keys(data.history).sort();
            let trend = 0; // 0=flat, 1=up, -1=down

            if (months.length >= 2) {
                const last = data.history[months[months.length - 1]] || 0;
                const prev = data.history[months[months.length - 2]] || 0;
                const change = prev > 0 ? (last - prev) / prev : 0;
                trend = change;
            }

            return {
                name,
                total: data.total,
                count: data.count,
                trend: trend,
                history: data.history
            };
        });

        return categories.sort((a, b) => b.total - a.total);
    }

    // 3. Product Analysis
    getProductAnalysis(categoryFilter = null) { // Added categoryFilter parameter
        const prodMap = {};

        this.tickets.forEach(t => {
            t.items.forEach(item => {
                const itemCat = item.category || 'Otros'; // Use default 'Otros' for category matching.

                // Apply category filter if provided
                if (categoryFilter && itemCat !== categoryFilter) {
                    return;
                }

                // Normalize name heavily
                const name = item.description.trim().toUpperCase();

                // Safety filter for bad parses
                if (name.includes('TOTAL') || name.includes('SUBTOTAL')) return;

                if (!prodMap[name]) {
                    prodMap[name] = {
                        name,
                        total: 0,
                        count: 0,
                        category: item.category,
                        dates: [],
                        maxPrice: 0
                    };
                }
                prodMap[name].total += item.price;
                prodMap[name].count += 1;
                prodMap[name].dates.push(t.date);
                if (item.price > prodMap[name].maxPrice) prodMap[name].maxPrice = item.price;
            });
        });

        return Object.values(prodMap).sort((a, b) => b.total - a.total);
    }

    // 4. Drill-down: Get top products for a category in a specific month (or all time if month null)
    getCategoryDetails(category, monthYYYY) {
        const products = {};

        this.tickets.forEach(t => {
            if (monthYYYY && !t.date.startsWith(monthYYYY)) return;

            t.items.forEach(item => {
                const itemCat = item.category || 'Otros';
                if (itemCat === category) {
                    const name = item.description.trim().toUpperCase();
                    if (!products[name]) products[name] = 0;
                    products[name] += item.price;
                }
            });
        });

        // Convert to array and sort
        return Object.entries(products)
            .map(([name, total]) => ({ name, total }))
            .sort((a, b) => b.total - a.total);
    }
}
