const { removeBackground } = require('../public/bg-removal');

// helper: monta um array RGBA de 1 pixel
function px(r, g, b, a = 255) {
  return new Uint8ClampedArray([r, g, b, a]);
}

test('pixel branco vira transparente (threshold 180)', () => {
  const out = removeBackground(px(255, 255, 255), 1, 1, { threshold: 180 });
  expect(out[3]).toBe(0);
});

test('pixel preto vira traço opaco na cor da tinta', () => {
  const out = removeBackground(px(0, 0, 0), 1, 1, { threshold: 180 });
  expect(out[0]).toBe(44);
  expect(out[1]).toBe(42);
  expect(out[2]).toBe(40);
  expect(out[3]).toBe(255);
});

test('pixel logo abaixo do threshold tem alpha parcial', () => {
  // L = 179 (< 180), com softness 40 => a = clamp((180-179)/40,0,1)*255 ≈ 6
  const out = removeBackground(px(179, 179, 179), 1, 1, { threshold: 180, softness: 40 });
  expect(out[3]).toBeGreaterThan(0);
  expect(out[3]).toBeLessThan(255);
});

test('cor forçada: pixel azul escuro vira cor da tinta, não azul', () => {
  const out = removeBackground(px(0, 0, 120), 1, 1, { threshold: 180 });
  expect(out[3]).toBeGreaterThan(0);        // é traço
  expect([out[0], out[1], out[2]]).toEqual([44, 42, 40]);
});

test('threshold baixo deixa mais pixels transparentes que threshold alto', () => {
  // 3 pixels de luminâncias crescentes: ~76, ~150, ~226
  const src = new Uint8ClampedArray([
    76, 76, 76, 255,
    150, 150, 150, 255,
    226, 226, 226, 255,
  ]);
  const low = removeBackground(src, 3, 1, { threshold: 50 });
  const high = removeBackground(src, 3, 1, { threshold: 220 });
  const transp = (arr) => [arr[3], arr[7], arr[11]].filter(a => a === 0).length;
  expect(transp(low)).toBeGreaterThan(transp(high));
});

test('não muta o array de origem', () => {
  const src = px(0, 0, 0);
  const copy = new Uint8ClampedArray(src);
  removeBackground(src, 1, 1, { threshold: 180 });
  expect(Array.from(src)).toEqual(Array.from(copy));
});

test('comprimento de saída = width*height*4', () => {
  const out = removeBackground(new Uint8ClampedArray(2 * 2 * 4), 2, 2, { threshold: 180 });
  expect(out.length).toBe(16);
});
