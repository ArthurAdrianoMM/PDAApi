import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/http/app.js';
import { defineOperation, type Operation } from '../src/operations/index.js';
import { listarPeriodos } from '../src/operations/periodos.js';
import { academicRoute, createTestSession, envelope, type FakePortalOptions } from './support/fake-portal.js';

const TOKEN = 'token-de-teste';
const PORT = 4321;
const BASE = `http://127.0.0.1:${PORT}`;
const CONTEXT_ID = 'ctx+B/2==';

/** A stand-in for the built docs page (dist/web). */
const DOCS_DIR = mkdtempSync(join(tmpdir(), 'portal-aluno-docs-'));
mkdirSync(join(DOCS_DIR, 'assets'));
writeFileSync(join(DOCS_DIR, 'index.html'), '<!doctype html><title>docs</title>');
writeFileSync(join(DOCS_DIR, 'assets', 'index-abc123.js'), 'console.log(1);');

function setup(options: FakePortalOptions = {}, operations?: readonly Operation[], docsDir = DOCS_DIR) {
  const { portal, session } = createTestSession({
    routes: {
      'TOTVSEducacional/Periodos': academicRoute(CONTEXT_ID, [{ CODPERLET: '2026S2', IDPERLET: 1042 }]),
      'TOTVSEducacional/DisciplinasAlunoPeriodoLetivo': academicRoute(CONTEXT_ID, []),
      ...options.routes,
    },
  });
  const logs: string[] = [];
  const app = createApp({
    session,
    token: TOKEN,
    port: PORT,
    log: (line) => logs.push(line),
    docsDir,
    ...(operations === undefined ? {} : { operations }),
  });
  const request = (path: string, init: RequestInit = {}, base = BASE) => app.request(`${base}${path}`, init);
  const authed = (path: string, init: RequestInit = {}, base = BASE) =>
    request(path, { ...init, headers: { authorization: `Bearer ${TOKEN}`, ...init.headers } }, base);
  return { app, portal, logs, request, authed };
}

describe('authentication', () => {
  it('rejects API calls without the token', async () => {
    const res = await setup().request('/periodos');
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ erro: 'token_invalido' });
  });

  it('rejects a wrong token', async () => {
    const res = await setup().request('/periodos', { headers: { authorization: 'Bearer outro' } });
    expect(res.status).toBe(401);
  });

  it('accepts the token', async () => {
    const res = await setup().authed('/periodos');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ periodos: [{ codigo: '2026S2', id: 1042, selecionado: true }] });
  });

  it('does not log in to the portal for a request without the token', async () => {
    const { request, portal } = setup();
    await request('/periodos');
    expect(portal.requests).toHaveLength(0);
  });

  it('serves health, the OpenAPI document and the docs without the token', async () => {
    const { request } = setup();
    expect((await request('/health')).status).toBe(200);
    expect((await request('/docs/')).status).toBe(200);
    const doc = await (await request('/openapi.json')).json();
    expect(doc).toMatchObject({ servers: [{ url: BASE }] });
  });
});

describe('local-only protections', () => {
  it('rejects any Host other than the local address (DNS rebinding)', async () => {
    const res = await setup().authed('/periodos', {}, `http://attacker.test:${PORT}`);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ erro: 'host_invalido' });
  });

  it('accepts localhost as the Host', async () => {
    const res = await setup().request('/health', {}, `http://localhost:${PORT}`);
    expect(res.status).toBe(200);
  });

  it('sends no CORS headers, even to a cross-origin request', async () => {
    const res = await setup().authed('/periodos', { headers: { origin: 'https://site.test' } });
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('logs method, path and status, never the query string', async () => {
    const { authed, logs } = setup();
    await authed('/disciplinas?apenasEmCurso=true');
    expect(logs.at(-1)).toMatch(/^GET \/disciplinas 200 \d+ms$/);
  });
});

describe('docs page', () => {
  it('serves the page with a CSP that only allows this server, and no inline code', async () => {
    const res = await setup().request('/docs/');
    expect(res.headers.get('content-type')).toContain('text/html');
    const csp = res.headers.get('content-security-policy') ?? '';
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("style-src 'self'");
    expect(csp).not.toContain('unsafe');
  });

  it('redirects / and /docs to /docs/', async () => {
    const { request } = setup();
    for (const path of ['/', '/docs']) {
      const res = await request(path);
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBe('/docs/');
    }
  });

  it('serves hashed assets as cacheable, and the page as not', async () => {
    const { request } = setup();
    const asset = await request('/docs/assets/index-abc123.js');
    expect(asset.status).toBe(200);
    expect(asset.headers.get('content-type')).toContain('javascript');
    expect(asset.headers.get('cache-control')).toContain('immutable');
    expect((await request('/docs/')).headers.get('cache-control')).toBe('no-store');
  });

  it('never serves files outside the docs folder', async () => {
    const { request } = setup();
    for (const path of ['/docs/..%2F..%2Fpackage.json', '/docs/%2e%2e/%2e%2e/package.json', '/docs/assets/nada.js']) {
      expect((await request(path)).status).toBe(404);
    }
  });

  it('explains how to build the page when it is missing', async () => {
    const res = await setup({}, undefined, join(DOCS_DIR, 'nao-existe')).request('/docs/');
    expect(res.status).toBe(503);
    expect(await res.text()).toContain('npm run build:web');
  });

});

describe('input', () => {
  it('converts query strings to the declared types', async () => {
    const { authed, portal } = setup();
    expect((await authed('/disciplinas?apenasEmCurso=true')).status).toBe(200);
    const sent = portal.requests.at(-1)!.url.searchParams.get('mostraApenasDiscEmCurso');
    expect(sent).toBe('true');
  });

  it('rejects a value of the wrong type, naming the field', async () => {
    const res = await setup().authed('/disciplinas?apenasEmCurso=sim');
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ erro: 'parametro_invalido', detalhes: [{ campo: 'apenasEmCurso' }] });
  });

  it('rejects unknown parameters', async () => {
    const res = await setup().authed('/notas?periodo=2026S1');
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ erro: 'parametro_invalido', detalhes: [{ campo: 'periodo' }] });
  });

  it('serves a nested path and keeps dates as text', async () => {
    const { authed, portal } = setup({
      routes: { 'TOTVSEducacional/Aluno/Falta/Aula': academicRoute(CONTEXT_ID, { SFREQUENCIAALUNO: [] }) },
    });
    const res = await authed('/faltas/aulas?de=2026-08-01&ate=2026-10-29&idTurmaDisc=48213');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ periodo: '2026S2', de: '2026-08-01', ate: '2026-10-29', faltas: [] });
    expect(portal.requests.at(-1)!.url.searchParams.get('tipoFrequencia')).toBe('A');
  });

  it('reports a date window that ends before it starts on the field', async () => {
    const res = await setup().authed('/faltas/aulas?de=2026-10-29&ate=2026-10-01');
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ erro: 'parametro_invalido', detalhes: [{ campo: 'de' }] });
  });
});

describe('errors', () => {
  it('passes a portal refusal on as 403', async () => {
    const res = await setup({ routes: { 'TOTVSEducacional/Periodos': academicRoute('outro-id', []) } }).authed('/periodos');
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ erro: 'portal_recusou' });
  });

  it('includes the portal messages when there are any', async () => {
    const route = () =>
      envelope({ 'RMException:Message': 'x' }, [{ type: 'warning', detail: 'Usuário sem permissão para acessar os dados acadêmicos do aluno' }]);
    const res = await setup({ routes: { 'TOTVSEducacional/Periodos': route } }).authed('/periodos');
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ erro: 'sem_contexto', mensagensDoPortal: [{ tipo: 'warning' }] });
  });

  it('answers unknown routes with a JSON 404', async () => {
    const res = await setup().authed('/nada');
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ erro: 'nao_encontrado' });
  });

  it('hides internal error details from the response', async () => {
    const broken = defineOperation({
      ...listarPeriodos,
      handler: async () => {
        throw new Error('detalhe interno');
      },
    });
    const { authed, logs } = setup({}, [broken]);
    const res = await authed('/periodos');
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toMatchObject({ erro: 'erro_interno' });
    expect(JSON.stringify(body)).not.toContain('detalhe interno');
    expect(logs.some((line) => line.includes('detalhe interno'))).toBe(true);
  });
});
