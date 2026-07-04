const fs = require("fs");
const path = require("path");

async function test() {
    try {
        const pdfPath = path.join(process.cwd(), "guides", "Designing-The-Future-of-Dispute-Resolution-The-ODR-Policy-Plan-for-India.pdf");
        console.log("Reading PDF from:", pdfPath);
        const dataBuffer = fs.readFileSync(pdfPath);

        // Dynamic import
        const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");



        const loadingTask = pdfjsLib.getDocument({
            data: new Uint8Array(dataBuffer),
            useSystemFonts: true,
            disableFontFace: true
        });

        const pdfDocument = await loadingTask.promise;
        console.log("PDF Loaded, pages:", pdfDocument.numPages);

        let fullText = "";
        for (let i = 1; i <= Math.min(pdfDocument.numPages, 5); i++) {
            const page = await pdfDocument.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(" ");
            fullText += pageText + "\n";
        }

        console.log("Extracted Text Length:", fullText.length);
        console.log("First 100 chars:", fullText.substring(0, 100));
    } catch (error) {
        console.error("PDF Parse Error:", error);
    }
}

test();
