import type { z } from 'zod';
import {
  bootstrapSession,
  getCurrentUser,
  resolveAlias,
  submitLogin,
  type CredentialsProvider,
  type CurrentUser,
} from './auth.js';
import { CONTEXT_COOKIE, DEFAULT_CONFIG, type PortalConfig } from './config.js';
import { listContexts, pickContext, toActiveContext, type ActiveContext, type ContextRecord } from './context.js';
import { PortalError, isPortalError } from './errors.js';
import { PortalHttp, type FetchFn } from './http.js';
import { assertOk, parseJson, readEnvelope } from './response.js';
import { apiUrl, type QueryValue } from './url.js';

export interface PortalSessionOptions {
  credentials: CredentialsProvider;
  config?: Partial<PortalConfig>;
  /** For tests. Defaults to the global fetch. */
  fetch?: FetchFn;
}

export interface SessionState {
  user: CurrentUser;
  /** The enrollment requests use unless they ask for another period. */
  context: ActiveContext;
  /** Every enrollment of the account, in the portal's order. */
  contexts: ActiveContext[];
}

export interface RequestOptions {
  /**
   * Period code (`CODPERLET`) of the enrollment to ask about. The context
   * cookie of that enrollment goes with this request only. Default: the
   * session's enrollment.
   */
  periodo?: string | undefined;
  /**
   * A query parameter that carries the enrollment's context ID, for the few
   * endpoints that take it in the URL as well (ENDPOINTS.md 4.8). The ID stays
   * inside the session; the caller only names the parameter. It is sent as the
   * page sends it: `encodeURI` first, then URL-encoded as a query value.
   */
  contextParam?: string;
}

/**
 * One student's session with the portal, held in memory only.
 *
 * Logs in on first use, sets the context cookie, and logs in again once when
 * the portal rejects the session. It only issues GETs to the API; it never
 * calls `Logout` or `Contexto/Selecao` (ENDPOINTS.md 8).
 */
export class PortalSession {
  readonly config: PortalConfig;
  readonly #http: PortalHttp;
  readonly #credentials: CredentialsProvider;
  #state: SessionState | null = null;
  /** The enrollment records, with their opaque context IDs. Never leave the session. */
  #records: ContextRecord[] = [];
  #pendingLogin: Promise<SessionState> | null = null;
  /** Bumped on each login, so concurrent calls that hit an expired session log in once. */
  #generation = 0;

  constructor(options: PortalSessionOptions) {
    this.config = { ...DEFAULT_CONFIG, ...options.config };
    this.#http = new PortalHttp(this.config, options.fetch);
    this.#credentials = options.credentials;
  }

  get isLoggedIn(): boolean {
    return this.#state !== null;
  }

  get user(): CurrentUser | null {
    return this.#state?.user ?? null;
  }

  get context(): ActiveContext | null {
    return this.#state?.context ?? null;
  }

  /** Logs in, or joins a login already in progress. */
  login(): Promise<SessionState> {
    this.#pendingLogin ??= this.#login().finally(() => {
      this.#pendingLogin = null;
    });
    return this.#pendingLogin;
  }

  /** Forgets the session locally. The portal is not told (its `Logout` is avoided on purpose). */
  forget(): void {
    this.#state = null;
    this.#records = [];
    this.#http.clearCookies();
  }

  /**
   * GETs an API path that answers with the standard envelope and returns its
   * validated `data`. `path` is relative to `/FrameHTML/RM/API/`.
   */
  getData<S extends z.ZodType>(
    path: string,
    query: Record<string, QueryValue>,
    schema: S,
    options: RequestOptions = {},
  ): Promise<z.output<S>> {
    return this.#withSession(async () => {
      const record = this.#record(options.periodo);
      // The page sends `encodeURI(id)`, which its query serializer then encodes again (ENDPOINTS.md 4.8).
      const fullQuery = options.contextParam ? { ...query, [options.contextParam]: encodeURI(record.IDCONTEXTOALUNO) } : query;
      const res = await this.#http.request({
        method: 'GET',
        url: apiUrl(this.config.baseUrl, path, fullQuery),
        // The jar holds the session's enrollment; another one goes with this request only.
        ...(record.CODPERLET === this.#state?.context.codPerLet ? {} : { cookies: { [CONTEXT_COOKIE]: record.IDCONTEXTOALUNO } }),
      });
      assertOk(res, path);
      return readEnvelope(parseJson(res, path), schema, path);
    });
  }

  /** Returns the current session, logging in first when there is none. */
  async ensureSession(): Promise<SessionState> {
    return this.#state ?? this.login();
  }

  /**
   * The enrollment a request with this `periodo` asks about, logging in first
   * when needed. Throws `periodo_inexistente` for a period the account has no
   * enrollment in.
   */
  async contextFor(periodo?: string): Promise<ActiveContext> {
    const { context } = await this.ensureSession();
    if (periodo === undefined) return context;
    return toActiveContext(this.#record(periodo));
  }

  #record(periodo: string | undefined): ContextRecord {
    const codPerLet = periodo ?? this.#state?.context.codPerLet;
    const record = this.#records.find((r) => r.CODPERLET === codPerLet);
    if (record) return record;
    const available = this.#records.map((r) => r.CODPERLET).join(', ') || 'nenhum';
    throw new PortalError('periodo_inexistente', `Não há matrícula no período ${codPerLet}. Períodos desta conta: ${available}.`);
  }

  /** Runs a task once, and once more after logging in again if the portal rejected the session. */
  async #withSession<T>(task: () => Promise<T>): Promise<T> {
    await this.ensureSession();
    const generation = this.#generation;
    try {
      return await task();
    } catch (error) {
      if (!isPortalError(error, 'sessao_expirada')) throw error;
    }
    // Another call may have logged in again meanwhile; then a retry is enough.
    if (this.#generation === generation || !this.#state) await this.login();
    return task();
  }

  async #login(): Promise<SessionState> {
    // Ask first, so a missing password fails before any request to the portal.
    const credentials = await this.#credentials();
    this.forget();
    const http = this.#http;
    const config = this.config;

    const alias = await resolveAlias(http, config);
    const key = await submitLogin(http, config, alias, credentials);
    await bootstrapSession(http, config, key);

    let user: CurrentUser;
    try {
      user = await getCurrentUser(http, config);
    } catch (error) {
      if (!isPortalError(error, 'sessao_expirada')) throw error;
      throw new PortalError('login_falhou', 'O portal não abriu a sessão depois do login.', {
        status: error.status,
        cause: error,
      });
    }

    const records = await listContexts(http, config);
    const record = pickContext(records, config.codPerLet);
    await http.setCookie(CONTEXT_COOKIE, record.IDCONTEXTOALUNO);

    this.#records = records;
    this.#state = { user, context: toActiveContext(record), contexts: records.map(toActiveContext) };
    this.#generation += 1;
    return this.#state;
  }
}
