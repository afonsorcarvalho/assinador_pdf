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
