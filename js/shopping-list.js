/**
 * Shopping List Manager
 * Handles adding, toggling, and removing products for the shopping list.
 */

export class ShoppingListManager {
    constructor() {
        this.STORAGE_KEY = 'antigravity_shopping_list';
        this.items = this.load();
        this.init();
    }

    init() {
        this.input = document.getElementById('shopping-input');
        this.addButton = document.getElementById('add-shopping-btn');
        this.listElement = document.getElementById('shopping-list');
        this.clearButton = document.getElementById('clear-shopping-btn');

        if (this.addButton) {
            this.addButton.addEventListener('click', () => this.addItem());
        }

        if (this.input) {
            this.input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.addItem();
            });
        }

        if (this.clearButton) {
            this.clearButton.addEventListener('click', () => {
                if (confirm('¿Limpiar toda la lista?')) {
                    this.items = [];
                    this.save();
                    this.render();
                }
            });
        }

        this.render();
    }

    load() {
        const raw = localStorage.getItem(this.STORAGE_KEY);
        try {
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            console.error('Error loading shopping list:', e);
            return [];
        }
    }

    save() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.items));
    }

    addItem() {
        const text = this.input.value.trim();
        if (!text) return;
        this.addItems([text]);
        this.input.value = '';
        this.input.focus();
    }

    addItems(newTexts) {
        if (!newTexts || newTexts.length === 0) return;

        let addedCount = 0;
        const currentTexts = new Set(this.items.map(i => i.text.toUpperCase()));

        newTexts.forEach(text => {
            const cleanText = text.trim();
            if (cleanText && !currentTexts.has(cleanText.toUpperCase())) {
                const newItem = {
                    id: crypto.randomUUID(),
                    text: cleanText,
                    checked: false,
                    timestamp: Date.now()
                };
                this.items.unshift(newItem);
                currentTexts.add(cleanText.toUpperCase());
                addedCount++;
            }
        });

        if (addedCount > 0) {
            this.save();
            this.render();
        }
    }

    toggleItem(id) {
        const item = this.items.find(i => i.id === id);
        if (item) {
            item.checked = !item.checked;
            this.save();
            this.render();
        }
    }

    removeItem(id) {
        this.items = this.items.filter(i => i.id !== id);
        this.save();
        this.render();
    }

    render() {
        if (!this.listElement) return;

        this.listElement.innerHTML = '';

        this.items.forEach(item => {
            const li = document.createElement('li');
            li.className = `shopping-item ${item.checked ? 'checked' : ''}`;

            li.innerHTML = `
                <input type="checkbox" ${item.checked ? 'checked' : ''}>
                <span class="item-text">${item.text}</span>
                <button class="btn-delete-item">×</button>
            `;

            li.querySelector('input').addEventListener('change', () => this.toggleItem(item.id));
            li.querySelector('.btn-delete-item').addEventListener('click', () => this.removeItem(item.id));

            this.listElement.appendChild(li);
        });
    }
}
