/**
 * OCR Wrapper for Tesseract.js
 */

export class OCRProcessor {
    constructor() {
        this.worker = null;
    }

    async initialize() {
        // Tesseract.js creates a worker automatically when using recognize, 
        // but we can manage it for progress updates if needed.
        // For simplicity in this CDN version, we use Tesseract.recognize directly first.
        console.log('OCR Initialized');
    }

    async processImage(imageSource, onProgress) {
        try {
            const result = await Tesseract.recognize(
                imageSource,
                'spa', // Spanish language for better € and accents support
                {
                    logger: m => {
                        if (onProgress && m.status === 'recognizing text') {
                            onProgress(Math.round(m.progress * 100));
                        }
                    }
                }
            );
            return result.data.text;
        } catch (error) {
            console.error('OCR Error:', error);
            throw error;
        }
    }

    async processPDF(file, onProgress) {
        // Basic PDF processing: Render first page to canvas, then OCR.
        // Deep multi-page PDF support is complex for MVP. 
        // We will do Page 1 only for MVP.

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        const page = await pdf.getPage(1);

        const viewport = page.getViewport({ scale: 2.0 }); // High scale for better OCR
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport: viewport }).promise;

        // Convert canvas to blob/url for Tesseract
        const dataUrl = canvas.toDataURL('image/png');
        return this.processImage(dataUrl, onProgress);
    }
}
