/**
 * Browser-side state: the local token, the connection to the local server,
 * the hash route and the theme.
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

// ── Token ───────────────────────────────────────────────────────────

const TOKEN_KEY = 'portal-aluno-token';

/** Storage can be blocked (private mode, settings); the page then works without remembering. */
function storageGet(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}
function storageSet(storage: () => Storage, key: string, value: string | null): void {
  try {
    if (value === null) storage().removeItem(key);
    else storage().setItem(key, value);
  } catch {
    // Not remembered; nothing else depends on it.
  }
}

/**
 * The terminal's link carries the token in the hash (`#token=…`), which never
 * reaches the server. Keep it for this tab only and take it out of the address
 * bar. Runs on load and on every hash change: opening the link in a tab that
 * already shows the page changes only the hash.
 */
export function captureTokenFromHash(): string | null {
  const match = /[#&]token=([^&]+)/.exec(location.hash);
  if (!match) return null;
  const token = decodeURIComponent(match[1]!);
  storageSet(() => sessionStorage, TOKEN_KEY, token);
  history.replaceState(null, '', `${location.pathname}${location.search}#/`);
  return token;
}

// ── Connection ──────────────────────────────────────────────────────

export type ConnectionState =
  | 'verificando'
  | 'conectado'
  | 'sem_token'
  | 'token_invalido'
  | 'sessao_expirada'
  | 'somente_leitura';

export interface Connection {
  state: ConnectionState;
  token: string;
  setToken: (token: string) => void;
  /** Feeds the outcome of an API call back, so the page reflects token or session problems. */
  report: (errorCode: string | null) => void;
}

const SESSION_ERRORS = new Set(['sessao_expirada', 'login_falhou']);

export function useConnection(): Connection {
  const [token, setTokenState] = useState(() => storageGet(() => sessionStorage, TOKEN_KEY) ?? '');
  const [serverUp, setServerUp] = useState<boolean | null>(null);
  const [problem, setProblem] = useState<'token_invalido' | 'sessao_expirada' | null>(null);

  useEffect(() => {
    // Only this page's own server answers /health. Anywhere else (a static copy), the page is read-only.
    fetch('/health', { cache: 'no-store' })
      .then((res) => setServerUp(res.ok))
      .catch(() => setServerUp(false));
  }, []);

  const setToken = useCallback((value: string) => {
    const trimmed = value.trim();
    setTokenState(trimmed);
    storageSet(() => sessionStorage, TOKEN_KEY, trimmed || null);
    setProblem(null);
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      const fromLink = captureTokenFromHash();
      if (fromLink) setToken(fromLink);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [setToken]);

  const report = useCallback((errorCode: string | null) => {
    if (errorCode === 'token_invalido') setProblem('token_invalido');
    else if (errorCode !== null && SESSION_ERRORS.has(errorCode)) setProblem('sessao_expirada');
    else if (errorCode === null) setProblem(null);
  }, []);

  const state: ConnectionState =
    serverUp === null ? 'verificando' : !serverUp ? 'somente_leitura' : (problem ?? (token ? 'conectado' : 'sem_token'));

  return { state, token, setToken, report };
}

// ── Route ───────────────────────────────────────────────────────────

export type Route = { kind: 'inicio' } | { kind: 'operacao'; id: string };

export function parseRoute(hash: string): Route {
  const match = /^#\/operacao\/([^/?#]+)/.exec(hash);
  return match ? { kind: 'operacao', id: decodeURIComponent(match[1]!) } : { kind: 'inicio' };
}

export const routeHref = (route: Route): string =>
  route.kind === 'operacao' ? `#/operacao/${encodeURIComponent(route.id)}` : '#/';

function subscribeHash(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribeHash, () => location.hash);
  return parseRoute(hash);
}

// ── Theme ───────────────────────────────────────────────────────────

export type Theme = 'dark' | 'light';
const THEME_KEY = 'portal-aluno-theme';

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() =>
    storageGet(() => localStorage, THEME_KEY) === 'light' ? 'light' : 'dark',
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  const toggle = useCallback(() => {
    setTheme((current) => {
      const next = current === 'dark' ? 'light' : 'dark';
      storageSet(() => localStorage, THEME_KEY, next);
      return next;
    });
  }, []);
  return [theme, toggle];
}
