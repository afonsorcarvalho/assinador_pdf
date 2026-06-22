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
