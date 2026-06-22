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
