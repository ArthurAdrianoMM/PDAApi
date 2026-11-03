/**
 * The login flow (ENDPOINTS.md 2.1 to 2.3): alias, JSON login, session
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
 * `TOTVSEducacional/Login`'s answer. On success `data.value` is the session key
 * (ENDPOINTS.md 2.2). The answer to wrong credentials has not been recorded, so
 * every field is optional and only a non-empty string key counts as success.
 */
const loginResponseSchema = z.looseObject({
  data: z.looseObject({ value: z.unknown() }).nullish(),
  messages: z.array(z.looseObject({ type: z.string().optional(), detail: z.string().optional() })).optional(),
});

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
 * Logs in the way the portal's login page does (`login.controller.js`): a JSON
 * POST to `TOTVSEducacional/Login` on the configured origin, so the password
 * cannot be sent anywhere else. Returns the session key from `data.value`.
 * Anything else is a failed login, and the error does not claim a cause. The
 * old form POST on `/Corpore.Net/` answers 503 since 2026-11-03 (ENDPOINTS.md 2.2).
 */
export async function submitLogin(
  http: PortalHttp,
  config: PortalConfig,
  alias: string,
  credentials: Credentials,
): Promise<string> {
  const label = 'Login';
  const res = await http.request({
    method: 'POST',
    url: apiUrl(config.baseUrl, 'TOTVSEducacional/Login'),
    json: { user: credentials.user, password: credentials.password, alias },
  });
  if (res.status >= 500) {
    throw new PortalError('portal_indisponivel', `O portal falhou (${label}, HTTP ${res.status}).`, { status: res.status });
  }

  const parsed = loginResponseSchema.safeParse(parseJsonOrNull(res.body));
  const key = parsed.success ? parsed.data.data?.value : undefined;
  if (res.status >= 200 && res.status < 300 && typeof key === 'string' && key !== '') return key;

  throw new PortalError(
    'login_falhou',
    `O portal não aceitou o login (HTTP ${res.status}, sem chave de sessão). Confira o usuário e a senha.`,
    { status: res.status, portalMessages: parsed.success ? (parsed.data.messages ?? []) : [] },
  );
}

function parseJsonOrNull(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
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
