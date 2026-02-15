/**
 * Parser module for extracting structured data from raw receipt text.
 */

export class ReceiptParser {
    constructor() {
        this.currencyRegex = /(\d+[.,]\d{2})\s?€?|(\d+)[.,](\d{2})\s?€?/i;
        // Matches lines that end with a price-like pattern
        this.lineItemRegex = /(.+?)\s+(\d+[.,]\d{2})\s?([€eE])?$/i;
    }

    parse(rawText) {
        const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const data = {
            merchant: 'Desconocido',
            date: new Date().toISOString().split('T')[0],
            total: 0,
            items: []
        };

        // 1. Merchant Detection (Heuristic: First non-numeric, significant line)
        for (let i = 0; i < Math.min(lines.length, 5); i++) {
            const line = lines[i];
            if (line.length > 3 && !/\d/.test(line)) {
                data.merchant = line.toUpperCase();
                break;
            }
        }

        // 2. Date Detection
        // DD/MM/YYYY or DD-MM-YYYY
        const dateRegex = /\b(\d{2})[-/](\d{2})[-/](\d{2,4})\b/;
        for (const line of lines) {
            const match = line.match(dateRegex);
            if (match) {
                // Normalize to YYYY-MM-DD for input[type="date"]
                let [_, day, month, year] = match;
                if (year.length === 2) year = '20' + year;
                data.date = `${year}-${month}-${day}`;
                break;
            }
        }

        // 3. Item Extraction
        let calculatedTotal = 0;

        for (const line of lines) {
            // Filter noise lines
            if (this.isNoise(line)) continue;

            // Attempt to find lines ending in a price
            // We use a flexible regex that looks for space + number + comma/dot + 2 digits at the end
            const priceMatch = line.match(/(\d+[.,]\d{2})\s*(?:[A-Z])?$/);

            if (priceMatch) {
                const rawPrice = priceMatch[1];
                const price = this.parsePrice(rawPrice);

                // Description is everything before the price
                let description = line.substring(0, priceMatch.index).trim();

                // Cleanup description
                description = description.replace(/^\d+\s+/, ''); // Remove leading quantities if separated by space

                if (description.length > 2 && price > 0 && price < 1000) {
                    data.items.push({
                        description: description,
                        price: price,
                        category: 'Otros' // Will be filled by categorizer
                    });
                    calculatedTotal += price;
                }
            }
        }

        // 4. Total Detection (Fallback if calcs don't match, or just use biggest number)
        // Usually receipts have a "TOTAL" line.
        const totalLine = lines.find(l => /TOTAL/i.test(l) && /\d/.test(l));
        if (totalLine) {
            const match = totalLine.match(/(\d+[.,]\d{2})/);
            if (match) {
                data.total = this.parsePrice(match[1]);
            }
        }

        // If explicitly detected total is 0 or way off, use calculated
        if (data.total === 0) {
            data.total = parseFloat(calculatedTotal.toFixed(2));
        }

        return data;
    }

    isNoise(line) {
        const uppercase = line.toUpperCase();
        const noiseKeywords = ['TOTAL', 'IVA', 'SUBTOTAL', 'FACTURA', 'TICKET', 'TELÉFONO', 'GRACIAS', 'C.I.F', 'N.I.F', 'PÁGINA', 'CHANGE', 'CAMBIO', 'ENTREGADO', 'EFECTIVO', 'TARJETA'];
        return noiseKeywords.some(keyword => uppercase.includes(keyword));
    }

    parsePrice(priceStr) {
        // "1.25" -> 1.25
        // "1,25" -> 1.25
        // "1.200,50" -> 1200.50 (European)
        // Simple approach: replace dot with nothing if comma exists, then comma to dot.
        // But Tesseract often confuses . and ,
        // For this MVP, assume standard format \d+[.,]\d{2}

        let normalized = priceStr.replace(',', '.');
        // Fix common OCR errors
        normalized = normalized.replace(/o/gi, '0');
        normalized = normalized.replace(/l/gi, '1');

        return parseFloat(normalized) || 0;
    }
}
