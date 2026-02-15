/**
 * Prediction Engine: Forecasts future behavior based on history.
 */

export class PredictionEngine {
    constructor(analytics) {
        this.analytics = analytics;
    }

    // 1. Next Purchase Date
    predictNextPurchase() {
        if (this.analytics.tickets.length < 2) return null;

        // Extract sorted unique dates
        const dates = [...new Set(this.analytics.tickets.map(t => t.date))].sort();

        let gapSum = 0;
        let gaps = [];

        for (let i = 1; i < dates.length; i++) {
            const d1 = new Date(dates[i - 1]);
            const d2 = new Date(dates[i]);
            const diffTime = Math.abs(d2 - d1);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            gaps.push(diffDays);
            gapSum += diffDays;
        }

        const avgFreq = gapSum / gaps.length;
        const lastDate = new Date(dates[dates.length - 1]);
        const nextDate = new Date(lastDate);
        nextDate.setDate(lastDate.getDate() + Math.round(avgFreq));

        return {
            avgFrequency: avgFreq.toFixed(1), // Days
            lastDate: dates[dates.length - 1],
            nextDate: nextDate.toISOString().split('T')[0],
            confidence: gaps.length > 5 ? 'High' : 'Low'
        };
    }

    // 2. Projected Monthly Spend
    predictMonthlySpend() {
        const today = new Date();
        const currentMonth = today.toISOString().substring(0, 7); // YYYY-MM
        const timeData = this.analytics.getTimeAnalysis();

        const currentSpend = timeData.monthly[currentMonth] || 0;
        const dayOfMonth = today.getDate();
        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

        // Simple linear extrapolation
        // Spend / Day * TotalDays
        let projected = 0;
        if (dayOfMonth > 1) {
            projected = (currentSpend / dayOfMonth) * daysInMonth;
        } else {
            // First day? Use last month or avg
            projected = this.getAverageMonthlySpend(timeData.monthly);
        }

        return {
            current: currentSpend,
            projected: projected,
            month: currentMonth
        };
    }

    getAverageMonthlySpend(monthMap) {
        const values = Object.values(monthMap);
        if (values.length === 0) return 0;
        const sum = values.reduce((a, b) => a + b, 0);
        return sum / values.length;
    }

    // 3. Product Recurrence
    predictProductRecurrence(topProducts) {
        // Only analyze top 20 products
        const predictions = [];

        topProducts.slice(0, 20).forEach(prod => {
            // Lowered threshold for MVP/Demo experience
            if (prod.dates.length < 2) return;

            // Calculate gaps
            // Sort dates first (unique)
            const sortedDates = [...new Set(prod.dates)].sort();
            let gapSum = 0;
            let count = 0;

            for (let i = 1; i < sortedDates.length; i++) {
                const d1 = new Date(sortedDates[i - 1]);
                const d2 = new Date(sortedDates[i]);
                const days = (d2 - d1) / (1000 * 60 * 60 * 24);
                gapSum += days;
                count++;
            }

            const avgGap = gapSum / count;
            const lastBuy = new Date(sortedDates[sortedDates.length - 1]);
            const nextBuy = new Date(lastBuy);
            nextBuy.setDate(lastBuy.getDate() + Math.round(avgGap));

            const today = new Date();
            const daysUntil = Math.ceil((nextBuy - today) / (1000 * 60 * 60 * 24));

            predictions.push({
                product: prod.name,
                avgGap: avgGap.toFixed(1),
                nextDate: nextBuy.toISOString().split('T')[0],
                daysUntil: daysUntil,
                status: daysUntil <= 2 ? 'Due Soon' : 'Stocked'
            });
        });

        return predictions.sort((a, b) => a.daysUntil - b.daysUntil);
    }
}
