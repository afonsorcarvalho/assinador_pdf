# PDF Signer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Browser-based PDF signing app — user draws signature, positions it on a PDF page, downloads the signed PDF.

**Architecture:** Express serves static files and a single `POST /sign` endpoint. Frontend uses PDF.js to render/display the PDF, Signature_pad to capture the handwritten signature, and a draggable overlay div to position the signature on the page. The signed PDF streams back from the server and triggers a browser download.

**Tech Stack:** Node.js 20, Express 4, pdf-lib, multer, PDF.js (CDN), signature_pad (CDN), Docker, nginx, Let's Encrypt (certbot)

## Global Constraints

- Node.js >= 20
- No auth (single-user personal tool)
- No server-side file storage — everything transient; signature saved to browser localStorage only
- All coordinates sent to backend are in PDF points (conversion done in frontend)
- PDF.js and signature_pad loaded from CDN in HTML
- Docker target: single container (Node app) + nginx reverse proxy

---

## File Map

| File | Responsibility |
|------|---------------|
| `package.json` | Dependencies and scripts |
| `src/server.js` | Express app — static serving + route wiring |
| `src/sign.js` | `signPdf(pdfBytes, pngBytes, {page,x,y,w,h})` — pure pdf-lib logic |
| `tests/sign.test.js` | Jest tests for sign.js |
| `public/index.html` | Shell HTML — layout, CDN script tags |
| `public/style.css` | Layout, overlay, panels |
| `public/pdf-viewer.js` | PDF.js wrapper — render page, expose page dimensions |
| `public/signature-pad.js` | Signature_pad wrapper — draw, clear, save/load localStorage |
| `public/app.js` | Orchestrator — wires viewer + sig pad + overlay + POST |
| `Dockerfile` | Node 20 image, copies src + public |
| `docker-compose.yml` | Node app + nginx + certbot |
| `nginx/nginx.conf` | Reverse proxy to Node, HTTPS termination |

---

## Task 1: Project Scaffold + Basic Express Server

**Files:**
- Create: `package.json`
- Create: `src/server.js`
- Create: `public/index.html` (skeleton only)

**Interfaces:**
- Produces: `GET /` → serves `public/index.html`; `GET /health` → `{"ok":true}`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "assinador-pdf",
  "version": "1.0.0",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "node --watch src/server.js",
    "test": "jest"
  },
  "dependencies": {
    "express": "^4.19.2",
    "multer": "^1.4.5-lts.1",
    "pdf-lib": "^1.17.1"
  },
  "devDependencies": {
    "jest": "^29.7.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
cd /home/afonso/docker/assinador_pdf && npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 3: Create src/server.js**

```javascript
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`Listening on http://localhost:${PORT}`));

module.exports = app;
```

- [ ] **Step 4: Create public/index.html skeleton**

```html
<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Assinador PDF</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <h1>Assinador PDF</h1>
  <p id="status">Pronto.</p>
</body>
</html>
```

- [ ] **Step 5: Smoke test**

```bash
node src/server.js &
sleep 1
curl -s http://localhost:3000/health
# Expected: {"ok":true}
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/
# Expected: 200
kill %1
```

- [ ] **Step 6: Commit**

```bash
git init
git add package.json package-lock.json src/server.js public/index.html
git commit -m "feat: project scaffold with Express static server"
```

---

## Task 2: PDF Signing Function (TDD)

**Files:**
- Create: `src/sign.js`
- Create: `tests/sign.test.js`

**Interfaces:**
- Produces: `signPdf(pdfBytes: Buffer|Uint8Array, pngBytes: Buffer|Uint8Array, opts: {page: number, x: number, y: number, w: number, h: number}): Promise<Uint8Array>`
  - `page`: 0-indexed page number
  - `x, y`: bottom-left of signature image in PDF points (origin = bottom-left of page)
  - `w, h`: dimensions in PDF points
  - Returns: signed PDF as Uint8Array
  - Throws `Error('Page index out of bounds')` if page >= total pages

- [ ] **Step 1: Write failing tests**

```javascript
// tests/sign.test.js
const { signPdf } = require('../src/sign');
const { PDFDocument } = require('pdf-lib');

// Minimal 1x1 transparent PNG
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

async function makePdf(pageCount = 1) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) doc.addPage([595, 842]);
  return doc.save();
}

test('returns Uint8Array for valid input', async () => {
  const pdf = await makePdf();
  const result = await signPdf(pdf, PNG_1X1, { page: 0, x: 100, y: 100, w: 200, h: 50 });
  expect(result).toBeInstanceOf(Uint8Array);
});

test('result is a valid loadable PDF', async () => {
  const pdf = await makePdf();
  const result = await signPdf(pdf, PNG_1X1, { page: 0, x: 100, y: 100, w: 200, h: 50 });
  const reloaded = await PDFDocument.load(result);
  expect(reloaded.getPageCount()).toBe(1);
});

test('works on second page of multi-page PDF', async () => {
  const pdf = await makePdf(3);
  const result = await signPdf(pdf, PNG_1X1, { page: 2, x: 50, y: 50, w: 100, h: 30 });
  const reloaded = await PDFDocument.load(result);
  expect(reloaded.getPageCount()).toBe(3);
});

test('throws on invalid page index', async () => {
  const pdf = await makePdf(1);
  await expect(signPdf(pdf, PNG_1X1, { page: 5, x: 0, y: 0, w: 10, h: 10 }))
    .rejects.toThrow('Page index out of bounds');
});
```

- [ ] **Step 2: Run tests — verify they FAIL**

```bash
npm test
# Expected: FAIL — "Cannot find module '../src/sign'"
```

- [ ] **Step 3: Implement src/sign.js**

```javascript
const { PDFDocument } = require('pdf-lib');

async function signPdf(pdfBytes, pngBytes, { page, x, y, w, h }) {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();

  if (page < 0 || page >= pages.length) {
    throw new Error('Page index out of bounds');
  }

  const pngImage = await pdfDoc.embedPng(pngBytes);
  pages[page].drawImage(pngImage, { x, y, width: w, height: h });

  return pdfDoc.save();
}

module.exports = { signPdf };
```

- [ ] **Step 4: Run tests — verify they PASS**

```bash
npm test
# Expected: PASS — 4 tests
```

- [ ] **Step 5: Commit**

```bash
git add src/sign.js tests/sign.test.js
git commit -m "feat: pdf signing function with pdf-lib (TDD)"
```

---

## Task 3: POST /sign Endpoint

**Files:**
- Modify: `src/server.js`

**Interfaces:**
- Consumes: `signPdf` from `./sign`
- Produces: `POST /sign` multipart fields: `pdf` (file), `signature` (file), `page` (string int), `x y w h` (string floats) → responds with signed PDF binary, `Content-Type: application/pdf`

- [ ] **Step 1: Add /sign route to server.js**

Replace the entire `src/server.js` with:

```javascript
const express = require('express');
const multer = require('multer');
const path = require('path');
const { signPdf } = require('./sign');

const app = express();
const PORT = process.env.PORT || 3000;
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/sign', upload.fields([{ name: 'pdf', maxCount: 1 }, { name: 'signature', maxCount: 1 }]), async (req, res) => {
  try {
    const pdfBuffer = req.files?.pdf?.[0]?.buffer;
    const sigBuffer = req.files?.signature?.[0]?.buffer;

    if (!pdfBuffer || !sigBuffer) {
      return res.status(400).json({ error: 'Missing pdf or signature file' });
    }

    const page = parseInt(req.body.page ?? '0', 10);
    const x = parseFloat(req.body.x);
    const y = parseFloat(req.body.y);
    const w = parseFloat(req.body.w);
    const h = parseFloat(req.body.h);

    if ([page, x, y, w, h].some(Number.isNaN)) {
      return res.status(400).json({ error: 'Invalid position params' });
    }

    const signedBytes = await signPdf(pdfBuffer, sigBuffer, { page, x, y, w, h });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="signed.pdf"',
      'Content-Length': signedBytes.length,
    });
    res.send(Buffer.from(signedBytes));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Listening on http://localhost:${PORT}`));

module.exports = app;
```

- [ ] **Step 2: Manual test with curl**

Create a test PDF first:
```bash
node -e "
const { PDFDocument } = require('pdf-lib');
PDFDocument.create().then(d => { d.addPage([595,842]); return d.save(); }).then(b => require('fs').writeFileSync('/tmp/test.pdf', b));
"
```

Create a test PNG (1x1 white pixel):
```bash
echo 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' | base64 -d > /tmp/sig.png
```

Start server and test:
```bash
node src/server.js &
sleep 1
curl -s -X POST http://localhost:3000/sign \
  -F "pdf=@/tmp/test.pdf" \
  -F "signature=@/tmp/sig.png" \
  -F "page=0" -F "x=100" -F "y=100" -F "w=200" -F "h=50" \
  -o /tmp/signed.pdf
file /tmp/signed.pdf
# Expected: /tmp/signed.pdf: PDF document
kill %1
```

- [ ] **Step 3: Commit**

```bash
git add src/server.js
git commit -m "feat: POST /sign endpoint with multer multipart upload"
```

---

## Task 4: PDF.js Viewer

**Files:**
- Create: `public/pdf-viewer.js`
- Create: `public/style.css`
- Modify: `public/index.html`

**Interfaces:**
- Produces: `PdfViewer` class:
  ```javascript
  // Constructor
  new PdfViewer(canvasEl)
  // Methods
  viewer.loadFile(file)  // File object → renders page 0
  viewer.renderPage(pageNum)  // 0-indexed
  viewer.getPageInfo()  // → { pdfWidth, pdfHeight, scale, canvasWidth, canvasHeight, currentPage, totalPages }
  // Properties
  viewer.onPageChange = (pageInfo) => {}  // callback after each render
  ```

- [ ] **Step 1: Write public/style.css**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: system-ui, sans-serif;
  background: #f0f0f0;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem;
  gap: 1rem;
}

h1 { font-size: 1.4rem; }

#controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  background: white;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.1);
  width: 100%;
  max-width: 900px;
}

#controls label { font-size: 0.875rem; font-weight: 600; }

button {
  padding: 0.4rem 0.9rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 0.875rem;
}
button:hover { background: #f5f5f5; }
button.primary { background: #2563eb; color: white; border-color: #2563eb; }
button.primary:hover { background: #1d4ed8; }
button:disabled { opacity: 0.4; cursor: default; }

#main-area {
  display: flex;
  gap: 1rem;
  width: 100%;
  max-width: 900px;
}

#pdf-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

#pdf-wrapper {
  position: relative;
  display: inline-block;
  border: 1px solid #ccc;
  background: white;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}

#pdf-canvas { display: block; }

#sig-overlay {
  position: absolute;
  border: 2px dashed #2563eb;
  cursor: move;
  display: none;
  user-select: none;
  background: rgba(37, 99, 235, 0.05);
}

#sig-overlay img {
  width: 100%;
  height: 100%;
  object-fit: fill;
  pointer-events: none;
}

#resize-handle {
  position: absolute;
  right: -6px;
  bottom: -6px;
  width: 12px;
  height: 12px;
  background: #2563eb;
  border-radius: 2px;
  cursor: se-resize;
}

#sig-panel {
  width: 280px;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

#sig-panel h2 { font-size: 1rem; }

#sig-canvas-wrapper {
  border: 1px solid #ccc;
  border-radius: 4px;
  background: white;
  touch-action: none;
}

#sig-canvas { display: block; }

#page-nav {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

#status {
  font-size: 0.8rem;
  color: #666;
  min-height: 1.2em;
}
```

- [ ] **Step 2: Write public/pdf-viewer.js**

```javascript
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
```

- [ ] **Step 3: Update public/index.html with full structure**

```html
<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Assinador PDF</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <h1>Assinador PDF</h1>

  <div id="controls">
    <label>PDF:</label>
    <input type="file" id="pdf-input" accept=".pdf" />
    <span id="page-nav" style="display:none">
      <button id="prev-page">◀</button>
      <span id="page-label">1 / 1</span>
      <button id="next-page">▶</button>
    </span>
    <button id="place-sig-btn" disabled>Colocar assinatura</button>
    <button id="sign-btn" class="primary" disabled>Assinar e descarregar</button>
  </div>

  <div id="main-area">
    <div id="pdf-panel">
      <div id="pdf-wrapper">
        <canvas id="pdf-canvas"></canvas>
        <div id="sig-overlay">
          <img id="sig-preview" src="" alt="assinatura" />
          <div id="resize-handle"></div>
        </div>
      </div>
    </div>

    <div id="sig-panel">
      <h2>Assinatura</h2>
      <div id="sig-canvas-wrapper">
        <canvas id="sig-canvas" width="260" height="130"></canvas>
      </div>
      <div style="display:flex;gap:0.5rem">
        <button id="clear-sig-btn">Limpar</button>
        <button id="save-sig-btn">Guardar</button>
        <button id="load-sig-btn">Carregar guardada</button>
      </div>
      <p id="status">Carregue um PDF para começar.</p>
    </div>
  </div>

  <script src="pdf-viewer.js" type="module"></script>
  <script src="signature-pad.js" type="module"></script>
  <script src="app.js" type="module"></script>
</body>
</html>
```

- [ ] **Step 4: Smoke test in browser**

```bash
node src/server.js &
```

Open `http://localhost:3000` in browser. Upload a PDF. Verify it renders. Close server with `kill %1`.

- [ ] **Step 5: Commit**

```bash
git add public/style.css public/pdf-viewer.js public/index.html
git commit -m "feat: PDF.js viewer with page navigation support"
```

---

## Task 5: Signature Pad

**Files:**
- Create: `public/signature-pad.js`

**Interfaces:**
- Consumes: signature_pad from `https://cdn.jsdelivr.net/npm/signature_pad@4.2.0/dist/signature_pad.umd.min.js` (loaded in HTML before this module)
- Produces: `SigPad` class:
  ```javascript
  new SigPad(canvasEl)
  sigPad.isEmpty()          // → boolean
  sigPad.clear()
  sigPad.getPng()           // → Blob (image/png) or null if empty
  sigPad.getDataUrl()       // → string data:image/png;base64,... or null if empty
  sigPad.saveToStorage()    // saves dataUrl to localStorage key 'saved_signature'
  sigPad.loadFromStorage()  // → boolean (true if loaded)
  ```

- [ ] **Step 1: Add signature_pad CDN to index.html before closing body**

In `public/index.html`, add before `<script src="pdf-viewer.js"`:

```html
  <script src="https://cdn.jsdelivr.net/npm/signature_pad@4.2.0/dist/signature_pad.umd.min.js"></script>
```

The full scripts section at end of body becomes:
```html
  <script src="https://cdn.jsdelivr.net/npm/signature_pad@4.2.0/dist/signature_pad.umd.min.js"></script>
  <script src="pdf-viewer.js" type="module"></script>
  <script src="signature-pad.js" type="module"></script>
  <script src="app.js" type="module"></script>
```

- [ ] **Step 2: Write public/signature-pad.js**

```javascript
const STORAGE_KEY = 'saved_signature';

class SigPad {
  constructor(canvasEl) {
    // SignaturePad is loaded globally via UMD script tag
    this._pad = new SignaturePad(canvasEl, {
      minWidth: 1,
      maxWidth: 3,
      penColor: '#000000',
    });
    this._canvas = canvasEl;
  }

  isEmpty() { return this._pad.isEmpty(); }

  clear() { this._pad.clear(); }

  getPng() {
    if (this._pad.isEmpty()) return null;
    return new Promise(resolve => {
      this._canvas.toBlob(resolve, 'image/png');
    });
  }

  getDataUrl() {
    if (this._pad.isEmpty()) return null;
    return this._canvas.toDataURL('image/png');
  }

  saveToStorage() {
    const dataUrl = this.getDataUrl();
    if (!dataUrl) return;
    localStorage.setItem(STORAGE_KEY, dataUrl);
  }

  loadFromStorage() {
    const dataUrl = localStorage.getItem(STORAGE_KEY);
    if (!dataUrl) return false;
    const img = new Image();
    img.onload = () => {
      this._pad.clear();
      const ctx = this._canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, this._canvas.width, this._canvas.height);
      // Restore pad internal state so isEmpty() returns false
      // We do this by converting canvas back to data points
      this._pad.fromDataURL(dataUrl);
    };
    img.src = dataUrl;
    return true;
  }
}

window.SigPad = SigPad;
```

- [ ] **Step 3: Smoke test**

Start server, open browser. Draw in signature area, click "Guardar", reload page, click "Carregar guardada" — signature reappears.

```bash
node src/server.js
# Open http://localhost:3000 and test manually
```

- [ ] **Step 4: Commit**

```bash
git add public/signature-pad.js public/index.html
git commit -m "feat: signature pad with localStorage save/load"
```

---

## Task 6: Signature Overlay (Drag + Resize)

**Files:**
- Create: `public/overlay.js`

**Interfaces:**
- Produces: `SigOverlay` class:
  ```javascript
  new SigOverlay(wrapperEl, overlayEl, resizeHandleEl)
  overlay.show(sigDataUrl)  // places overlay centered on PDF, shows with signature preview
  overlay.hide()
  overlay.getCanvasRect()   // → {left, top, width, height} in canvas pixels (relative to wrapper)
  overlay.isVisible         // boolean
  ```

- [ ] **Step 1: Write public/overlay.js**

```javascript
class SigOverlay {
  constructor(wrapperEl, overlayEl, resizeHandleEl) {
    this._wrapper = wrapperEl;
    this._overlay = overlayEl;
    this._handle = resizeHandleEl;
    this._dragging = false;
    this._resizing = false;
    this._startX = 0;
    this._startY = 0;
    this._startLeft = 0;
    this._startTop = 0;
    this._startW = 0;
    this._startH = 0;
    this.isVisible = false;

    this._bindEvents();
  }

  show(sigDataUrl) {
    const w = this._wrapper;
    const wRect = w.getBoundingClientRect();
    // Initial size: 30% of wrapper width, proportional height
    const initW = Math.round(wRect.width * 0.3);
    const initH = Math.round(initW * 0.4);
    const initLeft = Math.round((wRect.width - initW) / 2);
    const initTop = Math.round((wRect.height - initH) / 2);

    Object.assign(this._overlay.style, {
      left: initLeft + 'px',
      top: initTop + 'px',
      width: initW + 'px',
      height: initH + 'px',
      display: 'block',
    });

    const img = this._overlay.querySelector('img');
    if (img && sigDataUrl) img.src = sigDataUrl;
    this.isVisible = true;
  }

  hide() {
    this._overlay.style.display = 'none';
    this.isVisible = false;
  }

  getCanvasRect() {
    return {
      left: parseInt(this._overlay.style.left, 10),
      top: parseInt(this._overlay.style.top, 10),
      width: parseInt(this._overlay.style.width, 10),
      height: parseInt(this._overlay.style.height, 10),
    };
  }

  _bindEvents() {
    const overlay = this._overlay;
    const handle = this._handle;

    overlay.addEventListener('mousedown', (e) => {
      if (e.target === handle) return; // handled by resize
      e.preventDefault();
      this._dragging = true;
      this._startX = e.clientX;
      this._startY = e.clientY;
      this._startLeft = parseInt(overlay.style.left, 10);
      this._startTop = parseInt(overlay.style.top, 10);
    });

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._resizing = true;
      this._startX = e.clientX;
      this._startY = e.clientY;
      this._startW = parseInt(overlay.style.width, 10);
      this._startH = parseInt(overlay.style.height, 10);
    });

    document.addEventListener('mousemove', (e) => {
      if (this._dragging) {
        const wRect = this._wrapper.getBoundingClientRect();
        const dx = e.clientX - this._startX;
        const dy = e.clientY - this._startY;
        const newLeft = Math.max(0, Math.min(this._startLeft + dx, wRect.width - parseInt(overlay.style.width, 10)));
        const newTop = Math.max(0, Math.min(this._startTop + dy, wRect.height - parseInt(overlay.style.height, 10)));
        overlay.style.left = newLeft + 'px';
        overlay.style.top = newTop + 'px';
      }
      if (this._resizing) {
        const dx = e.clientX - this._startX;
        const dy = e.clientY - this._startY;
        overlay.style.width = Math.max(40, this._startW + dx) + 'px';
        overlay.style.height = Math.max(20, this._startH + dy) + 'px';
      }
    });

    document.addEventListener('mouseup', () => {
      this._dragging = false;
      this._resizing = false;
    });

    // Touch support
    overlay.addEventListener('touchstart', (e) => {
      if (e.target === handle) return;
      const t = e.touches[0];
      this._dragging = true;
      this._startX = t.clientX;
      this._startY = t.clientY;
      this._startLeft = parseInt(overlay.style.left, 10);
      this._startTop = parseInt(overlay.style.top, 10);
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (!this._dragging) return;
      const t = e.touches[0];
      const wRect = this._wrapper.getBoundingClientRect();
      const dx = t.clientX - this._startX;
      const dy = t.clientY - this._startY;
      const newLeft = Math.max(0, Math.min(this._startLeft + dx, wRect.width - parseInt(overlay.style.width, 10)));
      const newTop = Math.max(0, Math.min(this._startTop + dy, wRect.height - parseInt(overlay.style.height, 10)));
      overlay.style.left = newLeft + 'px';
      overlay.style.top = newTop + 'px';
    }, { passive: true });

    document.addEventListener('touchend', () => { this._dragging = false; });
  }
}

window.SigOverlay = SigOverlay;
```

- [ ] **Step 2: Add overlay.js to index.html scripts**

In `public/index.html`, add before app.js:
```html
  <script src="overlay.js" type="module"></script>
```

Full scripts section:
```html
  <script src="https://cdn.jsdelivr.net/npm/signature_pad@4.2.0/dist/signature_pad.umd.min.js"></script>
  <script src="pdf-viewer.js" type="module"></script>
  <script src="signature-pad.js" type="module"></script>
  <script src="overlay.js" type="module"></script>
  <script src="app.js" type="module"></script>
```

- [ ] **Step 3: Commit**

```bash
git add public/overlay.js public/index.html
git commit -m "feat: draggable/resizable signature overlay on PDF"
```

---

## Task 7: Main App Orchestrator + Sign & Download

**Files:**
- Create: `public/app.js`

**Interfaces:**
- Consumes:
  - `window.PdfViewer` from pdf-viewer.js
  - `window.SigPad` from signature-pad.js
  - `window.SigOverlay` from overlay.js
- Coordinate conversion:
  ```
  # Canvas coords (CSS px, top-left origin) → PDF points (bottom-left origin)
  x_pdf = canvasRect.left / scale
  y_pdf = pdfHeight - (canvasRect.top + canvasRect.height) / scale
  w_pdf = canvasRect.width / scale
  h_pdf = canvasRect.height / scale
  ```

- [ ] **Step 1: Write public/app.js**

```javascript
// Wires together PdfViewer, SigPad, SigOverlay and handles POST /sign

document.addEventListener('DOMContentLoaded', () => {
  const pdfInput    = document.getElementById('pdf-input');
  const pdfCanvas   = document.getElementById('pdf-canvas');
  const pdfWrapper  = document.getElementById('pdf-wrapper');
  const sigOverlay  = document.getElementById('sig-overlay');
  const resizeHand  = document.getElementById('resize-handle');
  const sigCanvas   = document.getElementById('sig-canvas');
  const sigPreview  = document.getElementById('sig-preview');
  const prevBtn     = document.getElementById('prev-page');
  const nextBtn     = document.getElementById('next-page');
  const pageLabel   = document.getElementById('page-label');
  const pageNav     = document.getElementById('page-nav');
  const placeSigBtn = document.getElementById('place-sig-btn');
  const signBtn     = document.getElementById('sign-btn');
  const clearBtn    = document.getElementById('clear-sig-btn');
  const saveBtn     = document.getElementById('save-sig-btn');
  const loadBtn     = document.getElementById('load-sig-btn');
  const statusEl    = document.getElementById('status');

  const viewer  = new PdfViewer(pdfCanvas);
  const sigPad  = new SigPad(sigCanvas);
  const overlay = new SigOverlay(pdfWrapper, sigOverlay, resizeHand);

  let currentPdfFile = null;
  let pageInfo = null;

  function setStatus(msg) { statusEl.textContent = msg; }

  viewer.onPageChange = (info) => {
    pageInfo = info;
    pageLabel.textContent = `${info.currentPage + 1} / ${info.totalPages}`;
    overlay.hide();
    signBtn.disabled = true;
  };

  // Load PDF
  pdfInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    currentPdfFile = file;
    setStatus('A carregar PDF...');
    try {
      await viewer.loadFile(file);
      pageNav.style.display = 'flex';
      placeSigBtn.disabled = false;
      setStatus('PDF carregado. Desenhe a assinatura e clique "Colocar assinatura".');
    } catch (err) {
      setStatus('Erro ao carregar PDF: ' + err.message);
    }
  });

  // Page navigation
  prevBtn.addEventListener('click', async () => {
    if (viewer.currentPage > 0) await viewer.renderPage(viewer.currentPage - 1);
  });
  nextBtn.addEventListener('click', async () => {
    if (viewer.currentPage < viewer.totalPages - 1) await viewer.renderPage(viewer.currentPage + 1);
  });

  // Signature controls
  clearBtn.addEventListener('click', () => sigPad.clear());
  saveBtn.addEventListener('click', () => {
    sigPad.saveToStorage();
    setStatus('Assinatura guardada.');
  });
  loadBtn.addEventListener('click', () => {
    const ok = sigPad.loadFromStorage();
    setStatus(ok ? 'Assinatura carregada.' : 'Nenhuma assinatura guardada.');
  });

  // Place signature overlay
  placeSigBtn.addEventListener('click', () => {
    if (sigPad.isEmpty()) {
      setStatus('Desenhe a assinatura primeiro.');
      return;
    }
    const dataUrl = sigPad.getDataUrl();
    overlay.show(dataUrl);
    signBtn.disabled = false;
    setStatus('Arraste e redimensione a assinatura. Depois clique "Assinar e descarregar".');
  });

  // Sign and download
  signBtn.addEventListener('click', async () => {
    if (!currentPdfFile || !overlay.isVisible || !pageInfo) return;

    const sigBlob = await sigPad.getPng();
    if (!sigBlob) { setStatus('Sem assinatura.'); return; }

    const rect = overlay.getCanvasRect();
    const { scale, pdfHeight } = pageInfo;

    // Convert canvas px coords (top-left origin) → PDF points (bottom-left origin)
    const x = rect.left / scale;
    const y = pdfHeight - (rect.top + rect.height) / scale;
    const w = rect.width / scale;
    const h = rect.height / scale;

    const formData = new FormData();
    formData.append('pdf', currentPdfFile);
    formData.append('signature', sigBlob, 'sig.png');
    formData.append('page', String(pageInfo.currentPage));
    formData.append('x', String(x));
    formData.append('y', String(y));
    formData.append('w', String(w));
    formData.append('h', String(h));

    setStatus('A assinar...');
    signBtn.disabled = true;

    try {
      const response = await fetch('/sign', { method: 'POST', body: formData });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(err.error || response.statusText);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = currentPdfFile.name.replace(/\.pdf$/i, '_assinado.pdf');
      a.click();
      URL.revokeObjectURL(url);
      setStatus('PDF assinado descarregado.');
    } catch (err) {
      setStatus('Erro: ' + err.message);
    } finally {
      signBtn.disabled = false;
    }
  });
});
```

- [ ] **Step 2: End-to-end browser test**

```bash
node src/server.js
```

Test sequence in browser at `http://localhost:3000`:
1. Upload a multi-page PDF → pages render
2. Navigate between pages with ◀ ▶
3. Draw signature in pad
4. Click "Guardar", reload page, click "Carregar guardada" → signature reappears
5. Click "Colocar assinatura" → blue dashed overlay appears on PDF
6. Drag overlay to desired position, drag resize handle to resize
7. Click "Assinar e descarregar" → signed PDF downloads
8. Open downloaded PDF → signature visible at correct position

- [ ] **Step 3: Commit**

```bash
git add public/app.js
git commit -m "feat: full sign flow - overlay placement + POST /sign + download"
```

---

## Task 8: Docker + nginx

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `nginx/nginx.conf`
- Create: `.dockerignore`

**Interfaces:**
- Produces: `docker compose up -d` → app accessible on HTTPS (port 443) with cert from Let's Encrypt

- [ ] **Step 1: Create .dockerignore**

```
node_modules
.git
*.md
docs
tests
```

- [ ] **Step 2: Create Dockerfile**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY public ./public
ENV PORT=3000
EXPOSE 3000
CMD ["node", "src/server.js"]
```

- [ ] **Step 3: Create nginx/nginx.conf**

Replace `yourdomain.com` with actual domain before deploying:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    client_max_body_size 50M;

    location / {
        proxy_pass         http://app:3000;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_read_timeout 60s;
    }
}
```

- [ ] **Step 4: Create docker-compose.yml**

Replace `yourdomain.com` and `your@email.com` before deploying:

```yaml
services:
  app:
    build: .
    restart: unless-stopped
    expose:
      - "3000"

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./certbot/www:/var/www/certbot:ro
      - ./certbot/conf:/etc/letsencrypt:ro
    depends_on:
      - app

  certbot:
    image: certbot/certbot
    volumes:
      - ./certbot/www:/var/www/certbot
      - ./certbot/conf:/etc/letsencrypt
    command: certonly --webroot --webroot-path=/var/www/certbot
             --email your@email.com --agree-tos --no-eff-email
             -d yourdomain.com
    profiles:
      - certbot
```

- [ ] **Step 5: Get initial certificate (run once)**

```bash
mkdir -p certbot/www certbot/conf

# Start nginx on port 80 only (comment out 443 block in nginx.conf first, or use a minimal nginx.conf):
# Minimal nginx.conf for first cert — replace the file temporarily:
cat > nginx/nginx.conf.tmp << 'EOF'
server {
    listen 80;
    server_name yourdomain.com;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 200 'ok'; add_header Content-Type text/plain; }
}
EOF
cp nginx/nginx.conf nginx/nginx.conf.bak
cp nginx/nginx.conf.tmp nginx/nginx.conf

docker compose up -d nginx
docker compose run --rm certbot

# Restore full nginx config with HTTPS:
cp nginx/nginx.conf.bak nginx/nginx.conf
docker compose up -d nginx
```

- [ ] **Step 6: Test full stack**

```bash
docker compose build
docker compose up -d app nginx
curl -s http://yourdomain.com/health   # → redirects to https
curl -sk https://yourdomain.com/health # → {"ok":true}
```

- [ ] **Step 7: Setup cert auto-renewal**

Add to host crontab (`crontab -e`):
```
0 3 * * * cd /path/to/assinador_pdf && docker compose run --rm certbot renew && docker compose exec nginx nginx -s reload
```

- [ ] **Step 8: Commit**

```bash
git add Dockerfile docker-compose.yml nginx/nginx.conf .dockerignore
git commit -m "feat: Docker + nginx + Let's Encrypt deployment config"
```

---

## Self-Review

**Spec coverage:**
- ✅ Express server serving static + POST /sign
- ✅ PDF.js rendering with page navigation
- ✅ Signature_pad capture
- ✅ Signature saved to localStorage
- ✅ Draggable/resizable overlay for positioning
- ✅ Coordinate conversion (canvas px → PDF points)
- ✅ pdf-lib embedding via backend
- ✅ Download signed PDF
- ✅ Docker + nginx + Let's Encrypt
- ✅ No auth (personal use)
- ✅ No server-side storage (transient)

**Placeholder scan:** None found — all steps have full code.

**Type consistency:**
- `PdfViewer.getPageInfo()` → `{pdfWidth, pdfHeight, scale, canvasWidth, canvasHeight, currentPage, totalPages}` — used correctly in app.js
- `SigOverlay.getCanvasRect()` → `{left, top, width, height}` — used correctly in app.js
- `signPdf(pdfBytes, pngBytes, {page, x, y, w, h})` — called correctly from server.js
- `SigPad.getPng()` returns `Promise<Blob>` — awaited correctly in app.js ✅
