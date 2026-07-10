# Design — Upload de imagem de assinatura com remoção de fundo

Data: 2026-07-10

## Problema

O usuário quer usar uma assinatura feita à mão em papel: tira uma foto (ou
escaneia), faz upload no assinador, e o sistema remove o fundo (papel) deixando
apenas o traço da assinatura. O resultado entra no mesmo pipeline da assinatura
desenhada à mão (overlay no PDF, combinação com carimbo, etc.).

## Decisões (fechadas no brainstorming)

- **Método de remoção de fundo:** threshold de luminância no browser (canvas),
  sem backend, sem ML. Funciona para caneta escura em papel claro.
- **Cor de saída:** forçar traço para cor única escura (`#2c2a28`, mesma da
  caneta do pad), com alpha suave nas bordas (antialiasing).
- **Controle:** slider de threshold com preview ao vivo.
- **UI:** botão "Carregar imagem" no rodapé do modal existente; resultado é
  desenhado no mesmo `sig-modal-canvas`; slider inline aparece quando há imagem.
- **Formatos:** PNG + JPG.

## Arquitetura

### Componente novo: `public/bg-removal.js`

Função pura, sem dependência de DOM, testável em Node/jest sem jsdom.

```js
removeBackground(srcRGBA, width, height, opts) -> Uint8ClampedArray (RGBA)
```

Parâmetros:
- `srcRGBA`: `Uint8ClampedArray` de pixels de origem (formato RGBA, length =
  width*height*4).
- `width`, `height`: dimensões.
- `opts`:
  - `threshold` (0–255): corte de luminância.
  - `softness` (número > 0): largura da rampa de alpha nas bordas. Default 40.
  - `inkColor`: `{ r, g, b }` da cor do traço. Default `#2c2a28` →
    `{ r: 44, g: 42, b: 40 }`.

Algoritmo por pixel:
1. Luminância `L = 0.299*R + 0.587*G + 0.114*B`.
2. Se `L >= threshold`: pixel transparente (`a = 0`), RGB irrelevante (zera).
3. Se `L < threshold`: pixel vira traço:
   - `r,g,b = inkColor`
   - `a = clamp((threshold - L) / softness, 0, 1) * 255`
   - Isto dá alpha 255 no centro escuro do traço e transição suave perto do
     corte (borda antialiasada).

Retorna **novo** array (não muta a origem) para permitir re-threshold repetido
sobre a mesma fonte quando o slider muda.

Exportação dupla:
```js
if (typeof module !== 'undefined' && module.exports) module.exports = { removeBackground };
if (typeof window !== 'undefined') window.removeBackground = removeBackground;
```

### Integração no `public/sig-modal.js`

**HTML novo (`_build`):**
- No rodapé (`sig-modal-left-actions`): botão `#sig-modal-upload`
  ("Carregar imagem").
- `<input type="file" id="sig-modal-file" accept="image/png,image/jpeg" hidden>`.
- Bloco de threshold (dentro do body, análogo ao bloco de grossura), escondido
  por default:
  ```html
  <div id="bg-threshold-wrapper" style="display:none">
    <label for="bg-threshold-slider">Remover fundo</label>
    <input type="range" id="bg-threshold-slider" min="0" max="255" value="180" />
  </div>
  ```

**Estado novo (constructor):**
- `this._uploadedImage = false;`
- `this._sourceImageData = null;` — `ImageData` da foto redimensionada (fonte
  para re-threshold).
- `this._bgThreshold` — lido de localStorage `sig_bg_threshold` (default 180).

**Fluxo de upload:**
1. Click em `#sig-modal-upload` → `.click()` no input file.
2. `change` no input → lê `File` → `Image` via `URL.createObjectURL`.
3. `img.onload`: cria canvas offscreen 580×200, desenha a imagem em modo
   *contain* (mantém aspecto, centralizado, fundo transparente). Guarda
   `getImageData(0,0,580,200)` em `this._sourceImageData`.
4. Chama `_applyThreshold()`.
5. Mostra `#bg-threshold-wrapper`, seta `this._uploadedImage = true`, habilita
   Confirmar.
6. `URL.revokeObjectURL` após load.

**`_applyThreshold()`:**
- Se `!this._sourceImageData` retorna.
- `out = removeBackground(source.data, 580, 200, { threshold: this._bgThreshold })`.
- Limpa `sig-modal-canvas`, `putImageData(new ImageData(out, 580, 200))`.

**Slider threshold (`input` handler):**
- Atualiza `this._bgThreshold`, persiste em localStorage, chama
  `_applyThreshold()`.

**Ajuste nas guardas (imagem ≠ desenho, mas ambos válidos):**
- Confirmar: `if (!this._pad || (this._pad.isEmpty() && !this._uploadedImage)) return;`
- endStroke handler: confirm fica habilitado se `!isEmpty() || _uploadedImage`.
- `sig-modal-clear`: também zera `_uploadedImage`, `_sourceImageData`, esconde
  `#bg-threshold-wrapper`.
- `open()`: ao reabrir, reset de imagem se aplicável (mantém comportamento
  consistente — imagem é por-sessão de modal, não persiste desenhada).

**Confirmar / combinar com carimbo:** sem mudança. O código atual já lê
`document.getElementById('sig-modal-canvas').toDataURL('image/png')` (linha 207)
e `_combineCanvases()` desenha o mesmo canvas. Como o resultado processado já
está desenhado no canvas, a assinatura via imagem flui pelo mesmo caminho e
combina com carimbo normalmente.

## Fluxo de dados

```
File (PNG/JPG)
  → Image
  → canvas offscreen 580x200 (contain)  ── ImageData fonte (guardado)
  → removeBackground(threshold)          ← slider re-dispara aqui
  → putImageData no sig-modal-canvas
  → (confirmar) canvas.toDataURL → SigPad → overlay/PDF, + carimbo opcional
```

## Tratamento de erros

- Arquivo não-imagem ou `img.onload` falha → `img.onerror`: alerta simples
  ("Não foi possível carregar a imagem") e nenhum estado alterado.
- Input file resetado após cada uso (`input.value = ''`) para permitir re-upload
  do mesmo arquivo.

## Testes

`tests/bg-removal.test.js` (jest, ambiente node padrão — função pura, sem DOM):

1. Pixel branco (255,255,255) com threshold 180 → alpha 0 (transparente).
2. Pixel preto (0,0,0) → alpha 255, RGB = inkColor (44,42,40).
3. Pixel cinza logo abaixo do threshold → alpha parcial (0 < a < 255), rampa.
4. Cor forçada: pixel escuro colorido (ex: azul escuro) → RGB vira inkColor,
   não a cor original.
5. Threshold baixo (ex: 50) deixa mais pixels transparentes que threshold alto
   (ex: 220) na mesma imagem sintética.
6. Não muta o array de origem (source inalterado após chamada).
7. Comprimento de saída = width*height*4.

Testes de UI/DOM ficam fora de escopo (projeto não tem jsdom; core testável é a
função pura).

## Fora de escopo (YAGNI)

- HEIC/WebP.
- Detecção automática de threshold (Otsu).
- Preservar cor original do traço.
- Remoção ML / server-side.
- Crop/rotação da imagem.
