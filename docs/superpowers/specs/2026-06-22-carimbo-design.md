# Design: Carimbo (Stamp) no Assinador PDF

**Data:** 2026-06-22  
**Estado:** aprovado

## Contexto

O assinador PDF permite ao utilizador desenhar uma assinatura manuscrita e posicioná-la num PDF. Este feature adiciona um "carimbo" — bloco de texto formatado multi-linha (nome, título, cargo) — que aparece abaixo da assinatura no PDF como bloco unificado.

## Decisões Chave

| Decisão | Escolha | Motivo |
|---------|---------|--------|
| Integração no modal | Footer do sig-modal (secção colapsável) | Sem modal extra; workflow contínuo |
| Bloco no overlay | Unificado com assinatura | Use-case pedido: sig + carimbo juntos |
| Formato para backend | PNG combinado único | Backend intacto; sem mudança em sign.js/server.js |
| Renderização do texto | Canvas 2D HTML | Suporte a qualquer fonte CSS; bold/italic nativos |

## Arquitectura

**Ficheiros alterados:** `public/sig-modal.js`, `public/style.css`  
**Ficheiros não alterados:** `overlay.js`, `sign.js`, `server.js`, `app.js`, `index.html`

### Fluxo

1. User clica PDF → sig-modal abre
2. Modal mostra área de assinatura (existente) + secção carimbo colapsável abaixo
3. User activa checkbox "Carimbo" → secção expande
4. User preenche textarea (multi-linha) + aplica formatação → preview live actualiza
5. Ao confirmar: `_combineCanvases()` combina sig + stamp num PNG único
6. `onConfirm(dataUrl)` com PNG combinado → overlay mostra bloco unificado (sem mudança)
7. Backend embede PNG único — sem mudança

Se secção carimbo não activada → comportamento idêntico ao actual.

## Layout do Modal

```
┌──────────────────────────────────────────────────────────┐
│ Desenhar Assinatura                                   [✕] │
├──────────────────────────────────────────────────────────┤
│ [canvas 580×200 — área de assinatura]                    │
│ Grossura: Fina ──●────── Grossa  [preview linha]         │
├──────────────────────────────────────────────────────────┤
│ ☐ Carimbo (opcional)                                     │
│ (colapsado por defeito; expande ao activar checkbox)     │
│                                                          │
│  Arial ▾ | 12 ▾ | B  I | ≡  ≡  ≡                       │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ AFONSO FLAVIO RIBEIRO DE CARVALHO                    │ │
│ │    Eng. Eletric. CREA-MG 7594                        │ │
│ │       Responsável técnico                            │ │
│ └──────────────────────────────────────────────────────┘ │
│ [preview canvas — live render do texto formatado]        │
├──────────────────────────────────────────────────────────┤
│ [Limpar][Carregar guardada][Guardar]  [Cancelar][OK]     │
└──────────────────────────────────────────────────────────┘
```

## Componentes

### Secção Carimbo (em `sig-modal.js`)

**HTML adicionado ao `_build()`:**
- `#stamp-toggle` — checkbox + label "Carimbo (opcional)"
- `#stamp-section` — wrapper colapsável (`display:none` por defeito)
  - `#stamp-toolbar` — font select, size input, bold btn, italic btn, align btns (L/C/R)
  - `#stamp-textarea` — `<textarea>` multi-linha, 4 rows, monospace para alinhamento visual
  - `#stamp-preview` — `<canvas>` com preview live (width=580, height dinâmico)

**Métodos adicionados:**
- `_renderStampPreview()` — desenha texto em `#stamp-preview` com formatação actual; chamado a cada `input` no textarea e na toolbar
- `_combineCanvases()` — retorna `dataUrl` do canvas combinado (sig em cima, stamp em baixo com `gap=8px`); se stamp não activo ou vazio, retorna só sig

### Combinação de Canvases

```
sigCanvas  : 580 × 200 (existente)
stampCanvas: 580 × (N_linhas × fontSize × 1.4 + 16px padding)
gap        : 8px (linha fina separadora, cor #ccc)

outputCanvas: 580 × (200 + 8 + stampH)
  ctx.drawImage(sigCanvas, 0, 0)
  // separador
  ctx.fillStyle = '#cccccc'
  ctx.fillRect(0, 208, 580, 1)
  // stamp lines
  ctx.font = `${italic?'italic ':''} ${bold?'bold ':''} ${size}px ${family}`
  ctx.fillStyle = '#2c2a28'
  ctx.textAlign = align  // 'left' | 'center' | 'right'
  linhas.forEach((linha, i) => ctx.fillText(linha, x, sigH + gap + i * lineH))
```

`x` depende de `align`: left→8, center→290, right→572.

### Opções de Formatação

| Opção | Tipo | Valores | Defeito |
|-------|------|---------|---------|
| Família | `<select>` | Arial, Georgia, Courier New, Times New Roman | Arial |
| Tamanho | `<input type=number>` | 8–24 | 12 |
| Negrito | toggle button | on/off | off |
| Itálico | toggle button | on/off | off |
| Alinhamento | 3 botões (L/C/R) | left/center/right | center |

### Persistência (localStorage)

| Chave | Valor |
|-------|-------|
| `stamp_enabled` | `"true"/"false"` |
| `stamp_text` | string multi-linha |
| `stamp_font` | família |
| `stamp_size` | número |
| `stamp_bold` | `"true"/"false"` |
| `stamp_italic` | `"true"/"false"` |
| `stamp_align` | `"left"/"center"/"right"` |

Carregado no `open()` do modal; guardado a cada `input`.

## Testes

Os testes existentes em `__tests__/` não cobrem o modal (são para `sign.js`). Não são adicionados testes novos — a lógica de combinação é browser-only (canvas 2D). Verificação manual: abrir app, activar carimbo, confirmar, verificar overlay + PDF descarregado.

## Scope Excluído

- Carimbo sem assinatura (só carimbo) — não pedido
- Múltiplos carimbos — não pedido
- Upload de imagem no carimbo — não pedido
- Texto pesquisável no PDF — escolha foi PNG (opção A)
