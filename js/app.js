/**
 * Main Application Controller
 */

import { OCRProcessor } from './ocr.js';
import { ReceiptParser } from './parser.js';
import { Categorizer } from './categorizer.js';
import { Storage } from './storage.js';
import { Dashboard } from './dashboard.js';
import { AnalyticsEngine } from './analytics.js';
import { PredictionEngine } from './predictions.js';
import { InsightGenerator } from './insights.js';

import { ProductPredictor } from './product-predictor.js';
import { PriceAnalyzer } from './price-analyzer.js';
import { HeatmapVisualizer } from './heatmap.js';

import { LeakDetector } from './leak-detector.js';
import { SpendingEvolution } from './spending-evolution.js';
import { ShoppingListManager } from './shopping-list.js';

class App {
    // ...

    constructor() {
        this.ocr = new OCRProcessor();
        this.parser = new ReceiptParser();
        this.categorizer = new Categorizer();
        this.storage = new Storage();
        this.dashboard = new Dashboard();
        this.shoppingList = new ShoppingListManager();
        // this.predictor initialized dynamically with tickets

        this.currentTicket = null;
        this.trendChart = null; // Store chart instance

        this.init();
    }

    async init() {
        // Auto-migrate old categories
        try {
            this.storage.reclassifyAll(this.categorizer);
        } catch (error) {
            console.error('Auto-migration failed:', error);
        }

        this.setupNavigation();
        this.setupUpload();

        // Attach listeners ONLY if elements exist to prevent app crash
        const saveBtn = document.getElementById('save-ticket-btn');
        if (saveBtn) saveBtn.addEventListener('click', () => this.saveCurrentTicket());

        const addRowBtn = document.getElementById('add-row-btn');
        if (addRowBtn) addRowBtn.addEventListener('click', () => this.addEmptyRow());

        // Removed stagnant demo-btn and analytics-upload-btn logic

        const clearHistoryBtn = document.getElementById('clear-history-btn');
        if (clearHistoryBtn) {
            clearHistoryBtn.addEventListener('click', () => {
                if (confirm('¿Estás seguro de que quieres BORRAR TODO el historial? Esta acción no se puede deshacer.')) {
                    try {
                        this.storage.clearAll();

                        // Force a complete refresh of all views
                        this.loadHistory();
                        this.loadDashboard();

                        // If we are currently in history view, we stay there, it will show empty msg.
                        // If there were other components needing reset, do it here.

                        alert('Historial eliminado correctamente.');
                    } catch (error) {
                        console.error('Error clearing history:', error);
                        alert('Error al eliminar el historial. Revisa la consola.');
                    }
                }
            });
        }
        else {
            console.error('Clear History Button NOT FOUND');
        }

        const importOcrBtn = document.getElementById('import-ocr-btn');
        if (importOcrBtn) {
            importOcrBtn.addEventListener('click', () => {
                const itemsToImport = this.currentTicket ? this.currentTicket.items : [];
                if (itemsToImport.length === 0) {
                    alert('No hay productos extraídos para importar. Primero procesa un ticket.');
                    return;
                }

                const itemNames = itemsToImport.map(item => item.description);
                this.shoppingList.addItems(itemNames);
                alert(`${itemNames.length} productos procesados e importados a la lista de la compra.`);
            });
        }

        const merchantSelector = document.getElementById('dashboard-merchant-selector');
        if (merchantSelector) {
            merchantSelector.addEventListener('change', () => this.loadDashboard());
        }

        // Initial Render
        try {
            this.loadDashboard();
        } catch (e) {
            console.error('Error loading dashboard on init:', e);
        }
    }

    setupNavigation() {
        const buttons = document.querySelectorAll('.nav-btn');
        const views = document.querySelectorAll('.view');

        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                // Update buttons
                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Show view
                const targetId = btn.dataset.target;
                views.forEach(v => {
                    v.classList.remove('active');
                    v.classList.add('hidden');
                    if (v.id === targetId) {
                        v.classList.remove('hidden');
                        v.classList.add('active');
                    }
                });

                if (targetId === 'dashboard-view') this.loadDashboard();
                if (targetId === 'history-view') this.loadHistory();
                if (targetId === 'analytics-view') this.loadAnalytics();
            });
        });
    }

    setupUpload() {
        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('file-input');

        dropZone.addEventListener('click', () => fileInput.click());
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            if (e.dataTransfer.files.length) {
                this.handleBatch(e.dataTransfer.files);
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length) {
                this.handleBatch(e.target.files);
            }
        });
    }

    async handleBatch(files) {
        // Ensure we switch to upload view to see the workspace
        document.querySelectorAll('.view').forEach(v => {
            v.classList.add('hidden');
            v.classList.remove('active');
        });
        document.getElementById('upload-view').classList.remove('hidden');
        document.getElementById('upload-view').classList.add('active');

        // Update nav buttons
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('[data-target="upload-view"]').classList.add('active');

        document.getElementById('workspace').classList.remove('hidden');
        const statusEl = document.getElementById('ocr-status');
        const previewEl = document.getElementById('image-preview');

        // Reset View
        previewEl.src = '';
        document.getElementById('pdf-preview-info').classList.add('hidden');

        // Accumulate results
        let aggregatedItems = [];
        let totalProcessed = 0;
        let batchTotal = 0;
        let merchants = new Set();
        let dates = new Set();

        // Process File by File
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            statusEl.textContent = `Procesando ${i + 1} de ${files.length}: ${file.name}...`;

            try {
                let text = '';
                const onProgress = (percent) => {
                    statusEl.textContent = `Procesando ${i + 1} de ${files.length}: ${file.name} (${percent}%)`;
                };

                if (file.type.includes('image')) {
                    previewEl.src = URL.createObjectURL(file);
                    text = await this.ocr.processImage(file, onProgress);
                } else if (file.type.includes('pdf')) {
                    document.getElementById('pdf-preview-info').classList.remove('hidden');
                    document.getElementById('pdf-preview-info').textContent = `Procesando PDF: ${file.name}`;
                    text = await this.ocr.processPDF(file, onProgress);
                }

                const rawData = this.parser.parse(text);

                // Auto-categorize
                rawData.items.forEach(item => {
                    item.category = this.categorizer.categorize(item.description);
                });

                // If processing multiple files, save each one immediately
                if (files.length > 1) {
                    this.storage.addTicket(rawData);
                } else {
                    // If it's just one, we keep it in currentTicket to show the editor
                    this.currentTicket = rawData;
                }

                totalProcessed++;

            } catch (err) {
                console.error(`Error processing ${file.name}:`, err);
            }
        }

        if (files.length > 1) {
            statusEl.textContent = `Lote completado. ${totalProcessed} tickets guardados automáticamente.`;
            // Redirect to dashboard or history to see results
            setTimeout(() => {
                document.querySelector('[data-target="dashboard-view"]').click();
            }, 1500);
        } else if (this.currentTicket) {
            statusEl.textContent = `Procesamiento completado. Revisa los datos abajo.`;
            this.renderEditor(this.currentTicket);
        }
    }

    consolidateItems(items) {
        // Group by Description (Approx) + Category
        const groups = {};

        items.forEach(item => {
            const key = `${item.description.trim().toUpperCase()}|${item.category}`;

            if (!groups[key]) {
                groups[key] = {
                    description: item.description,
                    category: item.category,
                    price: 0,
                    count: 0
                };
            }

            groups[key].price += item.price;
            groups[key].count += 1;
        });

        // Convert back to array
        return Object.values(groups).map(g => ({
            description: g.count > 1 ? `${g.description} (x${g.count})` : g.description,
            price: g.price,
            category: g.category
        }));
    }

    async loadDemo() {
        document.getElementById('workspace').classList.remove('hidden');
        document.getElementById('ocr-status').textContent = 'Cargando Demo...';

        try {
            const response = await fetch('assets/demo-ticket.txt');
            const text = await response.text();

            const rawData = this.parser.parse(text);

            // --- SIMULATION HACK: Randomize date for realistic history ---
            const randomDays = Math.floor(Math.random() * 60); // Last 60 days
            const simDate = new Date();
            simDate.setDate(simDate.getDate() - randomDays);
            rawData.date = simDate.toISOString().split('T')[0];
            // -------------------------------------------------------------

            rawData.items.forEach(item => {
                item.category = this.categorizer.categorize(item.description);
            });

            this.currentTicket = rawData;
            this.renderEditor(rawData);

            document.getElementById('ocr-status').textContent = `Demo Cargada (Fecha sim: ${rawData.date})`;
            document.getElementById('image-preview').src = '';
            document.getElementById('pdf-preview-info').textContent = 'Modo Demo (Texto)';
            document.getElementById('pdf-preview-info').classList.remove('hidden');
        } catch (e) { console.error(e); }
    }

    processText(text) {
        const rawData = this.parser.parse(text);
        rawData.items.forEach(item => {
            item.category = this.categorizer.categorize(item.description);
        });

        this.currentTicket = rawData;
        this.renderEditor(rawData);
    }

    renderEditor(data) {
        document.getElementById('merchant-input').value = data.merchant;
        document.getElementById('date-input').value = data.date;
        document.getElementById('total-input').value = data.total.toFixed(2);

        const tbody = document.getElementById('items-table-body');
        tbody.innerHTML = '';

        const sortedItems = [...data.items].sort((a, b) => a.category.localeCompare(b.category));

        sortedItems.forEach((item, index) => {
            this.renderRow(tbody, item, index);
        });
    }

    renderRow(tbody, item, index) {
        const tr = document.createElement('tr');
        const categories = this.categorizer.getCategories();
        const optionsHtml = categories.map(c =>
            `<option value="${c}" ${c === item.category ? 'selected' : ''}>${c}</option>`
        ).join('');

        tr.innerHTML = `
            <td><input type="text" value="${item.description}" class="row-desc"></td>
            <td><input type="number" step="0.01" value="${item.price.toFixed(2)}" class="row-price"></td>
            <td><select class="row-cat">${optionsHtml}</select></td>
            <td><button class="btn-delete-row" style="color:red; background:none; border:none; cursor:pointer;">X</button></td>
        `;

        tr.querySelector('.row-desc').addEventListener('change', (e) => item.description = e.target.value);
        tr.querySelector('.row-price').addEventListener('change', (e) => {
            item.price = parseFloat(e.target.value) || 0;
            this.recalculateTotal();
        });
        tr.querySelector('.row-cat').addEventListener('change', (e) => item.category = e.target.value);
        tr.querySelector('.btn-delete-row').addEventListener('click', () => {
            tr.remove();
            const realIndex = this.currentTicket.items.indexOf(item);
            if (realIndex > -1) this.currentTicket.items.splice(realIndex, 1);
            this.recalculateTotal();
        });

        tbody.appendChild(tr);
    }

    addEmptyRow() {
        if (!this.currentTicket) this.currentTicket = { items: [] };
        const newItem = { description: '', price: 0, category: 'Otros' };
        this.currentTicket.items.push(newItem);
        this.renderRow(document.getElementById('items-table-body'), newItem, this.currentTicket.items.length - 1);
    }

    recalculateTotal() {
        const priceInputs = document.querySelectorAll('.row-price');
        let total = 0;
        priceInputs.forEach(inp => total += parseFloat(inp.value) || 0);

        document.getElementById('total-input').value = total.toFixed(2);
        if (this.currentTicket) this.currentTicket.total = total;
    }

    saveCurrentTicket() {
        const merchant = document.getElementById('merchant-input').value;
        const date = document.getElementById('date-input').value;
        const total = parseFloat(document.getElementById('total-input').value);

        const rows = document.querySelectorAll('#items-table-body tr');
        const items = [];
        rows.forEach(tr => {
            items.push({
                description: tr.querySelector('.row-desc').value,
                price: parseFloat(tr.querySelector('.row-price').value),
                category: tr.querySelector('.row-cat').value,
            });
        });

        const ticket = {
            merchant,
            date,
            total,
            items
        };

        this.storage.addTicket(ticket);
        alert('Ticket Guardado!');
        this.loadHistory();
        this.loadDashboard();
    }

    loadDashboard() {
        const merchantSelector = document.getElementById('dashboard-merchant-selector');
        let selectedMerchant = merchantSelector ? merchantSelector.value : null;

        // Refresh merchant list
        if (merchantSelector) {
            // Keep the first option ("Todos los comercios")
            const firstOption = merchantSelector.options[0];
            merchantSelector.innerHTML = '';
            merchantSelector.appendChild(firstOption);

            const merchants = this.storage.getMerchants();
            merchants.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m;
                opt.textContent = m;
                merchantSelector.appendChild(opt);
            });

            // Restore selection if it still exists
            if (selectedMerchant) {
                const exists = Array.from(merchantSelector.options).some(opt => opt.value === selectedMerchant);
                if (exists) {
                    merchantSelector.value = selectedMerchant;
                } else {
                    selectedMerchant = null; // Revert to global
                }
            }
        }

        const stats = this.storage.getStats(selectedMerchant);
        const allTickets = this.storage.getAll();
        const filteredTickets = selectedMerchant
            ? allTickets.filter(t => t.merchant === selectedMerchant)
            : allTickets;

        // --- 1. Update Financial Status Row (New Grid) ---
        // Score (Mock for now, or based on savings)
        // const scoreEl = document.querySelector('.card-value'); // Too generic, need IDs

        const totalMonthEl = document.getElementById('stats-total-month');
        if (totalMonthEl) {
            totalMonthEl.textContent = stats.currentMonthTotal.toFixed(2) + '€';
            // Add delta mock
            const deltaEl = totalMonthEl.nextElementSibling;
            if (deltaEl && deltaEl.classList.contains('card-delta')) {
                // We could calculate real delta if we had prev month stats here, 
                // but for now let's just show the value.
            }
        }

        const avgTicketEl = document.getElementById('stats-avg-ticket');
        if (avgTicketEl) avgTicketEl.textContent = stats.avgTicket.toFixed(2) + '€';

        // Update Trend Chart (Row 4)
        const timeStats = new AnalyticsEngine(filteredTickets).getTimeAnalysis();
        if (timeStats) {
            this.renderTrendChart(timeStats.monthly);
        } else {
            // Clear chart or show empty state if needed
            const canvas = document.getElementById('trendChart');
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height); // Simple clear
            }
        }

        // --- RESTORED: Main Dashboard KPIs and Charts ---
        if (this.dashboard) {
            this.dashboard.render(stats);
        }

        // --- 2. Probable Next Purchases & Predictions ---
        const predictor = new ProductPredictor(filteredTickets);
        const predictions = predictor.predictNextProducts();

        // Prediction Panel (in Row 2)
        const predictionPanel = document.getElementById('prediction-panel');
        if (predictionPanel) {
            predictionPanel.innerHTML = '';
            if (predictions.length > 0) {
                const p = predictions[0]; // Top prediction
                const days = p.nextEstimatedDays;
                predictionPanel.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <div style="font-weight:700; font-size:1.1rem; color:var(--text-primary)">${p.name}</div>
                            <div style="color:var(--text-secondary); font-size:0.85rem">Probabilidad: ${p.confidence}</div>
                        </div>
                        <div style="text-align:right">
                            <div style="font-weight:700; color:var(--purple); font-size:1.2rem">~${days} días</div>
                            <div style="font-size:0.7rem; color:var(--text-muted)">ESTIMADO</div>
                        </div>
                    </div>
                `;
            } else {
                predictionPanel.innerHTML = '<p style="color:var(--text-muted)">Recopilando datos...</p>';
            }
        }

        // --- 3. Spending Evolution (Row 2) ---
        const spendingEvolution = new SpendingEvolution(filteredTickets);
        spendingEvolution.render('spending-evolution-container');

        // --- 4. Deep Analytics (Row 3) ---

        // Heatmap
        const heatmap = new HeatmapVisualizer(filteredTickets);
        heatmap.render('heatmap-container');

        // Leak Detector
        // Fix: Leak detector might need to clear itself or we clear it here.
        // The render method in leak-detector.js clears container.
        const leakDetector = new LeakDetector(filteredTickets);
        leakDetector.render('leak-detector-box');

        // Price Variation (Optional, if we have a table for it in new design? 
        // It seems it was removed from the main grid in the redesign or needs a place.
        // For now, let's keep it if elements exist, or skip.)
    }

    loadHistory() {
        const list = document.getElementById('history-list');
        list.innerHTML = '';
        const tickets = this.storage.getAll();

        if (tickets.length === 0) {
            list.innerHTML = '<p style="color:gray; text-align:center;">No hay tickets guardados.</p>';
            return;
        }

        tickets.forEach(ticket => {
            const div = document.createElement('div');
            div.className = 'history-item';
            div.innerHTML = `
                <div>
                    <strong>${ticket.merchant}</strong> <br>
                    <small style="color:gray">${ticket.date}</small>
                </div>
                <div style="font-weight:bold; font-size:1.1rem; color: #89d185;">${ticket.total.toFixed(2)} €</div>
                <button class="btn btn-small" data-id="${ticket.id}">Eliminar</button>
            `;

            div.querySelector('button').addEventListener('click', () => {
                if (confirm('¿Borrar ticket?')) {
                    this.storage.deleteTicket(ticket.id);
                    this.loadHistory();
                    this.loadDashboard();
                }
            });
            list.appendChild(div);
        });
    }

    loadAnalytics() {
        const tickets = this.storage.getAll();

        // Ensure UI is cleared if no tickets, or update empty state
        if (tickets.length === 0) {
            document.getElementById('insights-container').innerHTML = '<p style="padding:1rem; color:gray">Sube algunos tickets para ver insights.</p>';
            return;
        }

        const analytics = new AnalyticsEngine(tickets);
        const predictions = new PredictionEngine(analytics);

        // 1. Stats
        const timeStats = analytics.getTimeAnalysis();
        const nextBuy = predictions.predictNextPurchase();
        const monthlyProj = predictions.predictMonthlySpend();

        // --- NEW: Monthly Extremes Analysis ---
        const months = Object.entries(timeStats.monthly);
        if (months.length > 0) {
            // Sort by value to find min/max
            months.sort((a, b) => b[1] - a[1]);

            const maxMonth = months[0];
            const minMonth = months[months.length - 1];

            // Calculate Average Monthly
            const totalMonthly = months.reduce((sum, m) => sum + m[1], 0);
            const avgMonthly = totalMonthly / months.length;

            document.getElementById('month-max-spend').textContent = maxMonth[1].toFixed(2) + ' €';
            document.getElementById('month-max-name').textContent = maxMonth[0]; // YYYY-MM

            document.getElementById('month-min-spend').textContent = minMonth[1].toFixed(2) + ' €';
            document.getElementById('month-min-name').textContent = minMonth[0];

            document.getElementById('month-avg-spend').textContent = avgMonthly.toFixed(2) + ' €';
        }
        // --------------------------------------

        document.getElementById('analytics-avg-ticket').textContent = timeStats.avgTicket.toFixed(2) + ' €';

        if (nextBuy) {
            document.getElementById('pred-next-date').textContent = nextBuy.nextDate;
            document.getElementById('pred-freq').textContent = `Cada ${nextBuy.avgFrequency} días (${nextBuy.confidence})`;
        }

        document.getElementById('pred-month-spend').textContent = monthlyProj.projected.toFixed(2) + ' €';
        const diff = monthlyProj.projected - monthlyProj.current;
        document.getElementById('pred-month-diff').textContent = `Restan aprox: ${diff.toFixed(0)} €`;

        // 2. Insights
        const insights = InsightGenerator.generate(analytics, predictions);
        const container = document.getElementById('insights-container');
        container.innerHTML = '';
        insights.forEach(ins => {
            const card = document.createElement('div');
            card.className = `insight-card ${ins.type}`;
            // Interpret markdown bold for display
            const safeText = ins.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            card.innerHTML = `<p>${safeText}</p>`;

            if (ins.action) {
                card.addEventListener('click', () => this.openInsightModal(ins, analytics));
            }

            container.appendChild(card);
        });

        // 3. Trend Chart
        this.renderTrendChart(timeStats.monthly);

        // ... rest of method
        // 4. Recurring Products
        const prods = analytics.getProductAnalysis();
        const recurring = predictions.predictProductRecurrence(prods);
        const list = document.getElementById('recurring-list');
        list.innerHTML = '';
        recurring.slice(0, 5).forEach(r => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${r.product}</span>
                <span class="${r.status === 'Due Soon' ? 'text-danger' : ''}">${r.daysUntil} días</span>
            `;
            list.appendChild(li);
        });

        // 5. Price Variation Analysis
        const priceAnalyzer = new PriceAnalyzer(tickets);
        const analysis = priceAnalyzer.analyze();

        const priceList = document.getElementById('price-variation-list');
        const priceInsights = document.getElementById('price-insights');

        if (priceList && priceInsights) {
            priceList.innerHTML = '';
            priceInsights.innerHTML = '';

            // Insights
            analysis.insights.forEach(text => {
                const p = document.createElement('p');
                p.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                priceInsights.appendChild(p);
            });

            // Table
            const itemsToShow = analysis.variations.slice(0, 5); // Show top 5 movements
            if (itemsToShow.length === 0) {
                priceList.innerHTML = '<tr><td colspan="4" style="text-align:center; color:gray; padding:1rem;">Necesitas comprar un producto al menos 2 veces (precios distintos) para ver variaciones.</td></tr>';
            } else {
                itemsToShow.forEach(v => {
                    const tr = document.createElement('tr');
                    let badgeClass = 'var-stable';
                    let symbol = '➖';
                    if (v.type === 'danger') { badgeClass = 'var-danger'; symbol = '🔺'; }
                    if (v.type === 'warning') { badgeClass = 'var-warning'; symbol = '↗️'; }
                    if (v.type === 'success') { badgeClass = 'var-success'; symbol = '🔻'; }

                    tr.innerHTML = `
                        <td>${v.name}</td>
                        <td style="color:var(--text-secondary)">${v.firstPrice.toFixed(2)}€</td>
                        <td><strong>${v.lastPrice.toFixed(2)}€</strong></td>
                        <td><span class="var-indicator ${badgeClass}">${symbol} ${v.percent > 0 ? '+' : ''}${v.percent.toFixed(1)}%</span></td>
                     `;
                    priceList.appendChild(tr);
                });
            }
        }

        // 6. Heatmap Analysis
        const heatmap = new HeatmapVisualizer(tickets);
        heatmap.render('heatmap-container');

        // 7. Leak Detector
        const leakDetector = new LeakDetector(tickets);
        leakDetector.render('leak-detector-box');

        // 8. Spending Evolution
        const spendingEvolution = new SpendingEvolution(tickets);
        spendingEvolution.render('spending-evolution-container');

        // Modal Close
        document.querySelector('.close-modal').onclick = () => {
            document.getElementById('insight-modal').classList.add('hidden');
        };
        window.onclick = (event) => {
            const modal = document.getElementById('insight-modal');
            if (event.target == modal) {
                modal.classList.add('hidden');
            }
        };
    }

    openInsightModal(insight, analytics) {
        const modal = document.getElementById('insight-modal');
        const list = document.getElementById('modal-list');
        const title = document.getElementById('modal-title');
        const desc = document.getElementById('modal-desc');

        list.innerHTML = '';
        modal.classList.remove('hidden');

        if (insight.action === 'view_category') {
            const catName = insight.data.category;
            title.textContent = `Análisis: ${catName}`;
            desc.textContent = `Top productos en ${catName} (Histórico):`;

            // Get all time details (pass null for month) to support Demo/Historical data
            const details = analytics.getCategoryDetails(catName, null);

            if (details.length === 0) {
                list.innerHTML = '<li>No hay datos para mostrar.</li>';
            } else {
                details.slice(0, 10).forEach(d => {
                    const li = document.createElement('li');
                    li.innerHTML = `
                        <span>${d.name}</span>
                        <strong>${d.total.toFixed(2)} €</strong>
                    `;
                    list.appendChild(li);
                });
            }
        } else if (insight.action === 'view_savings') {
            const d = insight.data;
            title.textContent = d.status === 'success' ? '🎉 Proyección de Ahorro' : '⚠️ Alerta de Presupuesto';

            const savingAmount = d.average - d.projected;
            const isSaving = savingAmount > 0;

            desc.innerHTML = `
            Comparativa de tu gasto actual proyectado vs tu media histórica mensual.
        `;

            list.innerHTML = `
            <li class="modal-highlight-item">
                <span>Gasto Medio Mensual (Base)</span>
                <strong>${d.average.toFixed(2)} €</strong>
            </li>
            <li class="modal-highlight-item" style="border-bottom: 1px solid #444; margin-bottom: 1rem; padding-bottom: 1rem;">
                <span>Proyección Este Mes</span>
                <strong>${d.projected.toFixed(2)} €</strong>
            </li>
            <li style="font-size: 1.2rem; color: ${isSaving ? '#89d185' : '#f48771'}; text-align: right; width: 100%; display: block;">
                ${isSaving ? 'Ahorro Estimado:' : 'Sobrepasa la media:'} <br>
                <span style="font-size: 2rem; font-weight: bold;">
                    ${Math.abs(savingAmount).toFixed(2)} €
                </span>
                <br>
                <small>${Math.abs(d.percent).toFixed(1)}%</small>
            </li>
            <li style="margin-top: 1rem; color: gray; font-style: italic; font-size: 0.9rem;">
                * Basado en tu ritmo de gasto actual de hoy.
            </li>
        `;
        }
    }

    renderTrendChart(monthlyData) {
        const canvas = document.getElementById('trendChart');
        if (!canvas) return; // Guard clause
        const ctx = canvas.getContext('2d');
        const labels = Object.keys(monthlyData).sort().slice(-6); // Last 6 months
        const data = labels.map(m => monthlyData[m]);

        if (this.trendChart) this.trendChart.destroy();

        this.trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Gasto Mensual',
                    data: data,
                    borderColor: '#007acc',
                    backgroundColor: 'rgba(0, 122, 204, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: '#252a35' },
                        ticks: { color: '#9aa3b2' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#9aa3b2' }
                    }
                }
            }
        });
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
