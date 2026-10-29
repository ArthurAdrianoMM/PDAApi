/**
 * An in-memory stand-in for the portal, built from the behavior recorded in
 * ENDPOINTS.md (sections 2 and 3). All values are made up. Like the real
 * portal, it has no `LoginURL` (404).
 */
import { setTimeout as sleep } from 'node:timers/promises';
import type { FetchFn } from '../../src/core/http.js';
import { PortalSession } from '../../src/core/index.js';

export const ORIGIN = 'https://portal.test';
export const API = '/FrameHTML/RM/API/';
export const LOGIN_PATH = '/Corpore.Net/Source/EDU-EDUCACIONAL/Public/EduPortalAlunoLogin.aspx';
export const CONTEXT_COOKIE = 'EduContextoAlunoResponsavelAPI';
export const USER = 'aluno.teste';
export const PASSWORD = 's3nha&com=símbolos';

/** Opaque IDs with characters that URL encoding would change. */
export const CONTEXTS = [
  { IDCONTEXTOALUNO: 'ctx+A/1==', CODPERLET: '2026S1', IDPERLET: 1017, DTINICIO: '2026-02-02T00:00:00', NOMECURSO: 'Curso Exemplo' },
  { IDCONTEXTOALUNO: 'ctx+B/2==', CODPERLET: '2026S2', IDPERLET: 1042, DTINICIO: '2026-07-27T00:00:00', NOMECURSO: 'Curso Exemplo' },
  { IDCONTEXTOALUNO: 'ctx+C/3==', CODPERLET: '2025S2', IDPERLET: 988, DTINICIO: null, NOMECURSO: null },
];

export interface RecordedRequest {
  method: string;
  url: URL;
  headers: Headers;
  body: string | null;
}

export type DataRoute = (req: RecordedRequest) => Response;

export interface FakePortalOptions {
  /** Body of ListarAlias. */
  aliases?: unknown;
  contexts?: unknown[];
  /** Data endpoints, keyed by path after `/FrameHTML/RM/API/`. */
  routes?: Record<string, DataRoute>;
  /** Extra delay before a response arrives, keyed like `routes`. */
  latencyMs?: Record<string, number>;
}

export function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'content-type': 'application/json', ...init.headers },
  });
}

export function envelope(data: unknown, messages: unknown[] = []): Response {
  return json({ data, messages, length: Array.isArray(data) ? data.length : 1, HttpStatusCode: 200 });
}

function redirect(location: string, cookies: string[] = []): Response {
  const headers = new Headers({ location });
  for (const cookie of cookies) headers.append('set-cookie', cookie);
  return new Response(null, { status: 302, headers });
}

function cookiesOf(req: RecordedRequest): Map<string, string> {
  const map = new Map<string, string>();
  for (const part of (req.headers.get('cookie') ?? '').split(';')) {
    const at = part.indexOf('=');
    if (at > 0) map.set(part.slice(0, at).trim(), part.slice(at + 1).trim());
  }
  return map;
}

export function createFakePortal(options: FakePortalOptions = {}) {
  const requests: RecordedRequest[] = [];
  const contexts = options.contexts ?? CONTEXTS;
  let issued = 0;
  let validAuth: string | null = null;
  let logins = 0;

  const expiredRedirect = () => redirect(`${ORIGIN}/FrameHTML/web/app/edu/PortalEducacional/login/?sessaoexpirada=true`);
  const isAuthed = (req: RecordedRequest) => validAuth !== null && cookiesOf(req).get('.ASPXAUTH') === validAuth;

  function route(req: RecordedRequest): Response {
    const { pathname, searchParams } = req.url;

    if (req.method === 'POST' && pathname === LOGIN_PATH) {
      const form = new URLSearchParams(req.body ?? '');
      if (form.get('User') !== USER || form.get('Pass') !== PASSWORD || form.get('Alias') !== 'CorporeRM') {
        return new Response('<html>login</html>', { status: 200, headers: { 'content-type': 'text/html' } });
      }
      logins += 1;
      issued += 1;
      return redirect(`${ORIGIN}/framehtml/web/app/edu/PortalEducacional/#/main?key=KEY-${issued}`, [
        `ASP.NET_SessionId=sess-${issued}; path=/; HttpOnly`,
      ]);
    }

    if (!pathname.startsWith(API)) return new Response('not found', { status: 404 });
    const path = pathname.slice(API.length);

    switch (path) {
      case 'TOTVSEducacional/ListarAlias':
        return json(options.aliases ?? ['CorporeRM']);
      case 'user/AutoLoginPortal': {
        if (searchParams.get('key') !== `KEY-${issued}`) return new Response(null, { status: 401 });
        validAuth = `auth-${issued}`;
        const headers = new Headers({ 'content-type': 'application/json' });
        headers.append('set-cookie', `.ASPXAUTH=${validAuth}; path=/; HttpOnly`);
        headers.append('set-cookie', `RMAuthForm=form-${issued}; path=/; HttpOnly; SameSite=Lax`);
        return new Response('{}', { status: 200, headers });
      }
      case 'user/getcurrentuser':
        if (!isAuthed(req)) return expiredRedirect();
        return json({ username: 'Aluno Teste', dialect: 'pt-BR', email: 'aluno@example.test', login: USER });
      case 'TOTVSEducacional/Contexto':
        if (!isAuthed(req)) return expiredRedirect();
        return envelope(contexts);
    }

    const handler = options.routes?.[path];
    if (!handler) return new Response('not found', { status: 404 });
    if (!isAuthed(req)) return expiredRedirect();
    return handler(req);
  }

  const fetchFn: FetchFn = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const req: RecordedRequest = {
      method: init?.method ?? 'GET',
      url,
      headers: new Headers(init?.headers),
      body: typeof init?.body === 'string' ? init.body : null,
    };
    requests.push(req);
    const res = route(req);
    const delay = options.latencyMs?.[url.pathname.slice(API.length)];
    if (delay) await sleep(delay);
    return res;
  };

  return {
    fetch: fetchFn,
    requests,
    get logins() {
      return logins;
    },
    /** Makes the portal reject the current session, as when it expires. */
    expireSession() {
      validAuth = null;
    },
    cookiesOf,
    paths: () => requests.map((r) => `${r.method} ${r.url.pathname.replace(API, '')}`),
  };
}

/**
 * A data route that behaves like the academic endpoints (ENDPOINTS.md 2.4):
 * missing context cookie → permission warning; any other value than the raw ID → 403.
 */
export function academicRoute(expectedContextId: string, data: unknown): DataRoute {
  return (req) => {
    const value = cookiesOf(req).get(CONTEXT_COOKIE);
    if (value === undefined) {
      return envelope({ 'RMException:Message': 'Erro' }, [
        { type: 'warning', detail: 'Usuário sem permissão para acessar os dados acadêmicos do aluno' },
      ]);
    }
    if (value !== expectedContextId) return new Response(null, { status: 403 });
    return envelope(data);
  };
}

/** A PortalSession wired to a fresh fake portal, with no request spacing. */
export function createTestSession(options: FakePortalOptions = {}) {
  const portal = createFakePortal(options);
  const session = new PortalSession({
    credentials: async () => ({ user: USER, password: PASSWORD }),
    fetch: portal.fetch,
    config: { baseUrl: ORIGIN, minRequestIntervalMs: 0 },
  });
  return { portal, session };
}
