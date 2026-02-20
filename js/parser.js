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

        // 1. Merchant Detection (More Robust: Search entire text for keywords)
        const establishments = {
            'MERCADONA': [/M\s*E\s*R\s*C\s*A\s*D\s*O\s*N\s*A/i, /M\s*E\s*R\s*K\s*A\s*D\s*O\s*N\s*A/i],
            'CARREFOUR': [/C\s*A\s*R\s*R\s*E\s*F\s*O\s*U\s*R/i, /C\s*F\s*R/i, /C\s*A\s*R\s*E\s*F\s*U\s*R/i],
            'LIDL': [/L\s*I\s*D\s*L/i],
            'ALDI': [/A\s*L\s*D\s*I/i],
            'AHORRAMAS': [/A\s*H\s*O\s*R\s*R\s*A\s*M\s*A\s*S/i],
            'CONSUM': [/C\s*O\s*N\s*S\s*U\s*M/i],
            'DIA': [/\bDI.?A\b/i],
            'EL CORTE INGLES': [/C\s*O\s*R\s*T\s*E\s*I\s*N\s*G\s*L\s*E\s*S/i, /I\.?N\.?G\.?L\.?E\.?S/i],
            'HIPERCOR': [/H\s*I\s*P\s*E\s*R\s*C\s*O\s*R/i],
            'EROSKI': [/E\s*R\s*O\s*S\s*K\s*I/i]
        };

        const fullText = lines.join(' ').toUpperCase();

        // Priority 1: Search for known keywords in the entire text
        for (const [name, regexes] of Object.entries(establishments)) {
            if (regexes.some(rx => rx.test(fullText))) {
                data.merchant = name;
                break;
            }
        }

        // Priority 2: Fallback to first line scanning if still unknown
        if (data.merchant === 'Desconocido') {
            for (let i = 0; i < Math.min(lines.length, 12); i++) {
                const line = lines[i].toUpperCase();
                if (line.length > 3 &&
                    !/\d{2,}/.test(line) &&
                    !/CALLE|AVENIDA|C\/|TLF|TEL:|CIF|NIF|TICKET/i.test(line)) {
                    data.merchant = line.trim();
                    break;
                }
            }
        }

        // 2. Date Detection
        // DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY or variations
        const dateRegex = /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/;
        for (const line of lines) {
            const match = line.match(dateRegex);
            if (match) {
                let [_, day, month, year] = match;
                // Basic validation and normalization
                if (parseInt(month) > 12) { // Swap if it looks like MM/DD
                    [day, month] = [month, day];
                }
                if (year.length === 2) year = '20' + year;
                day = day.padStart(2, '0');
                month = month.padStart(2, '0');
                data.date = `${year}-${month}-${day}`;
                break;
            }
        }

        // 3. Item Extraction
        let calculatedTotal = 0;

        for (const line of lines) {
            // Refined Noise Filtering: Don't skip if it looks like an item but has noise words
            // Usually item lines follow a pattern: Quantity + Name + Price
            if (this.isLikelyItem(line)) {
                // Process as item
            } else if (this.isNoise(line)) {
                continue;
            }

            // NEW: Detect all price-like patterns in the line to find P. Unit
            const allPriceMatches = [...line.matchAll(/(\d+[.,]\d{2,3})/g)];

            if (allPriceMatches.length > 0) {
                // Priority: If multiple prices exist, pick the second-to-last as "P. Unit"
                // Usually: [Qty] [Desc] [P.Unit] [Importe]
                // If only one exists, it's the "Importe".
                let priceIdx = allPriceMatches.length - 1;
                if (allPriceMatches.length >= 2) {
                    priceIdx = allPriceMatches.length - 2; // This is the "P. Unit"
                }

                const rawPrice = allPriceMatches[priceIdx][0];
                const price = this.parsePrice(rawPrice);

                // Description is everything before the FIRST price found
                let description = line.substring(0, allPriceMatches[0].index).trim();

                // Cleanup description
                description = description.replace(/^\d+\s+/, ''); // Remove leading quantities
                description = description.replace(/^\d+/, '').trim();

                // STRICT FILTER: Skip if description or full line matches total, tax or terminal info
                const summaryKeywords = [
                    'TOTAL', 'SUBTOTAL', 'IMPORTE', 'TARJETA', 'EFECTIVO', 'PAGO', 'PAGAR',
                    'IVA', 'I.V.A', 'BASE', 'IMPONIBLE', 'CUOTA', 'RECARGO', 'DESCUENTO',
                    'REDONDEO', 'VALOR', 'OPERACION', 'TERMINAL', 'AUTORIZ', 'COPIA', 'CLIENTE'
                ];
                const upperLine = line.toUpperCase();
                const isSummary = summaryKeywords.some(k => upperLine.includes(k));

                // Exclusion for lines that look like a date or phone number
                const isGarbage = /(\d{2,4}[-/.]\d{2}[-/.]\d{2,4})|(\d{9,})/.test(line);

                if (description.length > 1 && price > 0 && price < 1000 && !isSummary && !isGarbage) {
                    data.items.push({
                        description: description,
                        price: price,
                        category: 'Otros'
                    });

                    // Final amount for consistency check
                    const amountForTotal = this.parsePrice(allPriceMatches[allPriceMatches.length - 1][0]);
                    calculatedTotal += amountForTotal;
                }
            }
        }

        // 4. Total Detection (Fallback if calcs don't match, or just use biggest number)
        // Usually receipts have a "TOTAL" line. 
        const totalKeywords = ['TOTAL', 'IMPORTE', 'PAGAR', 'A PAGAR', 'LIQUIDO'];
        let detectedTotal = 0;

        for (const line of lines) {
            const isTotalLine = totalKeywords.some(k => line.toUpperCase().includes(k)) &&
                !line.toUpperCase().includes('SUBTOTAL');

            if (isTotalLine) {
                const match = line.match(/(\d+[.,]\d{2})/);
                if (match) {
                    detectedTotal = this.parsePrice(match[1]);
                    // If we found a total > 0, we can stop or keep looking for the last one
                }
            }
        }

        data.total = detectedTotal;

        // If explicitly detected total is 0 or way off, use calculated
        // Or if calculated is reasonable but different from detected, prioritize detected if > 0
        if (data.total === 0 || (calculatedTotal > 0 && Math.abs(data.total - calculatedTotal) > 30)) {
            // Pick the larger of the two if both exist, otherwise use what we have
            data.total = Math.max(data.total, parseFloat(calculatedTotal.toFixed(2)));
        }

        // Final sanity check: if total is still 0, use the highest item price
        if (data.total === 0 && data.items.length > 0) {
            data.total = Math.max(...data.items.map(i => i.price));
        }

        return data;
    }

    isLikelyItem(line) {
        // Quantities + Name + Price (e.g. "1 PAN 0,50")
        return /^\d+.+\d+[.,]\d{2}/.test(line);
    }

    isNoise(line) {
        const uppercase = line.toUpperCase();
        // Only filter if the line is JUST noise or contains these and is NOT an item
        const noiseKeywords = ['IVA', 'FACTURA', 'TICKET', 'TELÉFONO', 'GRACIAS', 'C.I.F', 'N.I.F', 'PÁGINA', 'CHANGE', 'CAMBIO', 'ENTREGADO', 'EFECTIVO'];

        // Exact noise line
        if (noiseKeywords.includes(uppercase)) return true;

        // Check if it's a structural field (like date/merchant) that we already handled
        if (uppercase.includes('TOTAL') && !/\d/.test(line)) return true;

        return false;
    }

    parsePrice(priceStr) {
        if (!priceStr) return 0;

        // Remove currency symbols and spaces
        let normalized = priceStr.replace(/[€$£eE]/g, '').trim();

        // Handle common OCR character misreads in numbers
        normalized = normalized.replace(/O/g, '0').replace(/o/g, '0');
        normalized = normalized.replace(/I/g, '1').replace(/l/g, '1').replace(/\|/g, '1');
        normalized = normalized.replace(/S/g, '5').replace(/s/g, '5');
        normalized = normalized.replace(/B/g, '8');
        normalized = normalized.replace(/G/g, '6');
        normalized = normalized.replace(/Z/g, '2');

        // Handle European vs US decimals: 
        // If there's a comma and a dot, the last one is the decimal separator.
        // If there's only a comma, it's likely the decimal separator.
        if (normalized.includes(',') && normalized.includes('.')) {
            const lastComma = normalized.lastIndexOf(',');
            const lastDot = normalized.lastIndexOf('.');
            if (lastComma > lastDot) {
                normalized = normalized.replace(/\./g, '').replace(',', '.');
            } else {
                normalized = normalized.replace(/,/g, '');
            }
        } else if (normalized.includes(',')) {
            normalized = normalized.replace(',', '.');
        }

        // Final cleanup: remove anything that's not a digit or a dot
        normalized = normalized.replace(/[^\d.]/g, '');

        return parseFloat(normalized) || 0;
    }
}
