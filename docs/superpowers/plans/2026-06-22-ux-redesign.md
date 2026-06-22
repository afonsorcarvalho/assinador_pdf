# UX Redesign — Assinador PDF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the frontend with a professional neutral theme, full-width PDF viewer, and a modal for drawing signatures with configurable pen thickness.

**Architecture:** Remove the side signature panel; the PDF canvas becomes the trigger (click → modal opens). `SigModal` owns an internal `SignaturePad` instance for the modal canvas (580×200px). On confirm, the PNG dataUrl is pushed into the existing `SigPad` via a new `loadDataUrl()` method, preserving the rest of the app flow unchanged. No backend changes.

**Tech Stack:** Vanilla JS, signature_pad 4.2 (CDN/UMD), PDF.js 4.2 (CDN), Express (unchanged)

## Global Constraints

- Vanilla JS only — no frameworks
- No new npm dependencies
- `#sig-canvas` (260×130) stays in DOM but `display:none` — SigPad internal state still works
- localStorage keys: `saved_signature` (PNG dataUrl), `sig_thickness` (number string)
- `penColor` inside modal: `#2c2a28` (matches --text)
- Pen thickness slider: `min=1 max=8 step=0.5 default=2`
- Backend (`src/server.js`, `src/sign.js`) unchanged
- `overlay.js` and `pdf-viewer.js` unchanged
- All existing Jest tests must still pass (`npm test` → 4 tests green)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `public/signature-pad.js` | Modify | Add `loadDataUrl(dataUrl)` method |
| `public/index.html` | Replace | New layout: #toolbar, #viewer-panel, #statusbar; hidden sig-canvas; add sig-modal.js script |
| `public/style.css` | Replace | New palette (CSS vars), full layout + modal styles |
| `public/sig-modal.js` | Create | `SigModal` class: modal DOM, internal SignaturePad, thickness slider, confirm/cancel |
| `public/app.js` | Replace | Remove sig-panel refs; wire PDF click → modal; wire onConfirm → overlay |

---

## Task 1: Add `loadDataUrl` to SigPad

**Files:**
- Modify: `public/signature-pad.js`

**Interfaces:**
- Produces: `SigPad.loadDataUrl(dataUrl: string): void` — loads a PNG data URL into the pad's canvas and internal state so `isEmpty()` returns false and `getDataUrl()`/`getPng()` reflect the new image

- [ ] **Step 1: Add the method to signature-pad.js**

Open `public/signature-pad.js`. After the `loadFromStorage()` method (line 50), before `}` that closes the class (line 51), add:

```javascript
  loadDataUrl(dataUrl) {
    this._pad.fromDataURL(dataUrl);
  }
```

Full file after edit:

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
      this._pad.fromDataURL(dataUrl);
    };
    img.src = dataUrl;
    return true;
  }

  loadDataUrl(dataUrl) {
    this._pad.fromDataURL(dataUrl);
  }
}

window.SigPad = SigPad;
```

- [ ] **Step 2: Validate syntax**

```bash
node --check public/signature-pad.js
# Expected: no output (valid)
```

- [ ] **Step 3: Verify existing tests still pass**

```bash
npm test
# Expected: 4 tests pass (sign.test.js — unchanged backend tests)
```

- [ ] **Step 4: Commit**

```bash
git add public/signature-pad.js
git commit -m "feat: add loadDataUrl method to SigPad"
```

---

## Task 2: New HTML Structure + Full CSS Redesign

**Files:**
- Replace: `public/index.html`
- Replace: `public/style.css`

**Interfaces:**
- Produces: DOM structure with IDs: `#toolbar`, `#pdf-input`, `#page-nav`, `#prev-page`, `#page-label`, `#next-page`, `#sign-btn`, `#viewer-panel`, `#drop-hint`, `#pdf-wrapper`, `#pdf-canvas`, `#sig-overlay`, `#resize-handle`, `#statusbar`, `#status`, `#sig-canvas` (hidden)
- CSS variables: `--bg`, `--surface`, `--border`, `--text`, `--text-muted`, `--btn-primary-bg`, `--btn-primary-hover`, `--overlay-border`, `--overlay-fill`

- [ ] **Step 1: Replace public/index.html**

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
  <div id="toolbar">
    <label class="file-label" for="pdf-input">
      📄 Abrir PDF
      <input type="file" id="pdf-input" accept=".pdf" />
    </label>
    <span id="page-nav" style="display:none">
      <button id="prev-page" type="button">◀</button>
      <span id="page-label">1 / 1</span>
      <button id="next-page" type="button">▶</button>
    </span>
    <button id="sign-btn" class="primary" type="button" disabled>Assinar e descarregar</button>
  </div>

  <div id="viewer-panel">
    <p id="drop-hint">Clique em "Abrir PDF" para começar</p>
    <div id="pdf-wrapper" style="display:none">
      <canvas id="pdf-canvas"></canvas>
      <div id="sig-overlay">
        <img id="sig-preview" src="" alt="assinatura" />
        <div id="resize-handle"></div>
      </div>
    </div>
  </div>

  <div id="statusbar">
    <p id="status">Abra um PDF para começar.</p>
  </div>

  <!-- hidden canvas: keeps SigPad internal state as source of truth -->
  <canvas id="sig-canvas" width="260" height="130" style="display:none"></canvas>

  <script src="https://cdn.jsdelivr.net/npm/signature_pad@4.2.0/dist/signature_pad.umd.min.js"></script>
  <script src="pdf-viewer.js" type="module"></script>
  <script src="signature-pad.js" type="module"></script>
  <script src="overlay.js" type="module"></script>
  <script src="sig-modal.js" type="module"></script>
  <script src="app.js" type="module"></script>
</body>
</html>
```

- [ ] **Step 2: Replace public/style.css**

```css
:root {
  --bg: #f5f4f2;
  --surface: #ffffff;
  --border: #d1cec9;
  --text: #2c2a28;
  --text-muted: #6b6560;
  --btn-primary-bg: #374151;
  --btn-primary-hover: #1f2937;
  --overlay-border: #374151;
  --overlay-fill: rgba(55, 65, 81, 0.05);
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: system-ui, -apple-system, sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* ── Toolbar ── */
#toolbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1.25rem;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.file-label {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.9rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface);
  cursor: pointer;
  font-size: 0.875rem;
  white-space: nowrap;
  color: var(--text);
}
.file-label:hover { background: var(--bg); }
.file-label input[type="file"] { display: none; }

button {
  padding: 0.4rem 0.9rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  font-size: 0.875rem;
  white-space: nowrap;
}
button:hover { background: var(--bg); }
button.primary {
  background: var(--btn-primary-bg);
  color: #fff;
  border-color: var(--btn-primary-bg);
}
button.primary:hover { background: var(--btn-primary-hover); border-color: var(--btn-primary-hover); }
button:disabled { opacity: 0.4; cursor: default; }
button:disabled:hover { background: inherit; border-color: inherit; color: inherit; }

#page-nav {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.875rem;
  color: var(--text-muted);
}

/* ── Viewer panel ── */
#viewer-panel {
  flex: 1;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 1.5rem;
  overflow: auto;
}

#drop-hint {
  color: var(--text-muted);
  font-size: 0.95rem;
  margin-top: 4rem;
}

#pdf-wrapper {
  position: relative;
  display: inline-block;
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  cursor: crosshair;
}

#pdf-canvas { display: block; }

#sig-overlay {
  position: absolute;
  border: 2px dashed var(--overlay-border);
  cursor: move;
  display: none;
  user-select: none;
  background: var(--overlay-fill);
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
  background: var(--overlay-border);
  border-radius: 2px;
  cursor: se-resize;
}

/* ── Status bar ── */
#statusbar {
  padding: 0.5rem 1.25rem;
  background: var(--surface);
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

#status {
  font-size: 0.8rem;
  color: var(--text-muted);
  min-height: 1.2em;
}

/* ── Modal backdrop ── */
#sig-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

/* ── Modal container ── */
#sig-modal {
  background: var(--surface);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
  width: 640px;
  max-width: calc(100vw - 2rem);
  display: flex;
  flex-direction: column;
}

#sig-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem 0.75rem;
  border-bottom: 1px solid var(--border);
  font-weight: 600;
  font-size: 0.95rem;
}

#sig-modal-close {
  background: none;
  border: none;
  font-size: 1rem;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0.2rem 0.4rem;
  line-height: 1;
}
#sig-modal-close:hover { color: var(--text); background: none; }
#sig-modal-close:disabled:hover { background: none; }

#sig-modal-body {
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* canvas wrapper with baseline guide */
#sig-modal-canvas-wrapper {
  border: 1px solid var(--border);
  border-radius: 4px;
  background: #fff;
  position: relative;
  overflow: hidden;
  line-height: 0;
}

#sig-modal-canvas-wrapper::after {
  content: '';
  position: absolute;
  left: 1rem;
  right: 1rem;
  bottom: 40px;
  height: 1px;
  background: #e5e3e0;
  pointer-events: none;
}

#sig-modal-canvas { display: block; }

/* thickness controls */
#sig-modal-thickness {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

#sig-modal-thickness label {
  font-size: 0.8rem;
  color: var(--text-muted);
  font-weight: 500;
}

#thickness-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.8rem;
  color: var(--text-muted);
}

#thickness-slider {
  flex: 1;
  accent-color: var(--btn-primary-bg);
  cursor: pointer;
}

#thickness-preview {
  border: 1px solid var(--border);
  border-radius: 3px;
  background: #fff;
  flex-shrink: 0;
}

/* modal footer */
#sig-modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.25rem 1rem;
  border-top: 1px solid var(--border);
  gap: 0.5rem;
  flex-wrap: wrap;
}

#sig-modal-left-actions,
#sig-modal-right-actions {
  display: flex;
  gap: 0.5rem;
}
```

- [ ] **Step 3: Verify server still starts and serves files**

```bash
node src/server.js &
sleep 1
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/
# Expected: 200
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/style.css
# Expected: 200
kill %1
```

- [ ] **Step 4: Verify backend tests still pass**

```bash
npm test
# Expected: 4 tests pass
```

- [ ] **Step 5: Commit**

```bash
git add public/index.html public/style.css
git commit -m "feat: new layout - toolbar + full-width viewer + statusbar"
```

---

## Task 3: Create sig-modal.js

**Files:**
- Create: `public/sig-modal.js`

**Interfaces:**
- Consumes: `window.SigPad` (already on `window`); `SignaturePad` global (from CDN UMD script); `saved_signature` from localStorage
- Produces: `window.SigModal` class:
  ```javascript
  new SigModal(sigPadInstance)
  sigModal.open()               // shows backdrop, inits pad if first open
  sigModal.close()              // hides backdrop
  sigModal.onConfirm = () => {} // called after user confirms non-empty signature
  ```
- Side effects: on confirm, calls `sigPadInstance.loadDataUrl(dataUrl)` to push PNG into SigPad; saves `sig_thickness` to localStorage on slider change; saves `saved_signature` on "Guardar" click

- [ ] **Step 1: Create public/sig-modal.js**

```javascript
const THICKNESS_KEY = 'sig_thickness';

class SigModal {
  constructor(sigPad) {
    this._sigPad = sigPad;
    this._pad = null;
    this._el = null;
    this.onConfirm = null;
    this._build();
    this._bind();
  }

  _build() {
    const el = document.createElement('div');
    el.id = 'sig-modal-backdrop';
    el.style.display = 'none';
    el.innerHTML = `
      <div id="sig-modal">
        <div id="sig-modal-header">
          <span>Desenhar Assinatura</span>
          <button id="sig-modal-close" type="button">✕</button>
        </div>
        <div id="sig-modal-body">
          <div id="sig-modal-canvas-wrapper">
            <canvas id="sig-modal-canvas" width="580" height="200"></canvas>
          </div>
          <div id="sig-modal-thickness">
            <label for="thickness-slider">Grossura da caneta</label>
            <div id="thickness-row">
              <span>Fina</span>
              <input type="range" id="thickness-slider" min="1" max="8" value="2" step="0.5" />
              <span>Grossa</span>
              <canvas id="thickness-preview" width="80" height="20"></canvas>
            </div>
          </div>
        </div>
        <div id="sig-modal-footer">
          <div id="sig-modal-left-actions">
            <button id="sig-modal-clear" type="button">Limpar</button>
            <button id="sig-modal-load" type="button">Carregar guardada</button>
            <button id="sig-modal-save" type="button">Guardar</button>
          </div>
          <div id="sig-modal-right-actions">
            <button id="sig-modal-cancel" type="button">Cancelar</button>
            <button id="sig-modal-confirm" class="primary" type="button" disabled>Confirmar</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(el);
    this._el = el;
  }

  _initPad() {
    const canvas = document.getElementById('sig-modal-canvas');
    const thickness = parseFloat(localStorage.getItem(THICKNESS_KEY) || '2');
    this._pad = new SignaturePad(canvas, {
      minWidth: thickness * 0.5,
      maxWidth: thickness,
      penColor: '#2c2a28',
    });
    this._pad.addEventListener('endStroke', () => {
      document.getElementById('sig-modal-confirm').disabled = this._pad.isEmpty();
    });
    document.getElementById('thickness-slider').value = thickness;
    this._updatePreview(thickness);
  }

  _updatePreview(thickness) {
    const preview = document.getElementById('thickness-preview');
    const ctx = preview.getContext('2d');
    ctx.clearRect(0, 0, preview.width, preview.height);
    ctx.beginPath();
    ctx.moveTo(8, preview.height / 2);
    ctx.lineTo(preview.width - 8, preview.height / 2);
    ctx.strokeStyle = '#2c2a28';
    ctx.lineWidth = thickness;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  _bind() {
    const el = this._el;

    el.addEventListener('click', (e) => {
      const id = e.target.id;

      if (id === 'sig-modal-close' || id === 'sig-modal-cancel') {
        this.close();
        return;
      }

      if (id === 'sig-modal-confirm') {
        if (!this._pad || this._pad.isEmpty()) return;
        const dataUrl = document.getElementById('sig-modal-canvas').toDataURL('image/png');
        this._sigPad.loadDataUrl(dataUrl);
        this.close();
        if (this.onConfirm) this.onConfirm();
        return;
      }

      if (id === 'sig-modal-clear') {
        if (this._pad) this._pad.clear();
        document.getElementById('sig-modal-confirm').disabled = true;
        return;
      }

      if (id === 'sig-modal-load') {
        const dataUrl = localStorage.getItem('saved_signature');
        if (!dataUrl || !this._pad) return;
        this._pad.fromDataURL(dataUrl);
        document.getElementById('sig-modal-confirm').disabled = false;
        return;
      }

      if (id === 'sig-modal-save') {
        if (!this._pad || this._pad.isEmpty()) return;
        const dataUrl = document.getElementById('sig-modal-canvas').toDataURL('image/png');
        localStorage.setItem('saved_signature', dataUrl);
        return;
      }
    });

    el.addEventListener('input', (e) => {
      if (e.target.id !== 'thickness-slider') return;
      const t = parseFloat(e.target.value);
      if (this._pad) {
        this._pad.maxWidth = t;
        this._pad.minWidth = t * 0.5;
      }
      localStorage.setItem(THICKNESS_KEY, String(t));
      this._updatePreview(t);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._el.style.display !== 'none') this.close();
    });
  }

  open() {
    this._el.style.display = 'flex';
    if (!this._pad) {
      this._initPad();
    } else {
      const thickness = parseFloat(localStorage.getItem(THICKNESS_KEY) || '2');
      document.getElementById('thickness-slider').value = thickness;
      this._pad.maxWidth = thickness;
      this._pad.minWidth = thickness * 0.5;
      this._updatePreview(thickness);
      document.getElementById('sig-modal-confirm').disabled = this._pad.isEmpty();
    }
  }

  close() {
    this._el.style.display = 'none';
  }
}

window.SigModal = SigModal;
```

- [ ] **Step 2: Validate syntax**

```bash
node --check public/sig-modal.js
# Expected: no output
```

- [ ] **Step 3: Verify file serves**

```bash
node src/server.js &
sleep 1
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/sig-modal.js
# Expected: 200
kill %1
```

- [ ] **Step 4: Run tests**

```bash
npm test
# Expected: 4 tests pass
```

- [ ] **Step 5: Commit**

```bash
git add public/sig-modal.js
git commit -m "feat: SigModal - signature modal with pen thickness control"
```

---

## Task 4: Update app.js — Wire Modal + PDF Click Trigger

**Files:**
- Replace: `public/app.js`

**Interfaces:**
- Consumes:
  - `window.PdfViewer` (from pdf-viewer.js)
  - `window.SigPad` (from signature-pad.js) — now has `loadDataUrl(dataUrl)`
  - `window.SigOverlay` (from overlay.js)
  - `window.SigModal` (from sig-modal.js)
- DOM elements consumed: `#pdf-input`, `#pdf-canvas`, `#pdf-wrapper`, `#sig-overlay`, `#resize-handle`, `#sig-canvas`, `#prev-page`, `#next-page`, `#page-label`, `#page-nav`, `#sign-btn`, `#drop-hint`, `#status`
- Coordinate conversion unchanged: `x = rect.left/scale`, `y = pdfHeight - (rect.top+rect.height)/scale`, `w = rect.width/scale`, `h = rect.height/scale`

- [ ] **Step 1: Replace public/app.js**

```javascript
document.addEventListener('DOMContentLoaded', () => {
  const pdfInput   = document.getElementById('pdf-input');
  const pdfCanvas  = document.getElementById('pdf-canvas');
  const pdfWrapper = document.getElementById('pdf-wrapper');
  const sigOverlay = document.getElementById('sig-overlay');
  const resizeHand = document.getElementById('resize-handle');
  const sigCanvas  = document.getElementById('sig-canvas');
  const prevBtn    = document.getElementById('prev-page');
  const nextBtn    = document.getElementById('next-page');
  const pageLabel  = document.getElementById('page-label');
  const pageNav    = document.getElementById('page-nav');
  const signBtn    = document.getElementById('sign-btn');
  const dropHint   = document.getElementById('drop-hint');
  const statusEl   = document.getElementById('status');

  const viewer   = new window.PdfViewer(pdfCanvas);
  const sigPad   = new window.SigPad(sigCanvas);
  const overlay  = new window.SigOverlay(pdfWrapper, sigOverlay, resizeHand);
  const sigModal = new window.SigModal(sigPad);

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
      dropHint.style.display = 'none';
      pdfWrapper.style.display = 'inline-block';
      pageNav.style.display = 'flex';
      setStatus('Clique no PDF para assinar.');
    } catch (err) {
      setStatus('Erro ao carregar PDF: ' + err.message);
    }
  });

  // Click on PDF canvas → open signature modal
  pdfCanvas.addEventListener('click', () => {
    if (!currentPdfFile) return;
    sigModal.open();
  });

  // Confirmed signature in modal → show overlay on PDF
  sigModal.onConfirm = () => {
    const dataUrl = sigPad.getDataUrl();
    if (!dataUrl) return;
    overlay.show(dataUrl);
    signBtn.disabled = false;
    setStatus('Arraste e redimensione a assinatura. Depois clique "Assinar e descarregar".');
  };

  // Page navigation
  prevBtn.addEventListener('click', async () => {
    if (viewer.currentPage > 0) await viewer.renderPage(viewer.currentPage - 1);
  });
  nextBtn.addEventListener('click', async () => {
    if (viewer.currentPage < viewer.totalPages - 1) await viewer.renderPage(viewer.currentPage + 1);
  });

  // Sign and download
  signBtn.addEventListener('click', async () => {
    if (!currentPdfFile || !overlay.isVisible || !pageInfo) return;

    const sigBlob = await sigPad.getPng();
    if (!sigBlob) { setStatus('Sem assinatura.'); return; }

    const rect = overlay.getCanvasRect();
    const { scale, pdfHeight } = pageInfo;

    // canvas px (top-left origin) → PDF points (bottom-left origin)
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

- [ ] **Step 2: Validate syntax**

```bash
node --check public/app.js
# Expected: no output
```

- [ ] **Step 3: Run full test suite**

```bash
npm test
# Expected: 4 tests pass (sign.test.js — backend unchanged)
```

- [ ] **Step 4: End-to-end smoke test in browser**

```bash
node src/server.js
```

Open `http://localhost:3000`. Test sequence:
1. Page loads → fundo off-white, toolbar no topo, hint "Clique em Abrir PDF"
2. Clicar "📄 Abrir PDF" → selecionar PDF → PDF renderiza a largura total, hint desaparece
3. Cursor sobre PDF → crosshair
4. Clicar no PDF → modal abre com canvas 580×200, slider grossura
5. Mover slider → preview ao vivo muda
6. Desenhar assinatura → botão "Confirmar" ativa
7. Clicar "Guardar" → confirmar guardado em localStorage
8. Recarregar página → clicar PDF → "Carregar guardada" → assinatura pré-carregada
9. "Confirmar" → modal fecha → overlay azul centrado no PDF
10. Arrastar overlay, redimensionar
11. "Assinar e descarregar" → PDF com assinatura descarrega
12. Abrir PDF descarregado → assinatura na posição correta

- [ ] **Step 5: Commit**

```bash
git add public/app.js
git commit -m "feat: wire PDF click → signature modal → overlay flow"
```

---

## Self-Review

**Spec coverage:**
- ✅ Layout neutro profissional com CSS vars — Task 2
- ✅ PDF ocupa largura total, sem painel lateral — Task 2
- ✅ Toolbar: input PDF + page-nav + sign-btn — Task 2
- ✅ Statusbar em baixo — Task 2
- ✅ Cursor crosshair no PDF quando carregado — Task 2 (CSS `#pdf-wrapper { cursor: crosshair }`)
- ✅ Clicar PDF → modal — Task 4
- ✅ Modal: canvas 580×200 com baseline guide — Task 3
- ✅ Slider grossura 1–8 step 0.5 default 2 — Task 3
- ✅ Preview ao vivo da grossura — Task 3
- ✅ "Guardar" salva em localStorage — Task 3
- ✅ "Carregar guardada" preenche modal — Task 3
- ✅ "Cancelar"/Esc fecha sem confirmar — Task 3
- ✅ "Confirmar" só ativo quando canvas não vazio — Task 3
- ✅ onConfirm → overlay.show() centrado — Task 4
- ✅ `loadDataUrl` em SigPad — Task 1
- ✅ `#sig-canvas` hidden mantém SigPad funcional — Task 2 (HTML)
- ✅ localStorage keys `saved_signature` e `sig_thickness` — Tasks 3
- ✅ Sem backend changes — confirmado (nenhuma task toca src/)
- ✅ overlay.js e pdf-viewer.js inalterados — confirmado

**Placeholder scan:** Nenhum TBD, TODO ou "fill in details" encontrado.

**Type consistency:**
- `SigPad.loadDataUrl(dataUrl)` definido Task 1, usado em Task 3 (`this._sigPad.loadDataUrl(dataUrl)`) ✅
- `sigModal.onConfirm` definido Task 3, wired em Task 4 ✅
- `sigPad.getDataUrl()` existia antes, usado em Task 4 `sigModal.onConfirm` ✅
- `overlay.show(dataUrl)` assinatura inalterada ✅
