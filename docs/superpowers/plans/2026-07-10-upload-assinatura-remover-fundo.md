# Upload de Assinatura com Remoção de Fundo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir upload de uma foto/scan de assinatura em papel, remover o fundo por threshold de luminância no browser, e usar o resultado como assinatura no pipeline existente.

**Architecture:** Uma função pura `removeBackground` (novo arquivo, sem DOM, testada com jest) faz a matemática de pixels. O `sig-modal.js` ganha um botão de upload, um input file, um slider de threshold com preview ao vivo, e desenha o resultado processado no `sig-modal-canvas` já existente — de modo que o fluxo de confirmar/combinar-com-carimbo não muda.

**Tech Stack:** Vanilla JS (browser Canvas API), jest (node, sem jsdom).

## Global Constraints

- Cor do traço forçada: `#2c2a28` → `{ r: 44, g: 42, b: 40 }`.
- Canvas de assinatura: 580×200 (fixo, igual ao existente).
- Formatos aceitos: `image/png`, `image/jpeg` apenas.
- `removeBackground` NÃO pode depender de DOM (deve rodar em node/jest).
- `removeBackground` retorna novo array, não muta a origem.
- localStorage key do threshold: `sig_bg_threshold` (default 180).
- Sem novas dependências npm.

---

### Task 1: Função pura `removeBackground`

**Files:**
- Create: `public/bg-removal.js`
- Test: `tests/bg-removal.test.js`

**Interfaces:**
- Consumes: nada (função autônoma).
- Produces:
  ```js
  removeBackground(srcRGBA /* Uint8ClampedArray | number[] */, width, height, opts)
    -> Uint8ClampedArray  // RGBA, length = width*height*4
  // opts = { threshold: number(0-255), softness?: number(default 40),
  //          inkColor?: {r,g,b}(default {r:44,g:42,b:40}) }
  ```
  Regra por pixel: `L = 0.299R + 0.587G + 0.114B`.
  Se `L >= threshold` → `a=0` (e r,g,b=0). Senão → `r,g,b=inkColor`,
  `a = clamp((threshold - L)/softness, 0, 1) * 255` (arredondado).
  Exposto via `module.exports` e `window.removeBackground`.

- [ ] **Step 1: Escrever os testes que falham**

`tests/bg-removal.test.js`:
```js
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd /home/afonso/docker/assinador_pdf && npx jest tests/bg-removal.test.js`
Expected: FAIL — `Cannot find module '../public/bg-removal'`.

- [ ] **Step 3: Implementar `public/bg-removal.js`**

```js
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
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd /home/afonso/docker/assinador_pdf && npx jest tests/bg-removal.test.js`
Expected: PASS — 7 passed.

- [ ] **Step 5: Rodar suíte inteira (não quebrar backend)**

Run: `cd /home/afonso/docker/assinador_pdf && npx jest`
Expected: PASS — 11 passed (4 sign + 7 bg-removal).

- [ ] **Step 6: Commit**

```bash
cd /home/afonso/docker/assinador_pdf
git add public/bg-removal.js tests/bg-removal.test.js
git commit -m "feat: add removeBackground pure function with luminance threshold"
```

---

### Task 2: Integração no modal de assinatura (upload + slider + preview)

**Files:**
- Modify: `public/index.html` (adicionar `<script src="bg-removal.js">` antes de `sig-modal.js`)
- Modify: `public/sig-modal.js`

**Interfaces:**
- Consumes: `window.removeBackground(srcRGBA, w, h, { threshold })` da Task 1.
- Produces: nenhuma API nova consumida por outros arquivos. O resultado
  processado é desenhado no `#sig-modal-canvas`, cujo `toDataURL` já é lido
  pelo fluxo de confirmar/combinar existente (linhas ~207–212 de sig-modal.js).

**Verificação:** este task altera só DOM/UI; o projeto não tem jsdom. A
verificação é manual no app rodando (passos no fim do task) + a suíte jest
existente deve continuar verde.

- [ ] **Step 1: Incluir o script no index.html**

Em `public/index.html`, localizar a linha que carrega `sig-modal.js` e inserir
`bg-removal.js` **antes** dela (para `window.removeBackground` existir):
```html
    <script src="bg-removal.js"></script>
    <script src="sig-modal.js"></script>
```
(Se `sig-modal.js` usa `defer`, usar `defer` também no novo script, mantendo a
ordem.)

- [ ] **Step 2: Adicionar HTML do botão, input file e slider no `_build()`**

Em `public/sig-modal.js`, dentro de `_build()`:

(a) No bloco `#sig-modal-left-actions`, após o botão "Carregar guardada",
adicionar botão de upload + input file escondido:
```html
            <button id="sig-modal-upload" type="button">Carregar imagem</button>
            <input type="file" id="sig-modal-file" accept="image/png,image/jpeg" hidden />
```

(b) No `#sig-modal-body`, logo após o bloco `#sig-modal-thickness`, adicionar o
slider de threshold (escondido por default):
```html
          <div id="bg-threshold-wrapper" style="display:none">
            <label for="bg-threshold-slider">Remover fundo (sensibilidade)</label>
            <div id="bg-threshold-row">
              <span>Menos</span>
              <input type="range" id="bg-threshold-slider" min="0" max="255" value="180" />
              <span>Mais</span>
            </div>
          </div>
```

- [ ] **Step 3: Adicionar estado no constructor**

Em `constructor(sigPad)`, junto aos outros campos, adicionar:
```js
    this._uploadedImage = false;
    this._sourceImageData = null;
    this._bgThreshold = parseInt(localStorage.getItem('sig_bg_threshold') || '180', 10);
```

- [ ] **Step 4: Adicionar métodos `_loadImageFile` e `_applyThreshold`**

Adicionar como métodos da classe (ex.: após `_combineCanvases`):
```js
  _loadImageFile(file) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const W = 580, H = 200;
      const off = document.createElement('canvas');
      off.width = W; off.height = H;
      const octx = off.getContext('2d');
      octx.clearRect(0, 0, W, H);
      // contain: mantém aspecto, centraliza
      const scale = Math.min(W / img.width, H / img.height);
      const dw = img.width * scale, dh = img.height * scale;
      const dx = (W - dw) / 2, dy = (H - dh) / 2;
      octx.drawImage(img, dx, dy, dw, dh);
      this._sourceImageData = octx.getImageData(0, 0, W, H);
      URL.revokeObjectURL(url);

      this._applyThreshold();
      this._uploadedImage = true;
      document.getElementById('bg-threshold-wrapper').style.display = 'block';
      document.getElementById('bg-threshold-slider').value = this._bgThreshold;
      document.getElementById('sig-modal-confirm').disabled = false;
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      alert('Não foi possível carregar a imagem.');
    };
    img.src = url;
  }

  _applyThreshold() {
    if (!this._sourceImageData) return;
    const W = 580, H = 200;
    const out = window.removeBackground(
      this._sourceImageData.data, W, H, { threshold: this._bgThreshold }
    );
    const canvas = document.getElementById('sig-modal-canvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    ctx.putImageData(new ImageData(out, W, H), 0, 0);
  }
```

- [ ] **Step 5: Ligar os eventos no `_bind()`**

(a) No handler de `click` (`el.addEventListener('click', ...)`), adicionar antes
do fechamento:
```js
      if (id === 'sig-modal-upload') {
        document.getElementById('sig-modal-file').click();
        return;
      }
```

(b) No mesmo handler de `click`, no ramo `sig-modal-clear`, também resetar a
imagem — substituir o bloco existente por:
```js
      if (id === 'sig-modal-clear') {
        if (this._pad) this._pad.clear();
        this._uploadedImage = false;
        this._sourceImageData = null;
        document.getElementById('bg-threshold-wrapper').style.display = 'none';
        document.getElementById('sig-modal-confirm').disabled = true;
        return;
      }
```

(c) No handler de `click`, no ramo `sig-modal-confirm`, ajustar a guarda para
aceitar imagem — substituir a primeira linha do bloco:
```js
      if (id === 'sig-modal-confirm') {
        if (!this._pad || (this._pad.isEmpty() && !this._uploadedImage)) return;
```
(o resto do bloco confirm permanece igual).

(d) No handler de `change` (`el.addEventListener('change', ...)`), adicionar o
ramo do input file:
```js
      if (e.target.id === 'sig-modal-file') {
        this._loadImageFile(e.target.files[0]);
        e.target.value = '';
        return;
      }
```

(e) No handler de `input` (`el.addEventListener('input', ...)`), adicionar o
ramo do slider de threshold:
```js
      if (e.target.id === 'bg-threshold-slider') {
        this._bgThreshold = parseInt(e.target.value, 10);
        localStorage.setItem('sig_bg_threshold', String(this._bgThreshold));
        this._applyThreshold();
        return;
      }
```

- [ ] **Step 6: Reset de imagem ao fechar o modal**

No método `close()`, resetar o estado de imagem para não vazar entre aberturas:
```js
  close() {
    this._el.style.display = 'none';
    this._uploadedImage = false;
    this._sourceImageData = null;
    const w = document.getElementById('bg-threshold-wrapper');
    if (w) w.style.display = 'none';
  }
```

- [ ] **Step 7: Rodar a suíte jest (garantir que nada quebrou)**

Run: `cd /home/afonso/docker/assinador_pdf && npx jest`
Expected: PASS — 11 passed.

- [ ] **Step 8: Verificação manual no app**

```bash
cd /home/afonso/docker/assinador_pdf && docker compose up -d --build app
```
Abrir http://localhost:3000 e:
1. Carregar um PDF, abrir o modal de assinatura.
2. Clicar "Carregar imagem", escolher uma foto de assinatura (PNG/JPG).
3. Confirmar que o fundo some e só o traço (escuro) aparece no canvas.
4. Mexer no slider "Remover fundo" — preview atualiza ao vivo.
5. "Confirmar" → assinatura vira overlay no PDF.
6. Testar combinação com carimbo (ativar carimbo + imagem) → PNG final contém
   assinatura por imagem + carimbo.
7. "Limpar" → some a imagem e o slider; Confirmar volta a ficar desabilitado.

- [ ] **Step 9: Commit**

```bash
cd /home/afonso/docker/assinador_pdf
git add public/index.html public/sig-modal.js
git commit -m "feat: upload signature image with live background removal in sig modal"
```

---

## Notas de verificação final

- Suíte jest: `npx jest` → 11 passed.
- Feature validada manualmente no app (Task 2, Step 8).
- Sem novas dependências npm; sem mudanças no backend (`src/`).
