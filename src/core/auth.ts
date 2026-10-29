/**
 * The login flow (ENDPOINTS.md 2.1 to 2.3): alias, form POST, session
 * bootstrap, session check. Each step is one request.
 */
import { z } from 'zod';
import type { PortalConfig } from './config.js';
import { PortalError } from './errors.js';
import type { PortalHttp } from './http.js';
import { assertOk, parseJson, validate } from './response.js';
import { apiUrl } from './url.js';

export interface Credentials {
  /** The student's login (RA-style user code). */
  user: string;
  password: string;
}

/** Called each time the session needs to log in, so the password is never kept by the core. */
export type CredentialsProvider = () => Promise<Credentials>;

export interface CurrentUser {
  login: string;
  username: string;
}

const aliasesSchema = z.array(z.string());
const currentUserSchema = z.looseObject({ login: z.string(), username: z.string() });

/**
 * The form login, on the configured origin. The portal's own config fixes the
 * old portal's base as `CONST_GLOBAL_URL_CORPORE_RM = '/Corpore.net/'`
 * (FrameHTML/web/js/totvs-app.global.config.js), and this path was verified
 * from curl (ENDPOINTS.md 2.2). Being a fixed path on the configured origin,
 * the password cannot be sent anywhere else.
 */
const LOGIN_FORM_PATH = '/Corpore.Net/Source/EDU-EDUCACIONAL/Public/EduPortalAlunoLogin.aspx?AutoLoginType=ExternalLogin';

/** `TOTVSEducacional/ListarAlias`: a bare JSON array. Uses the configured alias, or the only one the portal lists. */
export async function resolveAlias(http: PortalHttp, config: PortalConfig): Promise<string> {
  if (config.alias) return config.alias;

  const label = 'ListarAlias';
  const res = await http.request({ method: 'GET', url: apiUrl(config.baseUrl, 'TOTVSEducacional/ListarAlias') });
  assertOk(res, label);
  const aliases = validate(aliasesSchema, parseJson(res, label), label);

  const [only, ...rest] = aliases;
  if (only === undefined || rest.length > 0) {
    throw new PortalError(
      'configuracao_invalida',
      `O portal lista ${aliases.length} aliases. Defina o alias na configuração.`,
    );
  }
  return only;
}

/**
 * Posts the login form and returns the session key from the redirect.
 * Success is a 3xx whose Location carries `key` (in the hash route: `#/main?key=…`).
 * Anything else is a failed login. The portal's answer to wrong credentials has
 * not been recorded, so the error does not claim a cause.
 */
export async function submitLogin(
  http: PortalHttp,
  config: PortalConfig,
  alias: string,
  credentials: Credentials,
): Promise<string> {
  const url = new URL(LOGIN_FORM_PATH, config.baseUrl);
  const res = await http.request({
    method: 'POST',
    url,
    form: { User: credentials.user, Pass: credentials.password, Alias: alias },
  });

  const key = res.status >= 300 && res.status < 400 && res.location ? extractLoginKey(res.location, url) : null;
  if (!key) {
    throw new PortalError(
      'login_falhou',
      `O portal não aceitou o login (HTTP ${res.status}, sem chave de sessão). Confira o usuário e a senha.`,
      { status: res.status },
    );
  }
  return key;
}

/** Reads `key` from the query string or from the hash route's query string. */
export function extractLoginKey(location: string, base: URL): string | null {
  const url = new URL(location, base);
  const fromQuery = url.searchParams.get('key');
  if (fromQuery) return fromQuery;
  const hashQuery = url.hash.indexOf('?');
  if (hashQuery === -1) return null;
  return new URLSearchParams(url.hash.slice(hashQuery + 1)).get('key') || null;
}

/**
 * `user/AutoLoginPortal?key=…`. Turns the key into an app session; the cookies
 * it sets land in the jar. Whether the session works is checked next with
 * `getCurrentUser`, the documented session check.
 */
export async function bootstrapSession(http: PortalHttp, config: PortalConfig, key: string): Promise<void> {
  const res = await http.request({ method: 'GET', url: apiUrl(config.baseUrl, 'user/AutoLoginPortal', { key }) });
  if (res.status >= 400) {
    throw new PortalError('login_falhou', `AutoLoginPortal falhou (HTTP ${res.status}).`, { status: res.status });
  }
}

/** `user/getcurrentuser`. A flat object, no envelope (ENDPOINTS.md 4.1). */
export async function getCurrentUser(http: PortalHttp, config: PortalConfig): Promise<CurrentUser> {
  const label = 'getcurrentuser';
  const res = await http.request({ method: 'GET', url: apiUrl(config.baseUrl, 'user/getcurrentuser') });
  assertOk(res, label);
  const user = validate(currentUserSchema, parseJson(res, label), label);
  return { login: user.login, username: user.username };
}
