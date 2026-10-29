import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { extractLoginKey } from '../src/core/auth.js';
import { PortalSession, type PortalErrorCode } from '../src/core/index.js';
import {
  CONTEXT_COOKIE,
  ORIGIN,
  PASSWORD,
  USER,
  academicRoute,
  createFakePortal,
  envelope,
  type FakePortalOptions,
} from './support/fake-portal.js';

const LATEST_CONTEXT_ID = 'ctx+B/2==';

function setup(options: FakePortalOptions = {}, config: { codPerLet?: string } = {}) {
  const portal = createFakePortal({
    routes: { 'TOTVSEducacional/NotaEtapa': academicRoute(LATEST_CONTEXT_ID, { Notas: [] }) },
    ...options,
  });
  const credentials = vi.fn(async () => ({ user: USER, password: PASSWORD }));
  const session = new PortalSession({
    credentials,
    fetch: portal.fetch,
    config: { baseUrl: ORIGIN, minRequestIntervalMs: 0, ...config },
  });
  return { portal, session, credentials };
}

async function expectCode(promise: Promise<unknown>, code: PortalErrorCode) {
  await expect(promise).rejects.toMatchObject({ name: 'PortalError', code });
}

describe('login', () => {
  it('follows the login page steps, in order', async () => {
    const { portal, session } = setup();
    const state = await session.login();

    expect(portal.paths()).toEqual([
      'GET TOTVSEducacional/ListarAlias',
      'POST /Corpore.Net/Source/EDU-EDUCACIONAL/Public/EduPortalAlunoLogin.aspx',
      'GET user/AutoLoginPortal',
      'GET user/getcurrentuser',
      'GET TOTVSEducacional/Contexto',
    ]);
    expect(state.user).toEqual({ login: USER, username: 'Aluno Teste' });
  });

  it('posts the form fields encoded, with the session key taken from the redirect', async () => {
    const { portal, session } = setup();
    await session.login();

    const post = portal.requests.find((r) => r.method === 'POST')!;
    expect(post.url.searchParams.get('AutoLoginType')).toBe('ExternalLogin');
    expect(post.headers.get('content-type')).toBe('application/x-www-form-urlencoded');
    expect(Object.fromEntries(new URLSearchParams(post.body!))).toEqual({ User: USER, Pass: PASSWORD, Alias: 'CorporeRM' });

    const autoLogin = portal.requests.find((r) => r.url.pathname.endsWith('user/AutoLoginPortal'))!;
    expect(autoLogin.url.searchParams.get('key')).toBe('KEY-1');
  });

  it('picks the enrollment with the latest start date', async () => {
    const { session } = setup();
    const { context } = await session.login();
    expect(context).toEqual({ codPerLet: '2026S2', idPerLet: 1042, curso: 'Curso Exemplo' });
  });

  it('picks the configured period when one is set', async () => {
    const { session } = setup({}, { codPerLet: '2025S2' });
    const { context } = await session.login();
    expect(context.codPerLet).toBe('2025S2');
  });

  it('rejects a configured period the account does not have', async () => {
    const { session } = setup({}, { codPerLet: '1999S1' });
    await expectCode(session.login(), 'configuracao_invalida');
  });

  it('fails when the portal does not redirect with a key', async () => {
    const { portal, session } = setup();
    const wrong = new PortalSession({
      credentials: async () => ({ user: USER, password: 'errada' }),
      fetch: portal.fetch,
      config: { baseUrl: ORIGIN, minRequestIntervalMs: 0 },
    });
    await expectCode(wrong.login(), 'login_falhou');
    expect(portal.paths().at(-1)).toContain('POST');
    expect(session.isLoggedIn).toBe(false);
  });

  it('sends the password only to the configured origin', async () => {
    const { portal, session } = setup();
    await session.login();
    expect(new Set(portal.requests.map((r) => r.url.origin))).toEqual(new Set([ORIGIN]));
  });

  it('refuses to choose between several aliases', async () => {
    await expectCode(setup({ aliases: ['CorporeRM', 'Outro'] }).session.login(), 'configuracao_invalida');
  });

  it('asks for the credentials before contacting the portal', async () => {
    const { portal } = setup();
    const session = new PortalSession({
      credentials: async () => {
        throw new Error('sem terminal');
      },
      fetch: portal.fetch,
      config: { baseUrl: ORIGIN, minRequestIntervalMs: 0 },
    });
    await expect(session.login()).rejects.toThrow('sem terminal');
    expect(portal.requests).toHaveLength(0);
  });

  it('never calls Logout or Contexto/Selecao', async () => {
    const { portal, session } = setup();
    await session.getData('TOTVSEducacional/NotaEtapa', {}, z.unknown());
    expect(portal.paths().some((p) => /Logout|Selecao/.test(p))).toBe(false);
  });
});

describe('extractLoginKey', () => {
  const base = new URL(`${ORIGIN}/Corpore.Net/`);
  it('reads the key from the hash route', () => {
    expect(extractLoginKey('/app/#/main?key=a%2Bb', base)).toBe('a+b');
  });
  it('reads the key from the query string', () => {
    expect(extractLoginKey('/app/?key=abc#/main', base)).toBe('abc');
  });
  it('returns null without a key', () => {
    expect(extractLoginKey('/app/#/main', base)).toBeNull();
  });
});

describe('requests with a session', () => {
  it('sends the context cookie with the raw ID, not URL-encoded', async () => {
    const { portal, session } = setup();
    await session.getData('TOTVSEducacional/NotaEtapa', {}, z.unknown());

    const call = portal.requests.at(-1)!;
    expect(portal.cookiesOf(call).get(CONTEXT_COOKIE)).toBe(LATEST_CONTEXT_ID);
    expect(call.headers.get('cookie')).toContain(`${CONTEXT_COOKIE}=${LATEST_CONTEXT_ID}`);
  });

  it('logs in again once when the session expires, then retries', async () => {
    const { portal, session, credentials } = setup();
    await session.login();
    portal.expireSession();

    await expect(session.getData('TOTVSEducacional/NotaEtapa', {}, z.unknown())).resolves.toEqual({ Notas: [] });
    expect(portal.logins).toBe(2);
    expect(credentials).toHaveBeenCalledTimes(2);
  });

  it('logs in only once when several calls hit an expired session together', async () => {
    const { portal, session } = setup();
    await session.login();
    portal.expireSession();

    await Promise.all([1, 2, 3].map(() => session.getData('TOTVSEducacional/NotaEtapa', {}, z.unknown())));
    expect(portal.logins).toBe(2);
  });

  it('does not log in again for a rejection that arrives after a fresh login', async () => {
    const { portal, session } = setup({
      routes: {
        'TOTVSEducacional/NotaEtapa': academicRoute(LATEST_CONTEXT_ID, { Notas: [] }),
        'TOTVSEducacional/FaltaEtapa': academicRoute(LATEST_CONTEXT_ID, { FaltasEtapa: [] }),
      },
      latencyMs: { 'TOTVSEducacional/FaltaEtapa': 30 },
    });
    await session.login();
    portal.expireSession();

    // Both requests go out with the expired session; the slow one's rejection lands after the re-login.
    await Promise.all([
      session.getData('TOTVSEducacional/NotaEtapa', {}, z.unknown()),
      session.getData('TOTVSEducacional/FaltaEtapa', {}, z.unknown()),
    ]);
    expect(portal.logins).toBe(2);
  });

  it('gives up after one new login if the portal still rejects the session', async () => {
    const { portal, session } = setup({
      routes: { 'TOTVSEducacional/NotaEtapa': () => new Response(null, { status: 302, headers: { location: '/login' } }) },
    });
    await expectCode(session.getData('TOTVSEducacional/NotaEtapa', {}, z.unknown()), 'sessao_expirada');
    expect(portal.logins).toBe(2);
  });

  it('reports a 403 without retrying', async () => {
    const { portal, session } = setup({
      routes: { 'TOTVSEducacional/NotaEtapa': academicRoute('another-id', {}) },
    });
    await expectCode(session.getData('TOTVSEducacional/NotaEtapa', {}, z.unknown()), 'portal_recusou');
    expect(portal.logins).toBe(1);
  });

  it('reports the permission warning as a missing context', async () => {
    const { session } = setup({
      routes: {
        'TOTVSEducacional/NotaEtapa': () =>
          envelope({ 'RMException:Message': 'Erro' }, [
            { type: 'warning', detail: 'Usuário sem permissão para acessar os dados acadêmicos do aluno' },
          ]),
      },
    });
    const error = await session.getData('TOTVSEducacional/NotaEtapa', {}, z.unknown()).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'sem_contexto' });
    expect(error).toHaveProperty('portalMessages.0.type', 'warning');
  });

  it('reports other portal exceptions as portal errors', async () => {
    const { session } = setup({
      routes: { 'TOTVSEducacional/NotaEtapa': () => envelope({ 'RMException:Message': 'x' }, [{ type: 'error', detail: 'Falhou' }]) },
    });
    await expectCode(session.getData('TOTVSEducacional/NotaEtapa', {}, z.unknown()), 'erro_do_portal');
  });

  it('reports a 5xx as the portal being unavailable', async () => {
    const { session } = setup({ routes: { 'TOTVSEducacional/NotaEtapa': () => new Response('', { status: 503 }) } });
    await expectCode(session.getData('TOTVSEducacional/NotaEtapa', {}, z.unknown()), 'portal_indisponivel');
  });

  it('reports network failures as the portal being unavailable', async () => {
    const session = new PortalSession({
      credentials: async () => ({ user: USER, password: PASSWORD }),
      fetch: async () => {
        throw new TypeError('fetch failed');
      },
      config: { baseUrl: ORIGIN, minRequestIntervalMs: 0 },
    });
    await expectCode(session.login(), 'portal_indisponivel');
  });

  it('forget() drops the session locally without calling the portal', async () => {
    const { portal, session } = setup();
    await session.login();
    const before = portal.requests.length;
    session.forget();
    expect(session.isLoggedIn).toBe(false);
    expect(portal.requests.length).toBe(before);
  });
});
