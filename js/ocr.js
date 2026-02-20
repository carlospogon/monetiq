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
            let processedSource = imageSource;

            // Preprocessing: Render to canvas to normalize size and quality if it's a File/Blob
            if (imageSource instanceof File || imageSource instanceof Blob) {
                processedSource = await this.preprocessImage(imageSource);
            }

            const result = await Tesseract.recognize(
                processedSource,
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

    async preprocessImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    // Normalize size: If too large, scale down but keep it high enough for OCR
                    const maxDim = 2000;
                    let width = img.width;
                    let height = img.height;

                    if (width > maxDim || height > maxDim) {
                        if (width > height) {
                            height = (maxDim / width) * height;
                            width = maxDim;
                        } else {
                            width = (maxDim / height) * width;
                            height = maxDim;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;

                    // Simple preprocessing: Draw and convert to grayscale/quality
                    ctx.drawImage(img, 0, 0, width, height);

                    // Note: We could apply more filters here (contrast, thresholding)
                    // but Tesseract.js often prefers original quality with decent resolution.
                    resolve(canvas.toDataURL('image/jpeg', 0.9));
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
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
