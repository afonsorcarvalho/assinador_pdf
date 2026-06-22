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
    this._combinedDataUrl = null;
  }

  isEmpty() { return this._pad.isEmpty(); }

  clear() {
    this._pad.clear();
    this._combinedDataUrl = null;
  }

  storeCombinedDataUrl(dataUrl) {
    this._combinedDataUrl = dataUrl;
  }

  getPng() {
    if (this._pad.isEmpty()) return null;
    if (this._combinedDataUrl) {
      const [, data] = this._combinedDataUrl.split(',');
      const bytes = atob(data);
      const arr = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      return Promise.resolve(new Blob([arr], { type: 'image/png' }));
    }
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

  loadDataUrl(dataUrl) {
    this._pad.fromDataURL(dataUrl);
  }
}

window.SigPad = SigPad;
