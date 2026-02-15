/**
 * Price Analyzer Module
 * Detects price variations (inflation/deflation) for recurring products.
 */

export class PriceAnalyzer {
    constructor(tickets) {
        // Sort tickets chronologically first
        this.tickets = [...tickets].sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    analyze() {
        const productGroups = this.groupSameProducts();
        const variations = this.calculateVariations(productGroups);

        return {
            variations: this.sortVariations(variations),
            insights: this.generateInsights(variations)
        };
    }

    normalizeProductName(name) {
        return name.trim().toUpperCase().replace(/\s+/g, ' ');
    }

    groupSameProducts() {
        const groups = {};

        this.tickets.forEach(ticket => {
            ticket.items.forEach(item => {
                // Filter noise like TOTAL
                const rawName = item.description.toUpperCase();
                if (rawName.includes('TOTAL') || rawName.includes('SUBTOTAL')) return;

                const name = this.normalizeProductName(item.description);

                if (!groups[name]) {
                    groups[name] = {
                        name: name, // Keep normalized name for grouping
                        originalName: item.description, // Keep one original for display
                        history: []
                    };
                }

                // Add price point
                groups[name].history.push({
                    date: ticket.date,
                    price: item.price
                });
            });
        });

        return groups;
    }

    calculateVariations(groups) {
        const results = [];

        Object.values(groups).forEach(product => {
            // Need at least 2 data points to compare
            if (product.history.length < 2) return;

            // Sort history by date just in case
            product.history.sort((a, b) => new Date(a.date) - new Date(b.date));

            const matchFirst = product.history[0];
            const matchLast = product.history[product.history.length - 1];

            // If prices are identical, maybe skip or show as stable?
            // User wants "Stable" category, so we keep them.

            const firstPrice = matchFirst.price;
            const lastPrice = matchLast.price;

            // Avoid division by zero
            if (firstPrice === 0) return;

            const diff = lastPrice - firstPrice;
            const variationPercent = (diff / firstPrice) * 100;

            let type = 'stable';
            if (variationPercent > 5) type = 'danger';     // > 5%
            else if (variationPercent > 1) type = 'warning'; // 1% - 5%
            else if (variationPercent < -1) type = 'success'; // < -1%
            // else stable (-1% to 1%)

            results.push({
                name: product.originalName,
                firstPrice,
                lastPrice,
                diff,
                percent: variationPercent,
                type, // danger, warning, success, stable
                dates: [matchFirst.date, matchLast.date]
            });
        });

        return results;
    }

    sortVariations(variations) {
        // Sort by absolute variation magnitude (biggest changes first)
        return variations.sort((a, b) => Math.abs(b.percent) - Math.abs(a.percent));
    }

    generateInsights(variations) {
        const insights = [];

        // 1. Inflation Alert
        const highIncreases = variations.filter(v => v.type === 'danger');
        if (highIncreases.length > 0) {
            const top = highIncreases.sort((a, b) => b.percent - a.percent)[0];
            insights.push(`🚨 **${top.name}** ha subido un **${top.percent.toFixed(1)}%** recientemente.`);
        }

        // 2. Deflation / Good News
        const decreases = variations.filter(v => v.type === 'success');
        if (decreases.length > 0) {
            const top = decreases.sort((a, b) => a.percent - b.percent)[0]; // Most negative first
            insights.push(`✅ **${top.name}** ha bajado un **${Math.abs(top.percent).toFixed(1)}%**. ¡Buen momento!`);
        }

        // 3. Overall Stability
        if (highIncreases.length === 0 && decreases.length === 0 && variations.length > 0) {
            insights.push("⚖️ Los precios parecen mantenerse estables.");
        }

        // 4. General Stats
        if (highIncreases.length > 2) {
            insights.push(`📉 Detectamos inflación alta en ${highIncreases.length} productos frecuentes.`);
        }

        return insights.slice(0, 3);
    }
}
