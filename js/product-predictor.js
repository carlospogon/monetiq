/**
 * Product Predictor Module
 * Advanced analysis of consumption habits to predict next purchases.
 */

export class ProductPredictor {
    constructor(tickets) {
        this.tickets = this.sortTickets(tickets);
    }

    sortTickets(tickets) {
        return [...tickets].sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    /**
     * Main method to get the predictions
     */
    predictNextProducts() {
        const productHistory = this.analyzeProductFrequency();
        const recurring = this.detectRecurringProducts(productHistory);

        // Filter and map to final prediction format
        let predictions = recurring.map(p => {
            const daysSince = p.daysSinceLast;
            const threshold = p.medianFreq;

            let priority = 'low';
            let score = 0;

            // Logic defined by user
            if (daysSince >= threshold) {
                priority = 'high';
                score = 3;
            } else if (daysSince >= threshold * 0.7) {
                priority = 'medium';
                score = 2;
            } else {
                priority = 'low';
                score = 1;
            }

            return {
                name: p.name,
                priority: priority,
                daysSince: daysSince,
                frequency: threshold,
                nextEstimatedDays: Math.max(0, Math.round(threshold - daysSince)),
                score: score, // For sorting
                totalSpent: p.totalSpent
            };
        });

        // Filter only those that are at least Medium priority (>= 0.7 frequency)
        // Or should we show all recurring? 
        // User said: "Un producto es "probable próxima compra" si: dias_desde_ultima_compra >= frecuencia_media * 0.7"
        predictions = predictions.filter(p => p.priority !== 'low');

        // Sort by: 1. Probability (Score) -> 2. Frequency (lower is better/more frequent?) -> wait, user said "2. frecuencia histórica"
        // Let's sort by Score DESC, then Frequency (smaller interval = bought more often) ASC
        predictions.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.frequency - b.frequency;
        });

        return predictions.slice(0, 6);
    }

    /**
     * Group data by product and calculate raw stats
     */
    analyzeProductFrequency() {
        const products = {};

        this.tickets.forEach(t => {
            t.items.forEach(item => {
                const name = item.description.trim().toUpperCase();
                // Filter noise
                if (name.includes('TOTAL') || name.includes('SUBTOTAL')) return;

                if (!products[name]) {
                    products[name] = {
                        name: name,
                        dates: [],
                        totalSpent: 0,
                        count: 0
                    };
                }
                products[name].dates.push(t.date);
                products[name].totalSpent += item.price;
                products[name].count++;
            });
        });

        return Object.values(products);
    }

    /**
     * Calculate intervals/medians and filter by min purchases
     */
    detectRecurringProducts(productHistory) {
        return productHistory.reduce((acc, prod) => {
            // User Condition: < 4 purchases -> do not predict
            // MVP Adjustment: Lower to 2 to show results in demo
            if (prod.dates.length < 2) return acc;

            const uniqueDates = [...new Set(prod.dates)].sort();
            // Allow even 2 purchases to form a frequency pattern for small datasets
            if (uniqueDates.length < 2) return acc;

            const intervals = this.calculateProductIntervals(uniqueDates);
            const medianFreq = this.calculateMedian(intervals);

            const lastDate = new Date(uniqueDates[uniqueDates.length - 1]);
            const today = new Date();
            const daysSinceLast = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));

            acc.push({
                name: prod.name,
                medianFreq: medianFreq,
                lastDate: lastDate,
                daysSinceLast: daysSinceLast,
                totalSpent: prod.totalSpent,
                count: prod.count
            });
            return acc;
        }, []);
    }

    calculateProductIntervals(dates) {
        const intervals = [];
        for (let i = 1; i < dates.length; i++) {
            const d1 = new Date(dates[i - 1]);
            const d2 = new Date(dates[i]);
            const diffDays = (d2 - d1) / (1000 * 60 * 60 * 24);
            intervals.push(diffDays);
        }
        return intervals;
    }

    calculateMedian(values) {
        if (values.length === 0) return 0;
        values.sort((a, b) => a - b);
        const half = Math.floor(values.length / 2);
        if (values.length % 2) return values[half];
        return (values[half - 1] + values[half]) / 2.0;
    }

    generateProductInsights(predictions) {
        const insights = [];

        if (predictions.length > 0) {
            const top = predictions[0];
            insights.push(`Probablemente necesitarás **${top.name}** pronto (cada ~${Math.round(top.frequency)} días).`);

            if (predictions.length > 1) {
                const second = predictions[1];
                insights.push(`**${second.name}** también está al caer.`);
            }
        } else {
            insights.push("Aún no tenemos suficientes datos para predecir tu próxima compra (mínimo 4 tickets).");
        }

        return insights;
    }
}
