# UX Redesign — Assinador PDF

**Data:** 2026-06-22

## Objetivo

Melhorar a interface do assinador PDF com:
1. Layout profissional neutro (sem painel lateral de assinatura)
2. Modal de assinatura ativado por clique no PDF
3. Controlo de grossura de caneta no modal

---

## Layout Global

### Antes
- Barra de controlo no topo
- Dois painéis lado a lado: PDF (flex:1) + painel assinatura (280px fixo)

### Depois
- Barra de controlo no topo (simplificada)
- PDF ocupa largura total (sem painel lateral)
- Barra de estado em baixo
- Modal para tudo o que é assinatura

### Paleta de cores

| Token | Valor | Uso |
|-------|-------|-----|
| `--bg` | `#f5f4f2` | fundo body |
| `--surface` | `#ffffff` | painéis, modal |
| `--border` | `#d1cec9` | bordas |
| `--text` | `#2c2a28` | texto principal |
| `--text-muted` | `#6b6560` | status, labels secundários |
| `--btn-primary-bg` | `#374151` | botão principal |
| `--btn-primary-hover` | `#1f2937` | hover botão principal |
| `--overlay-border` | `#374151` | borda dashed do overlay |
| `--overlay-fill` | `rgba(55,65,81,0.05)` | fundo overlay |

### Estrutura HTML

```
body
├── #toolbar          ← barra topo
│   ├── label + #pdf-input
│   ├── #page-nav (◀ label ▶)
│   └── #sign-btn (disabled até overlay colocado)
├── #viewer-panel     ← área PDF, largura total
│   ├── #pdf-wrapper
│   │   ├── #pdf-canvas
│   │   └── #sig-overlay (+ #resize-handle)
│   └── #drop-hint    ← texto "Clique para carregar PDF" antes de carregar
└── #statusbar        ← mensagem de estado em baixo
```

### Comportamento cursor no PDF
- Antes de carregar PDF: `default`
- PDF carregado, sem overlay: `crosshair` (convida a clicar)
- PDF carregado, overlay visível: `default` (overlay tem `move`)

---

## Modal de Assinatura

### Ficheiro: `public/sig-modal.js`

Classe `SigModal`:

```javascript
new SigModal(sigPad)           // recebe instância SigPad existente
sigModal.open()                // mostra modal, foca canvas
sigModal.close()               // fecha modal sem confirmar
// Callback:
sigModal.onConfirm = () => {}  // chamado ao confirmar assinatura válida
```

### Trigger
- Clicar em `#pdf-canvas` (quando PDF carregado) → `sigModal.open()`
- Se overlay já existe → `sigModal.open()` também (permite redesenhar)

### Estrutura HTML do modal (injetada por sig-modal.js no body)

```html
<div id="sig-modal-backdrop">
  <div id="sig-modal">
    <div id="sig-modal-header">
      <span>Desenhar Assinatura</span>
      <button id="sig-modal-close">✕</button>
    </div>
    <div id="sig-modal-body">
      <div id="sig-modal-canvas-wrapper">
        <canvas id="sig-modal-canvas" width="580" height="200"></canvas>
      </div>
      <div id="sig-modal-thickness">
        <label for="thickness-slider">Grossura da caneta</label>
        <div id="thickness-row">
          <span>Fina</span>
          <input type="range" id="thickness-slider" min="1" max="8" value="2" step="0.5" />
          <span>Grossa</span>
          <canvas id="thickness-preview" width="80" height="20"></canvas>
        </div>
      </div>
    </div>
    <div id="sig-modal-footer">
      <div id="sig-modal-left-actions">
        <button id="sig-modal-clear">Limpar</button>
        <button id="sig-modal-load">Carregar guardada</button>
        <button id="sig-modal-save">Guardar</button>
      </div>
      <div id="sig-modal-right-actions">
        <button id="sig-modal-cancel">Cancelar</button>
        <button id="sig-modal-confirm" class="primary" disabled>Confirmar</button>
      </div>
    </div>
  </div>
</div>
```

### Comportamento do modal

| Ação | Resultado |
|------|-----------|
| Clicar fundo (backdrop) | Nada (não fecha) |
| Esc | Fecha (= Cancelar) |
| Botão ✕ | Fecha (= Cancelar) |
| Cancelar | Fecha; assinatura anterior (se existia) mantém-se |
| Confirmar | Fecha; chama `onConfirm`; atualiza preview overlay |
| Limpar | Limpa canvas; desativa "Confirmar" |
| Guardar | `sigPad.saveToStorage()` com assinatura atual do modal |
| Carregar guardada | Preenche canvas do modal; ativa "Confirmar" |

**"Confirmar" ativa** quando canvas não está vazio (evento `endStroke` da signature_pad).

### Grossura da caneta

- Slider `min=1 max=8 step=0.5 value=2`
- Ao mover slider: atualiza `SignaturePad.maxWidth` e `SignaturePad.minWidth` no canvas do modal
- Preview ao vivo: canvas 80×20px desenha linha horizontal com espessura atual + cor `#2c2a28`
- Valor guardado em `localStorage` key `sig_thickness`; carregado ao abrir modal

### Canvas do modal vs canvas principal

O `SigPad` atual usa `#sig-canvas` (260×130). Com o modal, o canvas de desenho passa a ser `#sig-modal-canvas` (580×200).

**Solução:** `SigModal` cria e gere o seu próprio `SignaturePad` interno no `#sig-modal-canvas`. Ao confirmar, exporta PNG via `toDataURL` e passa para `SigPad.loadDataUrl(dataUrl)` (novo método a adicionar a `signature-pad.js`).

Assim `SigPad` continua a ser a fonte de verdade para `app.js` (`.getPng()`, `.getDataUrl()`, `.isEmpty()`).

---

## Alterações por ficheiro

| Ficheiro | Tipo | O que muda |
|---------|------|------------|
| `public/index.html` | Modificar | Nova estrutura: `#toolbar`, `#viewer-panel`, `#statusbar`; remover `#sig-panel`; adicionar `sig-modal.js` |
| `public/style.css` | Substituir | Paleta nova, layout novo, estilos modal |
| `public/sig-modal.js` | Criar | Classe `SigModal` com SignaturePad interno, slider, preview |
| `public/signature-pad.js` | Modificar | Adicionar método `loadDataUrl(dataUrl)` |
| `public/app.js` | Modificar | Remover referências ao `#sig-panel`; adicionar trigger clique PDF → `sigModal.open()`; ligar `sigModal.onConfirm` |
| `public/overlay.js` | Sem alteração | — |
| `public/pdf-viewer.js` | Sem alteração | — |

---

## Fluxo completo após redesign

```
1. Utilizador abre app
   → Toolbar com input PDF; área cinza com hint "Clique para abrir um PDF"
   → Clicar no hint (ou usar input) carrega PDF

2. PDF carregado
   → PDF renderizado a largura total
   → Cursor crosshair sobre o canvas
   → Status: "Clique no PDF para assinar"

3. Utilizador clica no PDF
   → Modal abre
   → Canvas 580×200 pronto para desenhar
   → Slider grossura em valor guardado (ou default 2)

4. Utilizador desenha assinatura
   → "Confirmar" ativa
   → (opcional) ajusta grossura, limpa, carrega guardada

5. Utilizador clica "Confirmar"
   → Modal fecha
   → Overlay aparece centrado no PDF
   → Cursor crosshair desaparece (overlay tem move/resize)
   → Status: "Arraste e redimensione a assinatura"
   → "Assinar e descarregar" ativa

6. Utilizador posiciona overlay, clica "Assinar e descarregar"
   → Download PDF assinado
   → Overlay permanece (permite re-assinar ou mudar página)
```

---

## Restrições globais

- Sem frameworks JS — Vanilla JS puro
- Sem dependências novas — apenas `signature_pad` e `pdf.js` já existentes
- `#sig-canvas` (260×130) mantém-se no DOM mas fica `display:none` — `SigPad` continua a funcionar como fonte de verdade
- localStorage keys: `saved_signature` (PNG dataUrl), `sig_thickness` (número)
- Sem backend changes
