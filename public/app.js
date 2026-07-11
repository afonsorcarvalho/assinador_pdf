// Wires together PdfViewer, SigPad, SigOverlay, SigModal and handles POST /sign
// Dependencies loaded via <script> tags in index.html (window.PdfViewer, window.SigPad, window.SigOverlay, window.SigModal)

document.addEventListener('DOMContentLoaded', () => {
  const pdfInput   = document.getElementById('pdf-input');
  const pdfCanvas  = document.getElementById('pdf-canvas');
  const pdfWrapper = document.getElementById('pdf-wrapper');
  const sigOverlay = document.getElementById('sig-overlay');
  const resizeHand = document.getElementById('resize-handle');
  const sigCanvas  = document.getElementById('sig-canvas');
  const prevBtn    = document.getElementById('prev-page');
  const nextBtn    = document.getElementById('next-page');
  const pageLabel  = document.getElementById('page-label');
  const pageNav    = document.getElementById('page-nav');
  const signBtn    = document.getElementById('sign-btn');
  const dropHint   = document.getElementById('drop-hint');
  const statusEl   = document.getElementById('status');

  const viewer   = new window.PdfViewer(pdfCanvas);
  const sigPad   = new window.SigPad(sigCanvas);
  const overlay  = new window.SigOverlay(pdfWrapper, sigOverlay, resizeHand);
  const sigModal = new window.SigModal(sigPad);

  let currentPdfFile = null;
  let pageInfo = null;

  function setStatus(msg) { statusEl.textContent = msg; }

  viewer.onPageChange = (info) => {
    pageInfo = info;
    pageLabel.textContent = `${info.currentPage + 1} / ${info.totalPages}`;
    overlay.hide();
    signBtn.disabled = true;
  };

  // Load PDF
  pdfInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    currentPdfFile = file;
    setStatus('A carregar PDF...');
    try {
      await viewer.loadFile(file);
      dropHint.style.display = 'none';
      pdfWrapper.style.display = 'inline-block';
      pageNav.style.display = 'flex';
      setStatus('Clique no PDF para assinar.');
    } catch (err) {
      setStatus('Erro ao carregar PDF: ' + err.message);
    }
  });

  // Click on PDF canvas → open signature modal
  pdfCanvas.addEventListener('click', () => {
    if (!currentPdfFile) return;
    sigModal.open();
  });

  // Confirmed signature in modal → show overlay on PDF
  sigModal.onConfirm = (dataUrl) => {
    if (!dataUrl) return;
    overlay.show(dataUrl);
    signBtn.disabled = false;
    setStatus('Arraste e redimensione a assinatura. Depois clique "Assinar e descarregar".');
  };

  // Page navigation
  prevBtn.addEventListener('click', async () => {
    if (viewer.currentPage > 0) await viewer.renderPage(viewer.currentPage - 1);
  });
  nextBtn.addEventListener('click', async () => {
    if (viewer.currentPage < viewer.totalPages - 1) await viewer.renderPage(viewer.currentPage + 1);
  });

  // Sign and download
  signBtn.addEventListener('click', async () => {
    if (!currentPdfFile || !overlay.isVisible || !pageInfo) return;

    const sigBlob = await sigPad.getPng();
    if (!sigBlob) { setStatus('Sem assinatura.'); return; }

    const rect = overlay.getCanvasRect();
    const { scale, pdfHeight } = pageInfo;

    // canvas px (top-left origin) → PDF points (bottom-left origin)
    const x = rect.left / scale;
    const y = pdfHeight - (rect.top + rect.height) / scale;
    const w = rect.width / scale;
    const h = rect.height / scale;

    const formData = new FormData();
    formData.append('pdf', currentPdfFile);
    formData.append('signature', sigBlob, 'sig.png');
    formData.append('page', String(pageInfo.currentPage));
    formData.append('x', String(x));
    formData.append('y', String(y));
    formData.append('w', String(w));
    formData.append('h', String(h));

    setStatus('A assinar...');
    signBtn.disabled = true;

    try {
      const response = await fetch('sign', { method: 'POST', body: formData });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(err.error || response.statusText);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = currentPdfFile.name.replace(/\.pdf$/i, '_assinado.pdf');
      a.click();
      URL.revokeObjectURL(url);
      setStatus('PDF assinado descarregado.');
    } catch (err) {
      setStatus('Erro: ' + err.message);
    } finally {
      signBtn.disabled = false;
    }
  });
});
