# portal-aluno

A read-only API for your own data in the SENAI Portal do Aluno. It runs on your computer and talks to the portal with your account. No other server is involved.

Class project, not official, not affiliated with SENAI or FIEB. Scope and limits: [INTENT.md](INTENT.md). What the portal exposes: [ENDPOINTS.md](ENDPOINTS.md).

## Status

- [x] Core client: login, context cookie, re-login on expiry, rate limit (`src/core`)
- [x] Operations: `/periodos`, `/disciplinas`, `/notas`, `/faltas`, `/faltas/aulas`, `/horario` (`src/operations`)
- [x] OpenAPI 3.1 document generated from the operations ([openapi.json](openapi.json))
- [x] Local server (`portal-aluno serve`)
- [x] Docs page with "testar", built from `openapi.json` (`web/`)
- [ ] More operations (calendário, aulas, materiais)
- [ ] MCP server

## Requirements

Node.js 22 or newer.

## Use

```sh
npm install
npm run serve                     # builds the docs page, then serves; or: npm run build && node dist/cli/main.js serve
npm run serve -- --port 5000 --period 2026S1
```

It asks for your user and password in the terminal (the password is not echoed), or reads `PORTAL_ALUNO_USER` and `PORTAL_ALUNO_PASSWORD`. Then it prints:

```
✓ Conectado. Matrícula do período 2026S2.

Documentação: http://127.0.0.1:4321/docs/#token=…
Token:        …
```

Open the link: the page already carries the token, so "Enviar requisição" works right away. From other tools, send `Authorization: Bearer <token>`. The token changes on every run.

## How the local server stays local

- It listens on `127.0.0.1` only.
- Every API route needs the per-run token. `/docs`, `/openapi.json` and `/health` don't, and none of them carry personal data.
- It answers only when the `Host` header is `127.0.0.1:<port>` or `localhost:<port>`, which blocks DNS-rebinding attacks.
- It sends no CORS headers, so other sites open in your browser can't read its responses.
- The docs page is built into `dist/web` and served by this server, fonts included (no CDN). Its Content-Security-Policy allows scripts, styles and requests only to this server, with no inline code.
- The token reaches the page in the link's `#hash`, which browsers never send to servers. The page keeps it in `sessionStorage` (this tab only) and removes it from the address bar.
- The request log has method, path, status and time. No query strings, no bodies.

## Development

```sh
npm test            # unit tests against an in-memory fake portal, no network
npm run typecheck
npm run openapi     # regenerate openapi.json after changing an operation (a test fails if you forget)
npm run build       # docs page to dist/web, server to dist/
```

Work on the docs page without logging in to the real portal:

```sh
npm run dev:fake    # the real server against the fake portal (made-up data), token "dev"
npm run dev:web     # in another terminal: the page with hot reload, at http://localhost:5173/docs/#token=dev
```

Run one operation against the real portal, without the server:

```sh
npm run try                                   # lists the operations
npm run try -- notas
npm run try -- listarDisciplinas '{"apenasEmCurso":true}'
npm run try -- faltas/aulas '{"de":"2026-08-01"}'
npm run try -- horario '{"incluirEncerrados":true}'
```

The output is your own data, so don't paste it anywhere public.

## Layout

```
src/
  core/          talks to the portal
    auth.ts        login steps (ListarAlias → form POST → AutoLoginPortal → getcurrentuser)
    context.ts     enrollment context and the context cookie
    session.ts     PortalSession: in-memory session, re-login, getData()
    http.ts        fetch + cookie jar + throttle, no automatic redirects
    response.ts    status handling, envelope, schema validation
    errors.ts      PortalError and its codes
  operations/    one file per endpoint of this API: docs, schemas, handler
  openapi/       builds the OpenAPI document from the operations
  http/          the local server (Hono): routes, token, errors, docs page
  cli/           `portal-aluno` command and terminal prompts
web/             the docs page (React + Vite). Reads /openapi.json; knows nothing else about the API
  src/lib/       pure logic: spec model, Markdown subset, fields, samples, search (tested in test/web.test.ts)
  src/components/
scripts/         dev runner (try.ts), openapi.json writer, fake-portal server (fake-serve.ts)
test/            Vitest, with an in-memory fake portal (test/support)
```

### Adding an endpoint

1. Read the endpoint's section in ENDPOINTS.md. Only build on verified behavior.
2. Add `src/operations/<name>.ts` with `defineOperation`: the upstream schema (only the fields you use, types as recorded), the output schema with `.describe()` on each field, a made-up `example`, callouts for anything surprising, and the handler.
3. Register it in `src/operations/index.ts`.
4. Add a test in `test/operations.test.ts` using `academicRoute` from the fake portal.
5. Run `npm run openapi`. The route, the docs page and the spec update from the definition.

## Rules the code follows

- Only GET requests to the API. Never `Logout` or `Contexto/Selecao`.
- The password is only sent to the configured portal origin, and the core never stores it. It's asked for through the credentials provider whenever a login is needed.
- Cookies live in memory. Nothing is written to disk or logged.
- Error messages name fields and types, never values from the portal.
- If the portal refuses a request (403), the error is passed on. There is no retry another way.
