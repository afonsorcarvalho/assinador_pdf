# Configurar Apache: sistema.fitadigital.com.br/assinador_pdf

## Objectivo
Expor a app `assinador_pdf` (já a correr em Docker) no subpath
`https://sistema.fitadigital.com.br/assinador_pdf/`, sem quebrar o Odoo
que já responde na raiz desse mesmo domínio.

## Estado actual (verificado nesta sessão)

- Domínio `sistema.fitadigital.com.br` tem dois VirtualHosts:
  - `/etc/apache2/sites-enabled/000-fitadigital.conf` → `*:80`, apenas
    redirect para https (`RewriteRule` para `%{SERVER_NAME}%{REQUEST_URI}`).
  - `/etc/apache2/sites-enabled/000-fitadigital-le-ssl.conf` → `*:443`,
    com SSL (Let's Encrypt) e o `ProxyPass "/" "http://localhost:8069/"`
    para o Odoo. **É este o ficheiro a editar.**
- `assinador_pdf` corre via `docker-compose.yml` em
  `/home/fitadigital/assinador_pdf`, container `assinador_pdf-app-1`,
  publicado em **localhost:3001** (host) → **3000** (container).
  Confirmado a responder: `curl http://localhost:3001/` → `HTTP 200`.
- A app (Express, `src/server.js`) usa apenas rotas relativas: `/health`,
  `sign` (fetch relativo, sem barra inicial) e assets estáticos com `src`/`href`
  relativos (`style.css`, `app.js`, etc.). **Não tem base path configurável**,
  por isso o proxy tem de preservar o path (sem strip) e garantir barra final
  para os caminhos relativos resolverem correctamente.

## Passos

1. Confirmar módulos Apache necessários (normalmente já activos, pois outros
   domínios do mesmo servidor — n8n, portainer, myedocs — já usam proxy):
   ```
   sudo a2enmod proxy proxy_http headers
   ```

2. Inspeccionar o VirtualHost actual antes de editar:
   ```
   sudo cat /etc/apache2/sites-enabled/000-fitadigital-le-ssl.conf
   ```
   Confirmar que existe um bloco `<VirtualHost *:443>` com SSL activo e um
   `ProxyPass "/" "http://localhost:8069/"` (ou equivalente) para o Odoo.

3. Dentro desse mesmo bloco `<VirtualHost *:443>` (ficheiro
   `000-fitadigital-le-ssl.conf`), **antes** da(s) directiva(s)
   `ProxyPass "/" ...` do Odoo, adicionar:
   ```apache
   # assinador_pdf (subpath)
   RewriteEngine On
   RewriteRule ^/assinador_pdf$ /assinador_pdf/ [R=301,L]
   ProxyPass /assinador_pdf/ http://localhost:3001/
   ProxyPassReverse /assinador_pdf/ http://localhost:3001/
   ```
   Motivo da ordem: o Apache resolve `ProxyPass` pelo prefixo mais específico,
   mas colocar o subpath antes da regra raiz evita ambiguidade em qualquer
   versão do mod_proxy.

   **Importante — usar `RewriteRule`, não `RedirectMatch`:** testado nesta sessão
   e confirmado que `RedirectMatch ^/assinador_pdf$ ...` **não funciona** aqui:
   o hook `translate_name` do `mod_proxy` corre antes do `mod_alias`, por isso o
   `ProxyPass "/"` do Odoo intercepta o pedido sem barra final antes do
   `RedirectMatch` ter oportunidade de agir (o pedido a `/assinador_pdf` sem
   barra devolvia HTTP 500 do próprio Odoo/Werkzeug, em vez do redirect). O
   `mod_rewrite`, com `RewriteEngine On` neste bloco, tem prioridade sobre o
   `mod_proxy` e devolve corretamente `301` com `Location:
   .../assinador_pdf/`. Isto é essencial porque os assets da app usam caminhos
   relativos, logo aceder sem a barra final teria de ser sempre redirecionado.

4. Testar a sintaxe e recarregar:
   ```
   apache2ctl configtest
   apache2ctl -k graceful   # ou: systemctl reload apache2
   ```

5. Validar:
   ```
   curl -I https://sistema.fitadigital.com.br/assinador_pdf/
   curl -I https://sistema.fitadigital.com.br/assinador_pdf   # deve dar 301 -> .../assinador_pdf/
   curl -I https://sistema.fitadigital.com.br/          # confirmar que o Odoo continua ok
   ```
   Abrir no browser e testar o fluxo completo de assinatura (upload + `/sign`).

## Rollback

Se algo quebrar, remover as 4 linhas adicionadas no passo 3 (bloco
`# assinador_pdf (subpath)` até ao `ProxyPassReverse`) e repetir o passo 4.
Backup do ficheiro original guardado em
`/etc/apache2/sites-available/000-fitadigital-le-ssl.conf.bak-<timestamp>`.

## Notas

- Aplicado nesta sessão (2026-07-10): as 4 linhas foram adicionadas a
  `000-fitadigital-le-ssl.conf`, `configtest` OK, reload feito com
  `apache2ctl -k graceful`. Validado: `/assinador_pdf/` → 200,
  `/assinador_pdf` (sem barra) → 301 para a versão com barra, asset
  `/assinador_pdf/style.css` → 200.
- **Odoo na raiz (`/`) está a devolver HTTP 500** (erro do próprio backend
  Werkzeug/Python, não do Apache/proxy — confirmado pelo header
  `Server: Werkzeug/1.0.1 Python/3.9.2` no corpo da resposta de erro). Isto é
  pré-existente e não foi introduzido por esta alteração; precisa de
  investigação à parte na aplicação Odoo.
- Atualizar a memória `infra_apache2_sites.md` acrescentando a linha do
  subpath `/assinador_pdf` → `:3001` ao mapa de serviços do `000-fitadigital`
  (ficheiro `000-fitadigital-le-ssl.conf`).
