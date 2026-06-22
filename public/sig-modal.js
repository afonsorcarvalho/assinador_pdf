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
        if (this.onConfirm) this.onConfirm(dataUrl);
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
