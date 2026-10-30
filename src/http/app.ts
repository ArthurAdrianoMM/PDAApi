/**
 * The local HTTP API. Every route is generated from the operation definitions.
 *
 * Meant to listen on 127.0.0.1 only. API routes need the bearer token of the
 * current login (POST /sessao); the Host check blocks DNS rebinding; the login
 * route refuses other origins; there are no CORS headers, so other sites open
 * in the browser cannot read responses.
 */
import { Hono, type Context } from 'hono';
import { z } from 'zod';
import type { PortalSession } from '../core/index.js';
import { generateOpenApi } from '../openapi/generate.js';
import { operations as allOperations, runOperation, type Operation } from '../operations/index.js';
import { VERSION } from '../version.js';
import { registerDocs } from './docs.js';
import { ERROR_STATUS, apiError, toApiError, type ApiError, type ApiErrorCode } from './errors.js';
import { readInput, toRoutePath } from './input.js';
import { LocalLogin, type OpenSession } from './login.js';

export interface AppOptions {
  /** Creates the portal session for a login made through POST /sessao. */
  openSession: OpenSession;
  /** A session already logged in when the server starts (credentials from the environment), and its token. */
  initial?: { session: PortalSession; token: string };
  /** The portal origin, shown in the OpenAPI document. */
  portalUrl: string;
  /** The port the server listens on; used for the Host check and the OpenAPI server URL. */
  port: number;
  operations?: readonly Operation[];
  /** One line per request (method, path, status, time). Never query strings or bodies. */
  log?: (line: string) => void;
  /** Folder of the built docs page. Defaults to dist/web. */
  docsDir?: string;
}

const loginBodySchema = z.strictObject({
  usuario: z.string().trim().min(1, 'Informe o usuário.'),
  senha: z.string().min(1, 'Informe a senha.'),
});

function bearer(c: Context): string | null {
  return /^Bearer\s+(\S+)$/i.exec(c.req.header('authorization') ?? '')?.[1] ?? null;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

function sendError(c: Context, code: ApiErrorCode, body: ApiError = apiError(code)) {
  return c.json(body, ERROR_STATUS[code]);
}

export function createApp(options: AppOptions): Hono {
  const { port, log } = options;
  const operations = options.operations ?? allOperations;
  const login = new LocalLogin(options.openSession, options.initial);
  const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  const openApi = generateOpenApi({ serverUrl: `http://127.0.0.1:${port}`, portalUrl: options.portalUrl, operations });

  const app = new Hono();

  app.use('*', async (c, next) => {
    const started = performance.now();
    await next();
    log?.(`${c.req.method} ${c.req.path} ${c.res.status} ${Math.round(performance.now() - started)}ms`);
  });

  app.use('*', async (c, next) => {
    if (!allowedHosts.has(new URL(c.req.url).host)) return sendError(c, 'host_invalido');
    await next();
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Referrer-Policy', 'no-referrer');
    if (!c.res.headers.has('Cache-Control')) c.header('Cache-Control', 'no-store');
  });

  app.get('/health', (c) => c.json({ status: 'ok', versao: VERSION }));
  app.get('/openapi.json', (c) => c.json(openApi));
  registerDocs(app, options.docsDir);

  // Login. The password goes from here to the portal only, and stays in this process's memory.
  // A browser always sends Origin on a POST: only the docs page, served from here, may log in.
  app.post('/sessao', async (c) => {
    const origin = c.req.header('origin');
    if (origin !== undefined && !allowedHosts.has(hostOf(origin))) return sendError(c, 'origem_invalida');
    if (!c.req.header('content-type')?.startsWith('application/json')) {
      return sendError(c, 'parametro_invalido', apiError('parametro_invalido', 'Envie o corpo como application/json.'));
    }
    const body = loginBodySchema.parse(await c.req.json().catch(() => null));
    const { token, state } = await login.login({ user: body.usuario, password: body.senha });
    return c.json({ token, nome: state.user.username, periodo: state.context.codPerLet }, 200);
  });

  app.get('/sessao', async (c) => {
    const session = login.sessionFor(bearer(c));
    if (!session) return sendError(c, 'token_invalido');
    const { user, context } = await session.ensureSession();
    return c.json({ nome: user.username, periodo: context.codPerLet }, 200);
  });

  app.delete('/sessao', (c) => {
    if (!login.logout(bearer(c))) return sendError(c, 'token_invalido');
    return c.body(null, 204);
  });

  for (const operation of operations) {
    app.on(operation.method.toUpperCase(), toRoutePath(operation.path), async (c) => {
      const session = login.sessionFor(bearer(c));
      if (!session) return sendError(c, 'token_invalido');
      const input = readInput(operation, c.req.param() as Record<string, string>, c.req.queries());
      return c.json(await runOperation(operation, session, input), 200);
    });
  }

  app.notFound((c) => sendError(c, 'nao_encontrado'));
  app.onError((error, c) => {
    const { status, body, internal } = toApiError(error);
    if (internal) log?.(`erro interno em ${c.req.method} ${c.req.path}: ${error.message}`);
    return c.json(body, status);
  });

  return app;
}
