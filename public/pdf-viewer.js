// Coordinate system:
// PDF.js canvas: origin top-left, y increases downward
// pdf-lib: origin bottom-left, y increases upward
// Conversion handled in app.js when building POST params

const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.min.mjs';
const WORKER_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.worker.min.mjs';

let pdfjsLib = null;

async function loadPdfJs() {
  if (pdfjsLib) return pdfjsLib;
  const mod = await import(PDFJS_CDN);
  mod.GlobalWorkerOptions.workerSrc = WORKER_CDN;
  pdfjsLib = mod;
  return pdfjsLib;
}

class PdfViewer {
  constructor(canvasEl) {
    this._canvas = canvasEl;
    this._ctx = canvasEl.getContext('2d');
    this._pdfDoc = null;
    this._currentPage = 0;
    this._scale = 1.5;
    this._viewport = null;
    this.onPageChange = null;
  }

  async loadFile(file) {
    const lib = await loadPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    this._pdfDoc = await lib.getDocument({ data: arrayBuffer }).promise;
    this._currentPage = 0;
    await this.renderPage(0);
  }

  async renderPage(pageNum) {
    if (!this._pdfDoc) return;
    const page = await this._pdfDoc.getPage(pageNum + 1); // PDF.js is 1-indexed
    const viewport = page.getViewport({ scale: this._scale });
    this._viewport = viewport;
    this._currentPage = pageNum;

    this._canvas.width = viewport.width;
    this._canvas.height = viewport.height;

    await page.render({ canvasContext: this._ctx, viewport }).promise;

    if (this.onPageChange) this.onPageChange(this.getPageInfo());
  }

  getPageInfo() {
    if (!this._viewport) return null;
    return {
      pdfWidth: this._viewport.width / this._scale,   // page width in PDF points
      pdfHeight: this._viewport.height / this._scale, // page height in PDF points
      scale: this._scale,
      canvasWidth: this._canvas.width,
      canvasHeight: this._canvas.height,
      currentPage: this._currentPage,
      totalPages: this._pdfDoc?.numPages ?? 0,
    };
  }

  get totalPages() { return this._pdfDoc?.numPages ?? 0; }
  get currentPage() { return this._currentPage; }
}

window.PdfViewer = PdfViewer;
