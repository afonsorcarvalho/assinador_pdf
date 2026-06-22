const express = require('express');
const multer = require('multer');
const path = require('path');
const { signPdf } = require('./sign');

const app = express();
const PORT = process.env.PORT || 3000;
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/sign', upload.fields([{ name: 'pdf', maxCount: 1 }, { name: 'signature', maxCount: 1 }]), async (req, res) => {
  try {
    const pdfBuffer = req.files?.pdf?.[0]?.buffer;
    const sigBuffer = req.files?.signature?.[0]?.buffer;

    if (!pdfBuffer || !sigBuffer) {
      return res.status(400).json({ error: 'Missing pdf or signature file' });
    }

    const page = parseInt(req.body.page ?? '0', 10);
    const x = parseFloat(req.body.x);
    const y = parseFloat(req.body.y);
    const w = parseFloat(req.body.w);
    const h = parseFloat(req.body.h);

    if ([page, x, y, w, h].some(Number.isNaN)) {
      return res.status(400).json({ error: 'Invalid position params' });
    }

    const signedBytes = await signPdf(pdfBuffer, sigBuffer, { page, x, y, w, h });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="signed.pdf"',
      'Content-Length': signedBytes.length,
    });
    res.send(Buffer.from(signedBytes));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Listening on http://localhost:${PORT}`));

module.exports = app;
