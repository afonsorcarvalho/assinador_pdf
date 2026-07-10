function removeBackground(srcRGBA, width, height, opts) {
  const threshold = opts.threshold;
  const softness = opts.softness == null ? 40 : opts.softness;
  const ink = opts.inkColor || { r: 44, g: 42, b: 40 };

  const n = width * height * 4;
  const out = new Uint8ClampedArray(n);

  for (let i = 0; i < n; i += 4) {
    const r = srcRGBA[i];
    const g = srcRGBA[i + 1];
    const b = srcRGBA[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;

    if (lum >= threshold) {
      out[i] = 0; out[i + 1] = 0; out[i + 2] = 0; out[i + 3] = 0;
    } else {
      let a = (threshold - lum) / softness;
      if (a < 0) a = 0;
      if (a > 1) a = 1;
      out[i] = ink.r;
      out[i + 1] = ink.g;
      out[i + 2] = ink.b;
      out[i + 3] = Math.round(a * 255);
    }
  }
  return out;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { removeBackground };
}
if (typeof window !== 'undefined') {
  window.removeBackground = removeBackground;
}
