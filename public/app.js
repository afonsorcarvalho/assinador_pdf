// Wires together PdfViewer, SigPad, SigOverlay and handles POST /sign
// Dependencies loaded via <script> tags in index.html (window.PdfViewer, window.SigPad, window.SigOverlay)

document.addEventListener('DOMContentLoaded', () => {
  const pdfInput    = document.getElementById('pdf-input');
  const pdfCanvas   = document.getElementById('pdf-canvas');
  const pdfWrapper  = document.getElementById('pdf-wrapper');
  const sigOverlay  = document.getElementById('sig-overlay');
  const resizeHand  = document.getElementById('resize-handle');
  const sigCanvas   = document.getElementById('sig-canvas');
  const prevBtn     = document.getElementById('prev-page');
  const nextBtn     = document.getElementById('next-page');
  const pageLabel   = document.getElementById('page-label');
  const pageNav     = document.getElementById('page-nav');
  const placeSigBtn = document.getElementById('place-sig-btn');
  const signBtn     = document.getElementById('sign-btn');
  const clearBtn    = document.getElementById('clear-sig-btn');
  const saveBtn     = document.getElementById('save-sig-btn');
  const loadBtn     = document.getElementById('load-sig-btn');
  const statusEl    = document.getElementById('status');

  const viewer  = new window.PdfViewer(pdfCanvas);
  const sigPad  = new window.SigPad(sigCanvas);
  const overlay = new window.SigOverlay(pdfWrapper, sigOverlay, resizeHand);

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
      pageNav.style.display = 'flex';
      placeSigBtn.disabled = false;
      setStatus('PDF carregado. Desenhe a assinatura e clique "Colocar assinatura".');
    } catch (err) {
      setStatus('Erro ao carregar PDF: ' + err.message);
    }
  });

  // Page navigation
  prevBtn.addEventListener('click', async () => {
    if (viewer.currentPage > 0) await viewer.renderPage(viewer.currentPage - 1);
  });
  nextBtn.addEventListener('click', async () => {
    if (viewer.currentPage < viewer.totalPages - 1) await viewer.renderPage(viewer.currentPage + 1);
  });

  // Signature controls
  clearBtn.addEventListener('click', () => sigPad.clear());
  saveBtn.addEventListener('click', () => {
    sigPad.saveToStorage();
    setStatus('Assinatura guardada.');
  });
  loadBtn.addEventListener('click', () => {
    const ok = sigPad.loadFromStorage();
    setStatus(ok ? 'Assinatura carregada.' : 'Nenhuma assinatura guardada.');
  });

  // Place signature overlay
  placeSigBtn.addEventListener('click', () => {
    if (sigPad.isEmpty()) {
      setStatus('Desenhe a assinatura primeiro.');
      return;
    }
    const dataUrl = sigPad.getDataUrl();
    overlay.show(dataUrl);
    signBtn.disabled = false;
    setStatus('Arraste e redimensione a assinatura. Depois clique "Assinar e descarregar".');
  });

  // Sign and download
  signBtn.addEventListener('click', async () => {
    if (!currentPdfFile || !overlay.isVisible || !pageInfo) return;

    const sigBlob = await sigPad.getPng();
    if (!sigBlob) { setStatus('Sem assinatura.'); return; }

    const rect = overlay.getCanvasRect();
    const { scale, pdfHeight } = pageInfo;

    // Convert canvas px coords (top-left origin) → PDF points (bottom-left origin)
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
      const response = await fetch('/sign', { method: 'POST', body: formData });
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
