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
