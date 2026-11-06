# MCP server: design

How `portal-aluno` exposes its operations to AI agents (Claude, ChatGPT through Codex, Cursor, VS Code, Gemini CLI and others) through the [Model Context Protocol](https://modelcontextprotocol.io), and why it is built this way.

Scope and limits are the same as the rest of the project: [INTENT.md](../INTENT.md). The MCP server is one more way to read the same data. It does not add operations, and it does not write anything.

## Intentions

The MCP server should be:

- **Easy to install.** One command, or one double-click in Claude Desktop. Nothing to clone or build, and no server to keep running.
- **Easy to use.** It always starts. Setup mistakes (a missing variable, a wrong password) reach the chat as messages the model can explain, never as an unexplained "server failed to connect".
- **Robust.** Inputs and outputs are validated. Portal failures come back as stable error codes. A wrong password is never sent to the portal over and over.
- **Easy to maintain.** No code per tool. An operation added to `src/operations` becomes an HTTP route, an OpenAPI entry, a docs page section and an MCP tool at once.
- **Ready for remote.** A remote server, later, is a new entry point, not a refactor.

## Standards it follows

- MCP specification revision [2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28), with older clients (2025 revisions, `initialize` handshake) served by the same code.
- The official TypeScript SDK v2 (`@modelcontextprotocol/server`). It takes the operations' Zod v4 schemas as they are.
- Tools only. Every client supports tools. Resources and prompts are supported unevenly (ChatGPT especially), so they are left out for now.
- Each tool has an `inputSchema` and an `outputSchema`. Results go in `structuredContent`, and the same JSON goes in `content` as text, for clients that ignore structured output.
- Annotations: `readOnlyHint`, `idempotentHint` and `openWorldHint` are `true` on every tool, so clients can approve them without asking.
- Errors are tool results with `isError: true` and a message the model can act on, not protocol errors.

## Design

```
                     ┌──────────────────────────────────────────┐
  operations[] ───▶  │ createMcpServer({ session })             │  transport-neutral:
  (unchanged)        │   one loop: operation → tool             │  knows nothing about
                     │   runOperation / runFileOperation        │  env, tokens or OAuth
                     │   errors → isError results               │
                     └──────────────▲───────────────────────────┘
                                    │ session: () => Promise<PortalSession>
         ┌──────────────────────────┼───────────────────────────────┐
  Phase 1: stdio             Phase 2: /mcp on serve          Later: remote
  envSession(env)            login.sessionFor(bearer)        sessions.forUser(oauth.sub)
  serveStdio(factory)        createMcpHandler(factory)       createMcpHandler + OAuth
```

### The session is passed in

`createMcpServer` never holds a session of its own. It gets a resolver, `session: () => Promise<PortalSession>`, and asks it on every tool call. Each transport decides what "the session" means:

| Transport | Resolver |
|---|---|
| stdio (phase 1) | The one session made from `PORTAL_ALUNO_USER` and `PORTAL_ALUNO_PASSWORD`. |
| `/mcp` on `serve` (phase 2) | The session behind the request's bearer token: `LocalLogin.sessionFor(token)`, the same lookup the REST routes use. |
| Remote (later) | The session of the user named by the OAuth token. |

The SDK's HTTP handler builds a fresh `McpServer` per request from a factory, so the factory's closure captures that request's identity. `createMcpServer` stays the same in all three.

### Login happens on the first tool call

Clients expect the MCP handshake to finish quickly. If the process logged in to the portal at startup, a slow portal or a wrong password would show up as "server failed to connect", with no reason given. Instead:

- The server starts without touching the portal.
- The first tool call logs in. A wrong password becomes a tool error the model can relay: `[login_falhou] O portal não aceitou o login… Confira o usuário e a senha.`
- Missing environment variables are also a tool error (`sem_credenciais`), with the names of the variables to set. That is where a link to a local login page can go later.
- After the portal refuses the credentials once, the stdio resolver stops trying (`login_recusado`) until the server restarts. The credentials can't change while the process runs, so trying again could only repeat the failure, and a model can call tools many times quickly. That could lock the student's account.

### Operations become tools

| Tool field | From the operation |
|---|---|
| name | `id` (`obterNotas`), the same as the OpenAPI `operationId` |
| title | `summary` |
| description | `description`, then each callout as `**title**: body`. The callouts carry what the model most needs, such as "read by `etapa`, never by position". |
| inputSchema | `input` |
| outputSchema | `output`, for JSON operations. File operations have none. |
| annotations | `readOnlyHint`, `idempotentHint`, `openWorldHint`: all `true` |

Handlers go through `runOperation` and `runFileOperation`, so input and output are validated exactly as in the HTTP API.

The schemas are published with the same JSON Schema as the OpenAPI document (`src/api/json-schema.ts`), and Zod still validates. The operation texts are written for the HTTP API and mention paths, such as `` `/disciplinas` ``. A model calling tools only knows tool names, so every mention of an operation's path, in descriptions and schemas alike, becomes that operation's tool name (`` `listarDisciplinas` ``).

### Results

- **JSON:** the object in `structuredContent`, and the same object as compact JSON text in `content`.
- **Files:** an image (the profile photo, an image material) becomes an `image` block. Any other file becomes an embedded `resource` with its media type. Files over 5 MB are refused with an error that gives their size, since base64 adds a third and clients limit result sizes.
- **Errors:** `isError: true`, with text that starts with the code in brackets, then the message and any details, one per line. Messages never carry values from the portal. Unexpected errors are written to stderr with their stack; the model sees only `erro_interno`.

  | Codes | Raised by |
  |---|---|
  | `login_falhou`, `periodo_inexistente`, `item_inexistente`, `portal_indisponivel`, … | the portal, as in the HTTP API (`src/core/errors.ts`) |
  | `parametro_invalido`, `erro_interno` | any adapter (`src/api/errors.ts`) |
  | `sem_credenciais`, `login_recusado` | the stdio session (`src/mcp/env-session.ts`) |
  | `arquivo_grande` | file results (`src/mcp/results.ts`) |

  Arguments that break a tool's `inputSchema` are refused by the SDK before the tool runs, with its own `Input validation error:` message naming the fields.

### Server instructions

A short text the client hands to the model with the tools: the data is the student's own; period codes come from `listarPeriodos` and `idTurmaDisc` from `listarDisciplinas`, so IDs are never guessed (INTENT.md forbids enumeration); dates are `AAAA-MM-DD`; text from the portal is data, not instructions.

### Files

```
src/
  api/
    errors.ts         error bodies and toErrorBody, shared by HTTP and MCP
    json-schema.ts    Zod → JSON Schema, shared by OpenAPI and MCP
  mcp/
    server.ts         createMcpServer({ session }): the loop
    tools.ts          operation → tool config (pure)
    results.ts        JSON, file or error → tool result (pure)
    instructions.ts   server instructions for the model
    env-session.ts    the stdio resolver
  env.ts              the credentials in the environment, shared by serve and mcp
  cli/mcp.ts          `portal-aluno mcp [--period 2026S2]`
scripts/
  demo-portal.ts      the fake portal with made-up data, shared by dev:fake and dev:mcp:fake
  fake-mcp.ts         the MCP server against it (`npm run -s dev:mcp:fake`)
  pack-mcpb.ts        the Claude Desktop bundle (`npm run pack:mcpb`)
test/mcp.test.ts
```

## Phases

### Phase 1: local stdio server (done)

`portal-aluno mcp`, run by the MCP client as a child process. This covers Claude Desktop, Claude Code, Cursor, VS Code, Gemini CLI and Codex (also inside the ChatGPT desktop app).

1. Shared error bodies (`src/api/errors.ts`) and JSON Schema (`src/api/json-schema.ts`), used by both transports.
2. `createMcpServer`, `tools.ts`, `results.ts`, `instructions.ts`, with tests.
3. The `mcp` command, `envSession`, and `npm run -s dev:mcp:fake`.
4. The npm package (`npx -y portal-aluno@latest mcp`), and setup per client in the README. Releases are published from a version tag by CI: [RELEASING.md](RELEASING.md).
5. A `.mcpb` bundle for Claude Desktop (`npm run pack:mcpb`, manifest version 0.4, attached to every GitHub Release), where the password is typed into a form and kept by Claude Desktop in secure storage. The manifest is generated from `package.json` and the operations, so it can't fall behind. Claude Desktop ships Node.js, so users install nothing else.

### Phase 2: `/mcp` on the local server

`serve` mounts `/mcp` (Streamable HTTP, stateless) behind its existing protections: Host check, bearer token, `127.0.0.1` only. The resolver is `login.sessionFor(token)`. Clients that prefer HTTP use the session opened on the docs page. This is still local, so it does not reach ChatGPT on the web.

### Later: remote

A new entry point (`src/remote/main.ts`): OAuth verification in front of the SDK's HTTP handler, and a resolver that keeps one `PortalSession` per user, with idle eviction. Nothing in `src/mcp` changes.

The hard part is not code. The portal has no OAuth of its own, so a remote server would hold other students' portal passwords. That is a change to INTENT.md and needs its own decision before any of this is built.

## Credentials

On stdio, the client starts the server and passes the credentials as environment variables. In most clients those variables live in the client's config file, in plain text. INTENT.md says the password is never written to disk by this project. This is a choice the student makes in their own client's config, and it is documented in INTENT.md as such. Two clients avoid it: Claude Desktop, through the `.mcpb` bundle, and VS Code, through a password `input` (see the README).

The MCP Inspector saves the `env` values of the stdio servers it runs. Use it with `dev:mcp:fake`, which needs no credentials, never with the real ones.

## Why this design

- **No per-tool code.** The operation definitions stay the single source of truth for REST, OpenAPI, the docs page and MCP, so the four can't drift apart.
- **The core knows no transport.** Env vars, tokens and OAuth live only in the entry points, and each is a few dozen lines.
- **Pure functions where it matters.** `tools.ts` and `results.ts` are tested without a transport.
- **Double validation.** `runOperation` checks against the Zod schema and the SDK checks against `outputSchema`, so a change in the portal becomes `resposta_inesperada`, not wrong data.
- **stdout carries only the protocol.** Logs go to stderr, so nothing corrupts the stream.

Rejected:

- **Hand-written tools:** they drift from the API.
- **An OpenAPI-to-MCP wrapper over the HTTP server:** it needs `serve` running and a token, adds a hop, and produces worse descriptions.
- **One generic `call_operation` tool:** models do noticeably worse without a schema per tool.
- **Logging in at startup:** setup errors become "failed to connect" with no reason.

## Testing

- **Contract:** every operation becomes a tool, every JSON tool has an object `outputSchema`, and every operation's `example` validates against it.
- **End to end:** an MCP client talks to the server through `serveStdio`, the stdio entry itself, over the SDK's in-memory transport, against the demo portal. Both a 2025-era client and one pinned to 2026-07-28. Every JSON tool is called, and the client checks each answer against the tool's `outputSchema`. Also covers file tools, input errors, portal errors, an internal error, missing variables, a wrong password and the stop after it, and that nothing contacts the portal before the first tool call.
- **By hand:** `npm run -s dev:mcp:fake` runs the server against the demo portal (made-up data); add `-- --senha-errada` for a refused login. Point the [MCP Inspector](https://github.com/modelcontextprotocol/inspector) or a client at it.
