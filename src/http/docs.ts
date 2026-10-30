/**
 * Serves the docs page (built from web/ into dist/web) at /docs/. The page
 * only loads files from this server and only talks to this server.
 */
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Context, Hono, MiddlewareHandler } from 'hono';

/** Resolves to <repo>/dist/web both from src/http (tsx) and from dist/http (built). */
export const DEFAULT_DOCS_DIR = fileURLToPath(new URL('../../dist/web/', import.meta.url));

const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.map': 'application/json; charset=utf-8',
};

const NOT_BUILT = `<!doctype html>
<html lang="pt-BR"><meta charset="utf-8"><title>Portal do Aluno API</title>
<p>A interface da documentação ainda não foi gerada. Rode <code>npm run build:web</code> e reinicie o servidor.</p>
<p>A API e o <a href="/openapi.json">openapi.json</a> funcionam sem ela.</p>
</html>
`;

const docsHeaders: MiddlewareHandler = async (c, next) => {
  await next();
  c.header('Content-Security-Policy', CONTENT_SECURITY_POLICY);
};

/** The file a /docs/ path names, or null when it would leave the docs folder. */
function resolveDocsFile(root: string, requestPath: string): string | null {
  let relative: string;
  try {
    relative = decodeURIComponent(requestPath.replace(/^\/docs\/?/, ''));
  } catch {
    return null;
  }
  if (relative.includes('\0')) return null;
  const file = resolve(root, relative || 'index.html');
  return file.startsWith(root.endsWith(sep) ? root : root + sep) ? file : null;
}

async function sendFile(c: Context, file: string) {
  const type = CONTENT_TYPES[extname(file)];
  if (!type) return null;
  let body: Buffer;
  try {
    body = await readFile(file);
  } catch {
    return null;
  }
  // Files under assets/ have a content hash in their name, so they never change.
  const cache = file.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000, immutable' : 'no-store';
  return c.body(new Uint8Array(body), 200, { 'Content-Type': type, 'Cache-Control': cache });
}

export function registerDocs(app: Hono, docsDir: string = DEFAULT_DOCS_DIR): void {
  const root = resolve(docsDir);

  app.use('/docs', docsHeaders);
  app.use('/docs/*', docsHeaders);
  app.get('/', (c) => c.redirect('/docs/'));
  app.get('/docs', (c) => c.redirect('/docs/'));
  app.get('/docs/*', async (c) => {
    const file = resolveDocsFile(root, c.req.path);
    const response = file ? await sendFile(c, file) : null;
    if (response) return response;
    if (c.req.path === '/docs/') return c.html(NOT_BUILT, 503);
    return c.notFound();
  });
}
