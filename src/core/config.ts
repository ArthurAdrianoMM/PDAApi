export interface PortalConfig {
  /** Portal origin. Every request, the login form included, goes to this origin. */
  baseUrl: string;
  /**
   * Institution alias. When omitted, the client uses the only alias that
   * `ListarAlias` returns, as the login page does.
   */
  alias?: string;
  /**
   * Which enrollment to use, by period code (`CODPERLET`, e.g. `2026S2`).
   * When omitted, the enrollment with the latest `DTINICIO` is used (ENDPOINTS.md 2.4).
   */
  codPerLet?: string;
  /** Minimum time between the start of two requests to the portal, in ms. */
  minRequestIntervalMs: number;
  /** Per-request timeout, in ms. */
  timeoutMs: number;
  userAgent: string;
}

export const DEFAULT_CONFIG: PortalConfig = {
  baseUrl: 'https://senaiweb6.fieb.org.br',
  minRequestIntervalMs: 250,
  timeoutMs: 30_000,
  userAgent: 'portal-aluno/0.1.0',
};

/** REST base for every portal API path (ENDPOINTS.md 1). */
export const API_BASE_PATH = '/FrameHTML/RM/API/';

/** Cookie the portal's own JavaScript sets after login; API clients must set it (ENDPOINTS.md 2.4). */
export const CONTEXT_COOKIE = 'EduContextoAlunoResponsavelAPI';
