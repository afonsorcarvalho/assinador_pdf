const THICKNESS_KEY = 'sig_thickness';

class SigModal {
  constructor(sigPad) {
    this._sigPad = sigPad;
    this._pad = null;
    this._el = null;
    this.onConfirm = null;
    this._stampEnabled = false;
    this._stampFont    = 'Arial';
    this._stampSize    = 12;
    this._stampBold    = false;
    this._stampItalic  = false;
    this._stampAlign   = 'center';
    this._uploadedImage = false;
    this._sourceImageData = null;
    this._bgThreshold = parseInt(localStorage.getItem('sig_bg_threshold') || '180', 10);
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
          <div id="bg-threshold-wrapper" style="display:none">
            <label for="bg-threshold-slider">Remover fundo (sensibilidade)</label>
            <div id="bg-threshold-row">
              <span>Menos</span>
              <input type="range" id="bg-threshold-slider" min="0" max="255" value="180" />
              <span>Mais</span>
            </div>
          </div>
          <div id="stamp-wrapper">
            <label id="stamp-toggle-label">
              <input type="checkbox" id="stamp-toggle" />
              Carimbo (opcional)
            </label>
            <div id="stamp-section" style="display:none">
              <div id="stamp-toolbar">
                <select id="stamp-font">
                  <option value="Arial">Arial</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Courier New">Courier New</option>
                  <option value="Times New Roman">Times New Roman</option>
                </select>
                <input type="number" id="stamp-size" min="8" max="24" value="12" />
                <button type="button" id="stamp-bold" class="stamp-fmt-btn">B</button>
                <button type="button" id="stamp-italic" class="stamp-fmt-btn">I</button>
                <button type="button" class="stamp-fmt-btn stamp-align" data-align="left">L</button>
                <button type="button" class="stamp-fmt-btn stamp-align active" data-align="center">C</button>
                <button type="button" class="stamp-fmt-btn stamp-align" data-align="right">R</button>
              </div>
              <textarea id="stamp-textarea" rows="4" placeholder="Ex: NOME COMPLETO&#10;Título / Registo&#10;Cargo"></textarea>
              <canvas id="stamp-preview"></canvas>
            </div>
          </div>
        </div>
        <div id="sig-modal-footer">
          <div id="sig-modal-left-actions">
            <button id="sig-modal-clear" type="button">Limpar</button>
            <button id="sig-modal-load" type="button">Carregar guardada</button>
            <button id="sig-modal-upload" type="button">Carregar imagem</button>
            <input type="file" id="sig-modal-file" accept="image/png,image/jpeg" hidden />
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

  _renderStampPreview() {
    const textarea = document.getElementById('stamp-textarea');
    const preview  = document.getElementById('stamp-preview');
    if (!textarea || !preview) return;

    const lines  = textarea.value.split('\n');
    const size   = this._stampSize;
    const lineH  = Math.round(size * 1.4);
    const padV   = 8;

    preview.width  = 580;
    preview.height = Math.max(lineH + padV * 2, lines.length * lineH + padV * 2);

    const ctx = preview.getContext('2d');
    ctx.clearRect(0, 0, preview.width, preview.height);

    const fontParts = [];
    if (this._stampItalic) fontParts.push('italic');
    if (this._stampBold)   fontParts.push('bold');
    fontParts.push(`${size}px`);
    fontParts.push(`"${this._stampFont}"`);
    ctx.font      = fontParts.join(' ');
    ctx.fillStyle = '#2c2a28';
    ctx.textAlign = this._stampAlign;

    const x = this._stampAlign === 'left' ? 8
             : this._stampAlign === 'right' ? 572
             : 290;

    lines.forEach((line, i) => {
      ctx.fillText(line, x, padV + size + i * lineH);
    });
  }

  _loadStampState() {
    this._stampEnabled = localStorage.getItem('stamp_enabled') === 'true';
    this._stampFont    = localStorage.getItem('stamp_font')    || 'Arial';
    this._stampSize    = parseInt(localStorage.getItem('stamp_size') || '12', 10);
    this._stampBold    = localStorage.getItem('stamp_bold')    === 'true';
    this._stampItalic  = localStorage.getItem('stamp_italic')  === 'true';
    this._stampAlign   = localStorage.getItem('stamp_align')   || 'center';

    document.getElementById('stamp-toggle').checked        = this._stampEnabled;
    document.getElementById('stamp-section').style.display = this._stampEnabled ? 'block' : 'none';
    document.getElementById('stamp-textarea').value        = localStorage.getItem('stamp_text') || '';
    document.getElementById('stamp-font').value            = this._stampFont;
    document.getElementById('stamp-size').value            = String(this._stampSize);
    document.getElementById('stamp-bold').classList.toggle('active', this._stampBold);
    document.getElementById('stamp-italic').classList.toggle('active', this._stampItalic);
    document.querySelectorAll('.stamp-align').forEach(b => {
      b.classList.toggle('active', b.dataset.align === this._stampAlign);
    });
  }

  _combineCanvases() {
    const sigCanvas = document.getElementById('sig-modal-canvas');

    const stampActive = this._stampEnabled &&
      (document.getElementById('stamp-textarea').value.trim().length > 0);

    if (!stampActive) return sigCanvas.toDataURL('image/png');

    const stampPreview = document.getElementById('stamp-preview');
    const gap  = 8;
    const sepH = 1;

    const out = document.createElement('canvas');
    out.width  = 580;
    out.height = sigCanvas.height + gap + sepH + gap + stampPreview.height;

    const ctx = out.getContext('2d');
    ctx.drawImage(sigCanvas, 0, 0);

    // separator line
    ctx.fillStyle = '#cccccc';
    ctx.fillRect(0, sigCanvas.height + gap, 580, sepH);

    ctx.drawImage(stampPreview, 0, sigCanvas.height + gap + sepH + gap);

    return out.toDataURL('image/png');
  }

  _loadImageFile(file) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const W = 580, H = 200;
      const off = document.createElement('canvas');
      off.width = W; off.height = H;
      const octx = off.getContext('2d');
      octx.clearRect(0, 0, W, H);
      // contain: mantém aspecto, centraliza
      const scale = Math.min(W / img.width, H / img.height);
      const dw = img.width * scale, dh = img.height * scale;
      const dx = (W - dw) / 2, dy = (H - dh) / 2;
      octx.drawImage(img, dx, dy, dw, dh);
      this._sourceImageData = octx.getImageData(0, 0, W, H);
      URL.revokeObjectURL(url);

      this._applyThreshold();
      this._uploadedImage = true;
      document.getElementById('bg-threshold-wrapper').style.display = 'block';
      document.getElementById('bg-threshold-slider').value = this._bgThreshold;
      document.getElementById('sig-modal-confirm').disabled = false;
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      alert('Não foi possível carregar a imagem.');
    };
    img.src = url;
  }

  _applyThreshold() {
    if (!this._sourceImageData) return;
    const W = 580, H = 200;
    const out = window.removeBackground(
      this._sourceImageData.data, W, H, { threshold: this._bgThreshold }
    );
    const canvas = document.getElementById('sig-modal-canvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    ctx.putImageData(new ImageData(out, W, H), 0, 0);
  }

  _bind() {
    const el = this._el;

    el.addEventListener('click', (e) => {
      const id = e.target.id;

      if (id === 'sig-modal-close' || id === 'sig-modal-cancel') {
        this.close();
        return;
      }

      if (id === 'sig-modal-upload') {
        document.getElementById('sig-modal-file').click();
        return;
      }

      if (id === 'sig-modal-confirm') {
        if (!this._pad || (this._pad.isEmpty() && !this._uploadedImage)) return;
        const sigDataUrl = document.getElementById('sig-modal-canvas').toDataURL('image/png');
        this._sigPad.loadDataUrl(sigDataUrl);
        const combinedDataUrl = this._combineCanvases();
        this._sigPad.storeCombinedDataUrl(combinedDataUrl);
        this.close();
        if (this.onConfirm) this.onConfirm(combinedDataUrl);
        return;
      }

      if (id === 'sig-modal-clear') {
        if (this._pad) this._pad.clear();
        this._uploadedImage = false;
        this._sourceImageData = null;
        document.getElementById('bg-threshold-wrapper').style.display = 'none';
        document.getElementById('sig-modal-confirm').disabled = true;
        return;
      }

      if (id === 'sig-modal-load') {
        const dataUrl = localStorage.getItem('saved_signature');
        if (!dataUrl || !this._pad) return;
        this._pad.fromDataURL(dataUrl);
        this._uploadedImage = false;
        this._sourceImageData = null;
        document.getElementById('bg-threshold-wrapper').style.display = 'none';
        document.getElementById('sig-modal-confirm').disabled = false;
        return;
      }

      if (id === 'sig-modal-save') {
        if (!this._pad || (this._pad.isEmpty() && !this._uploadedImage)) return;
        const dataUrl = document.getElementById('sig-modal-canvas').toDataURL('image/png');
        localStorage.setItem('saved_signature', dataUrl);
        return;
      }

      if (id === 'stamp-bold') {
        this._stampBold = !this._stampBold;
        document.getElementById('stamp-bold').classList.toggle('active', this._stampBold);
        localStorage.setItem('stamp_bold', String(this._stampBold));
        this._renderStampPreview();
        return;
      }

      if (id === 'stamp-italic') {
        this._stampItalic = !this._stampItalic;
        document.getElementById('stamp-italic').classList.toggle('active', this._stampItalic);
        localStorage.setItem('stamp_italic', String(this._stampItalic));
        this._renderStampPreview();
        return;
      }

      if (e.target.classList.contains('stamp-align')) {
        this._stampAlign = e.target.dataset.align;
        document.querySelectorAll('.stamp-align').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        localStorage.setItem('stamp_align', this._stampAlign);
        this._renderStampPreview();
        return;
      }
    });

    el.addEventListener('input', (e) => {
      if (e.target.id === 'bg-threshold-slider') {
        this._bgThreshold = parseInt(e.target.value, 10);
        localStorage.setItem('sig_bg_threshold', String(this._bgThreshold));
        this._applyThreshold();
        return;
      }
      if (e.target.id === 'thickness-slider') {
        const t = parseFloat(e.target.value);
        if (this._pad) {
          this._pad.maxWidth = t;
          this._pad.minWidth = t * 0.5;
        }
        localStorage.setItem(THICKNESS_KEY, String(t));
        this._updatePreview(t);
        return;
      }
      if (e.target.id === 'stamp-textarea') {
        localStorage.setItem('stamp_text', e.target.value);
        this._renderStampPreview();
        return;
      }
      if (e.target.id === 'stamp-size') {
        const v = parseInt(e.target.value, 10);
        if (v >= 8 && v <= 24) {
          this._stampSize = v;
          localStorage.setItem('stamp_size', String(v));
          this._renderStampPreview();
        }
        return;
      }
    });

    el.addEventListener('change', (e) => {
      if (e.target.id === 'sig-modal-file') {
        this._loadImageFile(e.target.files[0]);
        e.target.value = '';
        return;
      }
      if (e.target.id === 'stamp-toggle') {
        this._stampEnabled = e.target.checked;
        document.getElementById('stamp-section').style.display = this._stampEnabled ? 'block' : 'none';
        localStorage.setItem('stamp_enabled', String(this._stampEnabled));
        if (this._stampEnabled) this._renderStampPreview();
        return;
      }
      if (e.target.id === 'stamp-font') {
        this._stampFont = e.target.value;
        localStorage.setItem('stamp_font', this._stampFont);
        this._renderStampPreview();
        return;
      }
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
    this._loadStampState();
    if (this._stampEnabled) this._renderStampPreview();
  }

  close() {
    this._el.style.display = 'none';
    this._uploadedImage = false;
    this._sourceImageData = null;
    const w = document.getElementById('bg-threshold-wrapper');
    if (w) w.style.display = 'none';
    const canvas = document.getElementById('sig-modal-canvas');
    const ctx = canvas && canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, 580, 200);
  }
}

window.SigModal = SigModal;
