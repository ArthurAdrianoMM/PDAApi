/**
 * The local HTTP API. Every route is generated from the operation definitions.
 *
 * Meant to listen on 127.0.0.1 only. API routes need the per-run bearer token;
 * the Host check blocks DNS rebinding; there are no CORS headers, so other
 * sites open in the browser cannot read responses.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import { Hono, type Context, type MiddlewareHandler } from 'hono';
import type { PortalSession } from '../core/index.js';
import { generateOpenApi } from '../openapi/generate.js';
import { operations as allOperations, runOperation, type Operation } from '../operations/index.js';
import { VERSION } from '../version.js';
import { registerDocs } from './docs.js';
import { ERROR_STATUS, apiError, toApiError, type ApiError, type ApiErrorCode } from './errors.js';
import { readInput, toRoutePath } from './input.js';

export interface AppOptions {
  session: PortalSession;
  /** Per-run secret clients send as `Authorization: Bearer <token>`. */
  token: string;
  /** The port the server listens on; used for the Host check and the OpenAPI server URL. */
  port: number;
  operations?: readonly Operation[];
  /** One line per request (method, path, status, time). Never query strings or bodies. */
  log?: (line: string) => void;
  /** Folder of the built docs page. Defaults to dist/web. */
  docsDir?: string;
}

const digest = (value: string) => createHash('sha256').update(value).digest();

function sendError(c: Context, code: ApiErrorCode, body: ApiError = apiError(code)) {
  return c.json(body, ERROR_STATUS[code]);
}

export function createApp(options: AppOptions): Hono {
  const { session, port, log } = options;
  const operations = options.operations ?? allOperations;
  const tokenDigest = digest(options.token);
  const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  const openApi = generateOpenApi({ serverUrl: `http://127.0.0.1:${port}`, portalUrl: session.config.baseUrl, operations });

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

  const requireToken: MiddlewareHandler = async (c, next) => {
    const match = /^Bearer\s+(\S+)$/i.exec(c.req.header('authorization') ?? '');
    if (!match || !timingSafeEqual(digest(match[1]!), tokenDigest)) return sendError(c, 'token_invalido');
    await next();
  };

  app.get('/health', (c) => c.json({ status: 'ok', versao: VERSION }));
  app.get('/openapi.json', (c) => c.json(openApi));
  registerDocs(app, options.docsDir);

  for (const operation of operations) {
    app.on(operation.method.toUpperCase(), toRoutePath(operation.path), requireToken, async (c) => {
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
