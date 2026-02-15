/**
 * LocalStorage Data Persistence
 */

const STORAGE_KEY = 'antigravity_receipts_v1';

export class Storage {
    constructor() {
        this.cache = this.load();
    }

    load() {
        const raw = localStorage.getItem(STORAGE_KEY);
        try {
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            console.error('Corrupt storage, resetting.', e);
            return [];
        }
    }

    save() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.cache));
    }

    addTicket(ticket) {
        ticket.id = crypto.randomUUID();
        ticket.timestamp = Date.now();
        this.cache.unshift(ticket);
        this.save();
        return ticket;
    }

    deleteTicket(id) {
        this.cache = this.cache.filter(t => t.id !== id);
        this.save();
    }

    clearAll() {
        this.cache = [];
        this.save();
    }

    getAll() {
        return this.cache;
    }

    getStats() {
        const totalExpense = this.cache.reduce((sum, t) => sum + t.total, 0);
        const categories = {};

        // Calculate Current Month Total
        const now = new Date();
        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        let currentMonthTotal = 0;

        this.cache.forEach(ticket => {
            // Category Breakdown
            ticket.items.forEach(item => {
                const cat = item.category || 'Otros';
                categories[cat] = (categories[cat] || 0) + item.price;
            });

            // Monthly Total
            if (ticket.date.startsWith(currentMonthKey)) {
                currentMonthTotal += ticket.total;
            }
        });

        // Top expensive items
        const allItems = this.cache.flatMap(t => t.items);
        allItems.sort((a, b) => b.price - a.price);

        const avgTicket = this.cache.length > 0 ? totalExpense / this.cache.length : 0;

        return {
            totalExpense,
            totalTickets: this.cache.length,
            avgTicket,
            currentMonthTotal,
            categoryBreakdown: categories,
            topItems: allItems.slice(0, 10)
        };
    }

    reclassifyAll(categorizer) {
        let changed = false;
        if (!this.cache || !Array.isArray(this.cache)) return;

        this.cache.forEach(ticket => {
            if (!ticket.items || !Array.isArray(ticket.items)) return;

            ticket.items.forEach(item => {
                if (!item.description) return;
                try {
                    const newCat = categorizer.categorize(item.description);
                    if (newCat !== item.category) {
                        item.category = newCat;
                        changed = true;
                    }
                } catch (e) {
                    console.warn('Error recategorizing item:', item, e);
                }
            });
        });

        if (changed) {
            this.save();
            console.log('Recategorization complete.');
        }
    }
}
