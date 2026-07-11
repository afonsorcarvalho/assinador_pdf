# assinador_pdf

Assinador de PDF no browser: desenha/carrega assinatura, posiciona sobre o PDF, descarrega assinado. Backend Express (`src/`), frontend Vanilla JS (`public/`), Docker + nginx (profile opcional).

## Controle de versão (SemVer)

- **Fonte única da versão: `package.json` (`version`)**, em SemVer (`MAJOR.MINOR.PATCH`).
- O rodapé da app **lê a versão de `package.json`** via endpoint `GET /version` (`src/server.js`) e preenche `#app-version`. Nunca hardcodar a versão noutro sítio; o valor em `index.html` é só fallback.
- **Ao lançar** (mudança visível ao utilizador que vai pra `origin/master`):
  1. Bump em `package.json`: `PATCH` (fix), `MINOR` (feature nova compatível), `MAJOR` (quebra).
  2. Commit do bump.
  3. Tag anotada: `git tag -a vX.Y.Z -m "vX.Y.Z"`.
  4. Push com tags: `git push && git push --tags`.
- Manter o fallback de `#app-version` em `index.html` sincronizado com o `package.json` no mesmo commit do bump.

## Testes

- `npm test` (jest, sem jsdom). Lógica pura (ex.: `public/bg-removal.js`, `src/sign.js`) tem testes; UI/DOM é verificação manual no browser.

## Commits / push

- Commits e push via subagente (haiku). Não fazer push sem pedido explícito.
