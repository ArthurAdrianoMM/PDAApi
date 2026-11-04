import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/http/app.js';
import { defineOperation, type Operation } from '../src/operations/index.js';
import { listarPeriodos } from '../src/operations/periodos.js';
import {
  ORIGIN,
  PASSWORD,
  USER,
  academicRoute,
  contextRoute,
  createTestSession,
  envelope,
  fakeSession,
  type FakePortalOptions,
} from './support/fake-portal.js';
import { AULAS_DISCIPLINA, PLANO_AULA } from './fixtures/aulas-disciplina.js';
import { GRADE_CURRICULAR } from './fixtures/grade-curricular.js';

const TOKEN = 'token-de-teste';
const PORT = 4321;
const BASE = `http://127.0.0.1:${PORT}`;
const CONTEXT_ID = 'ctx+B/2==';

/** A stand-in for the built docs page (dist/web). */
const DOCS_DIR = mkdtempSync(join(tmpdir(), 'portal-aluno-docs-'));
mkdirSync(join(DOCS_DIR, 'assets'));
writeFileSync(join(DOCS_DIR, 'index.html'), '<!doctype html><title>docs</title>');
writeFileSync(join(DOCS_DIR, 'assets', 'index-abc123.js'), 'console.log(1);');
writeFileSync(join(DOCS_DIR, 'assets', 'art-abc123.webp'), 'RIFF');
writeFileSync(join(DOCS_DIR, 'assets', 'art-still-abc123.png'), 'PNG');

function setup(options: FakePortalOptions = {}, operations?: readonly Operation[], docsDir = DOCS_DIR, loggedIn = true) {
  const { portal, session } = createTestSession({
    routes: {
      'TOTVSEducacional/Periodos': academicRoute(CONTEXT_ID, [{ CODPERLET: '2026S2', IDPERLET: 1042 }]),
      'TOTVSEducacional/DisciplinasAlunoPeriodoLetivo': academicRoute(CONTEXT_ID, []),
      ...options.routes,
    },
  });
  const logs: string[] = [];
  const app = createApp({
    openSession: (credentials) => fakeSession(portal, credentials),
    ...(loggedIn ? { initial: { session, token: TOKEN } } : {}),
    portalUrl: ORIGIN,
    port: PORT,
    log: (line) => logs.push(line),
    docsDir,
    ...(operations === undefined ? {} : { operations }),
  });
  const request = (path: string, init: RequestInit = {}, base = BASE) => app.request(`${base}${path}`, init);
  const authed = (path: string, init: RequestInit = {}, base = BASE) =>
    request(path, { ...init, headers: { authorization: `Bearer ${TOKEN}`, ...init.headers } }, base);
  const login = (body: unknown, headers: Record<string, string> = {}) =>
    request('/sessao', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: BASE, ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  return { app, portal, logs, request, authed, login };
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

describe('login', () => {
  it('logs in with the portal credentials and returns a token that opens the API', async () => {
    const { login, request } = setup();
    const res = await login({ usuario: USER, senha: PASSWORD });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string };
    expect(body).toEqual({ token: expect.any(String), nome: 'Aluno Teste', periodo: '2026S2' });

    const bearer = (token: string) => ({ headers: { authorization: `Bearer ${token}` } });
    expect((await request('/periodos', bearer(body.token))).status).toBe(200);
    expect((await request('/periodos', bearer(TOKEN))).status).toBe(401);
  });

  it('starts with nobody logged in when there is no initial session', async () => {
    const { request } = setup({}, undefined, DOCS_DIR, false);
    expect((await request('/sessao')).status).toBe(401);
    expect((await request('/periodos', { headers: { authorization: `Bearer ${TOKEN}` } })).status).toBe(401);
  });

  it('reports wrong credentials and keeps the current login', async () => {
    const { login, authed } = setup();
    const res = await login({ usuario: USER, senha: 'errada' });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ erro: 'login_falhou' });
    expect((await authed('/periodos')).status).toBe(200);
  });

  it('refuses a login from another origin, without contacting the portal', async () => {
    const { login, portal } = setup({}, undefined, DOCS_DIR, false);
    const res = await login({ usuario: USER, senha: PASSWORD }, { origin: 'https://site.test' });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ erro: 'origem_invalida' });
    expect(portal.requests).toHaveLength(0);
  });

  it('accepts a login from localhost and from clients that send no Origin', async () => {
    const { login, request } = setup();
    expect((await login({ usuario: USER, senha: PASSWORD }, { origin: `http://localhost:${PORT}` })).status).toBe(200);
    const res = await request('/sessao', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ usuario: USER, senha: PASSWORD }),
    });
    expect(res.status).toBe(200);
  });

  it('only takes a JSON body, naming missing fields', async () => {
    const { login } = setup();
    const form = await login(`usuario=${USER}&senha=x`, { 'content-type': 'application/x-www-form-urlencoded' });
    expect(form.status).toBe(400);
    const empty = await login({ usuario: ' ', senha: '' });
    expect(empty.status).toBe(400);
    const body = (await empty.json()) as { detalhes: { campo: string }[] };
    expect(body.detalhes.map((d) => d.campo)).toEqual(['usuario', 'senha']);
  });

  it('never logs the body', async () => {
    const { login, logs } = setup();
    await login({ usuario: USER, senha: PASSWORD });
    expect(logs.at(-1)).toMatch(/^POST \/sessao 200 \d+ms$/);
    expect(logs.join('\n')).not.toContain(PASSWORD);
  });

  it('tells who is logged in', async () => {
    const { authed, request } = setup();
    const res = await authed('/sessao');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ nome: 'Aluno Teste', periodo: '2026S2' });
    expect((await request('/sessao')).status).toBe(401);
  });

  it('logs out, after which the token no longer works', async () => {
    const { authed } = setup();
    expect((await authed('/sessao', { method: 'DELETE' })).status).toBe(204);
    expect((await authed('/periodos')).status).toBe(401);
    expect((await authed('/sessao', { method: 'DELETE' })).status).toBe(401);
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
    expect((await request('/docs/assets/art-abc123.webp')).headers.get('content-type')).toBe('image/webp');
    expect((await request('/docs/assets/art-still-abc123.png')).headers.get('content-type')).toBe('image/png');
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
    const res = await setup().authed('/notas?semestre=2026S1');
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ erro: 'parametro_invalido', detalhes: [{ campo: 'semestre' }] });
  });

  it('answers for the period asked, and 404 for one the account does not have', async () => {
    const { authed, portal } = setup({
      routes: { 'TOTVSEducacional/NotaEtapa': contextRoute({ [CONTEXT_ID]: { Notas: [] }, 'ctx+A/1==': { Notas: [] } }) },
    });
    const res = await authed('/notas?periodo=2026S1');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ periodo: '2026S1', disciplinas: [] });
    expect(portal.cookiesOf(portal.requests.at(-1)!).get('EduContextoAlunoResponsavelAPI')).toBe('ctx+A/1==');

    const missing = await authed('/notas?periodo=1999S1');
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ erro: 'periodo_inexistente' });
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

describe('endpoints end to end', () => {
  it('GET /aulas: lessons of a window, with the context ID the portal needs', async () => {
    const lesson = {
      IDHORARIOTURMA: 90121, DIASEMANA: 3, HORAINICIAL: '18:30', HORAFINAL: '19:20', PREDIO: null, BLOCO: null, SALA: null,
      DATA: '2026-11-03T00:00:00', AULA: 21, IDTURMADISC: 48213, CONTEUDO: 'Rotas.', CONTEUDOEFETIVO: null, LICAOCASA: null,
      CODTURMA: 'DS-2026-A', CODDISC: 'PW2', NOMEDISC: 'Programação Web II', CODSUBTURMA: '', CONFIRMADO: 'N',
      IDPLANOAULA: 7310452, TIPOAULA: 'T', URLAULAONLINE: null, OBSERVACAO: null,
    };
    const { authed, portal } = setup({
      routes: { 'TOTVSEducacional/v1/planoaulas/aulas': academicRoute(CONTEXT_ID, { SPlanoAula: [lesson], SPLANOAULAARQUIVO: [] }) },
    });

    const res = await authed('/aulas?de=2026-11-03&ate=2026-11-06');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { aulas: Record<string, unknown>[] };
    expect(body).toMatchObject({ periodo: '2026S2', de: '2026-11-03', ate: '2026-11-06' });
    expect(body.aulas).toEqual([expect.objectContaining({ idPlanoAula: 7310452, dia: 'terca', tipo: { codigo: 'T', descricao: 'Aula teórica' } })]);
    const call = portal.requests.find((r) => r.url.pathname.endsWith('v1/planoaulas/aulas'))!;
    expect(call.url.searchParams.get('idContextoAluno')).toBe(CONTEXT_ID);

    const tooLong = await authed('/aulas?de=2026-01-01&ate=2026-03-01');
    expect(tooLong.status).toBe(400);
    expect(await tooLong.json()).toMatchObject({ erro: 'parametro_invalido', detalhes: [{ campo: 'ate' }] });
  });

  it('GET /grade-curricular: the grade by group, filtered by situation', async () => {
    const { authed } = setup({
      routes: { 'TOTVSEducacional/GradeCurricular/EnsinoSuperior': academicRoute(CONTEXT_ID, GRADE_CURRICULAR) },
    });
    const res = await authed('/grade-curricular?situacao=em_curso');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { grupos: { codigo: number; disciplinas: { codigo: string }[] }[] };
    expect(body).toMatchObject({ periodo: '2026S2', curso: { codigo: 'DS' }, cargaHoraria: { curso: 1200 } });
    expect(body.grupos.map((g) => [g.codigo, g.disciplinas.map((d) => d.codigo)])).toEqual([[2, ['PW2']]]);

    const wrong = await authed('/grade-curricular?situacao=todas');
    expect(wrong.status).toBe(400);
    expect(await wrong.json()).toMatchObject({ erro: 'parametro_invalido', detalhes: [{ campo: 'situacao' }] });
  });

  it('GET /disciplinas/{idTurmaDisc}/aulas and /aulas/{idPlanoAula}: path parameters, typed and checked', async () => {
    const { authed } = setup({
      routes: {
        'TOTVSEducacional/DisciplinasAlunoPeriodoLetivo': academicRoute(CONTEXT_ID, [
          { IDTURMADISC: 48213, CODDISC: 'PW2', NOME: 'Programação Web II', CODTURMA: 'DS-2026-A', CODSUBTURMA: null, IDPERLET: 1042, CODSTATUS: 20, DESCRICAO: 'Matriculado' },
        ]),
        'TOTVSEducacional/AulasDisciplina/48213': academicRoute(CONTEXT_ID, AULAS_DISCIPLINA),
        'TOTVSEducacional/PlanoAula/Aula': academicRoute(CONTEXT_ID, PLANO_AULA),
      },
    });

    const list = await authed('/disciplinas/48213/aulas?de=2026-11-02&ate=2026-11-08');
    expect(list.status).toBe(200);
    expect(await list.json()).toMatchObject({ idTurmaDisc: 48213, dias: [{ data: '2026-11-03' }, { data: '2026-11-05' }] });

    const one = await authed('/disciplinas/48213/aulas/7310021');
    expect(one.status).toBe(200);
    expect(await one.json()).toMatchObject({ aula: { idPlanoAula: 7310021, realizada: { inicio: '18:30' } } });

    const notANumber = await authed('/disciplinas/pw2/aulas');
    expect(notANumber.status).toBe(400);
    expect(await notANumber.json()).toMatchObject({ erro: 'parametro_invalido', detalhes: [{ campo: 'idTurmaDisc' }] });

    const otherClass = await authed('/disciplinas/1/aulas');
    expect(otherClass.status).toBe(404);
    expect(await otherClass.json()).toMatchObject({ erro: 'item_inexistente' });
  });
});
