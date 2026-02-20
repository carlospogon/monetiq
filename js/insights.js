/**
 * Insight Generator: Converts stats into natural language.
 */

export class InsightGenerator {
    static generate(analytics, predictions) {
        const insights = [];

        // 1. Spending Trend
        const monthly = predictions.predictMonthlySpend();
        const monthAvg = predictions.getAverageMonthlySpend(analytics.getTimeAnalysis().monthly);

        if (monthAvg > 0) {
            const diff = monthly.projected - monthAvg;
            const pct = (diff / monthAvg) * 100;

            if (pct > 20) {
                insights.push({
                    type: 'warning',
                    text: `⚠️ **Alerta de Gasto**: Si sigues así, gastarás un **${pct.toFixed(0)}%** más que tu media (**${monthAvg.toFixed(0)}€**) este mes. Haz click para ver detalles.`,
                    action: 'view_savings',
                    data: {
                        projected: monthly.projected,
                        average: monthAvg,
                        current: monthly.current,
                        diff: diff,
                        percent: pct,
                        status: 'warning'
                    }
                });
            } else if (pct < -10) {
                insights.push({
                    type: 'success',
                    text: `📉 **Buen ritmo**: Vas camino de ahorrar un **${Math.abs(pct).toFixed(0)}%** respecto a tu media de **${monthAvg.toFixed(0)}€**. Haz click para expandir.`,
                    action: 'view_savings',
                    data: {
                        projected: monthly.projected,
                        average: monthAvg,
                        current: monthly.current,
                        diff: diff,
                        percent: pct,
                        status: 'success'
                    }
                });
            }
        }

        // 2. Category Anomalies
        const categories = analytics.getCategoryAnalysis();
        const risingCat = categories.find(c => c.trend > 0.3); // >30% growth
        if (risingCat) {
            insights.push({
                type: 'warning', // Changed to warning for visibility
                text: `📈 Tu gasto en **${risingCat.name}** ha crecido drásticamente. Haz click para ver por qué.`,
                action: 'view_category',
                data: { category: risingCat.name }
            });
        }

        // 3. Purchase Frequency
        const nextBuy = predictions.predictNextPurchase();
        if (nextBuy) {
            const days = Math.round(nextBuy.avgFrequency);
            insights.push({
                type: 'neutral',
                text: `🛒 Sueles hacer la compra cada **${days} días**. Toca ir el ${nextBuy.nextDate}.`
            });
        }

        // 4. Product Recurrence
        const prods = analytics.getProductAnalysis();
        const recurring = predictions.predictProductRecurrence(prods);
        const due = recurring.filter(r => r.daysUntil <= 1 && r.daysUntil >= -5); // Due now or slightly late

        if (due.length > 0) {
            const names = due.slice(0, 3).map(p => p.product).join(', ');
            insights.push({
                type: 'action',
                text: `🥛 Es probable que se te termine pronto: **${names}**.`
            });
        }

        // 5. Expensive Items
        if (prods.length > 0) {
            insights.push({
                type: 'neutral',
                text: `💰 Tu producto más caro histórico es **${prods[0].name}** (${prods[0].maxPrice.toFixed(2)}€).`
            });
        }

        return insights;
    }
}
