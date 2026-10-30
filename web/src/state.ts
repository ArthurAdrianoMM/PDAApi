/**
 * Browser-side state: the login and its token, the connection to the local
 * server, the hash route and the theme.
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { parseRoute, type Route } from './lib/route';

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

/** "Lembrar de mim" keeps the token in localStorage (this browser); otherwise it lives in sessionStorage (this tab). */
function loadToken(): string {
  return storageGet(() => localStorage, TOKEN_KEY) ?? storageGet(() => sessionStorage, TOKEN_KEY) ?? '';
}
function saveToken(token: string | null, remember = false): void {
  storageSet(() => localStorage, TOKEN_KEY, remember ? token : null);
  storageSet(() => sessionStorage, TOKEN_KEY, remember ? null : token);
}

/**
 * When the server logs in at startup, the terminal's link carries the token in
 * the hash (`#token=…`), which never reaches the server. Keep it for this tab
 * only and take it out of the address bar. Runs on load and on every hash
 * change: opening the link in a tab that already shows the page changes only the hash.
 */
export function captureTokenFromHash(): string | null {
  const match = /[#&]token=([^&]+)/.exec(location.hash);
  if (!match) return null;
  const token = decodeURIComponent(match[1]!);
  saveToken(token);
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
  /** The student's name, once the server confirmed the token. */
  nome: string | null;
  /** Logs in through the local server. Resolves to a message for the person, or null on success. */
  login: (usuario: string, senha: string, lembrar: boolean) => Promise<string | null>;
  logout: () => void;
  /** Feeds the outcome of an API call back, so the page reflects token or session problems. */
  report: (errorCode: string | null) => void;
}

const SESSION_ERRORS = new Set(['sessao_expirada', 'login_falhou']);

interface ApiErrorBody {
  erro?: string;
  mensagem?: string;
  detalhes?: { mensagem: string }[];
}

const readJson = (res: Response): Promise<unknown> => res.json().catch(() => null);

export function errorCodeOf(body: unknown): string | null {
  return typeof body === 'object' && body !== null && 'erro' in body ? String(body.erro) : null;
}

function loginErrorMessage(body: ApiErrorBody | null, status: number): string {
  if (body?.erro === 'login_falhou') return 'O portal não aceitou o login. Confira o usuário e a senha e tente de novo.';
  if (body?.detalhes?.length) return body.detalhes.map((d) => d.mensagem).join(' ');
  return body?.mensagem ?? `O servidor local respondeu HTTP ${status}.`;
}

export function useConnection(): Connection {
  const [token, setToken] = useState(loadToken);
  const [serverUp, setServerUp] = useState<boolean | null>(null);
  /** The token the server last confirmed, and whose name it is. */
  const [confirmed, setConfirmed] = useState<{ token: string; nome: string | null } | null>(null);
  const [problem, setProblem] = useState<'token_invalido' | 'sessao_expirada' | null>(null);

  useEffect(() => {
    // Only this page's own server answers /health. Anywhere else (a static copy), the page is read-only.
    fetch('/health', { cache: 'no-store' })
      .then((res) => setServerUp(res.ok))
      .catch(() => setServerUp(false));
  }, []);

  const report = useCallback((errorCode: string | null) => {
    if (errorCode === 'token_invalido') setProblem('token_invalido');
    else if (errorCode !== null && SESSION_ERRORS.has(errorCode)) setProblem('sessao_expirada');
    else if (errorCode === null) setProblem(null);
  }, []);

  const adopt = useCallback((value: string, nome: string | null = null) => {
    setToken(value);
    setConfirmed(nome === null ? null : { token: value, nome });
    setProblem(null);
  }, []);

  // A link from the terminal, or a login or logout in another tab ("Lembrar de mim").
  useEffect(() => {
    const onHashChange = () => {
      const fromLink = captureTokenFromHash();
      if (fromLink) adopt(fromLink);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === TOKEN_KEY) adopt(loadToken());
    };
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('storage', onStorage);
    };
  }, [adopt]);

  // A saved token may be from an earlier run of the server: ask the server whether it still works.
  useEffect(() => {
    if (!serverUp || !token || confirmed?.token === token) return;
    let cancelled = false;
    fetch('/sessao', { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' })
      .then(async (res) => {
        const body = (await readJson(res)) as { nome?: string } | null;
        if (cancelled) return;
        setConfirmed({ token, nome: res.ok ? (body?.nome ?? null) : null });
        report(res.ok ? null : (errorCodeOf(body) ?? 'token_invalido'));
      })
      .catch(() => setServerUp(false));
    return () => {
      cancelled = true;
    };
  }, [serverUp, token, confirmed, report]);

  const login = useCallback(
    async (usuario: string, senha: string, lembrar: boolean) => {
      let res: Response;
      try {
        res = await fetch('/sessao', {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({ usuario, senha }),
          cache: 'no-store',
        });
      } catch {
        return 'O servidor local não respondeu. Ele ainda está rodando no terminal?';
      }
      const body = (await readJson(res)) as (ApiErrorBody & { token?: string; nome?: string }) | null;
      if (!res.ok || !body?.token) return loginErrorMessage(body, res.status);
      saveToken(body.token, lembrar);
      adopt(body.token, body.nome ?? null);
      return null;
    },
    [adopt],
  );

  const logout = useCallback(() => {
    if (token) fetch('/sessao', { method: 'DELETE', headers: { authorization: `Bearer ${token}` } }).catch(() => {});
    saveToken(null);
    adopt('');
  }, [token, adopt]);

  const state: ConnectionState =
    serverUp === null
      ? 'verificando'
      : !serverUp
        ? 'somente_leitura'
        : !token
          ? 'sem_token'
          : (problem ?? (confirmed?.token === token ? 'conectado' : 'verificando'));

  return { state, token, nome: confirmed?.token === token ? confirmed.nome : null, login, logout, report };
}

// ── Route ───────────────────────────────────────────────────────────

export { loginHref, parseRoute, routeHref, type Route } from './lib/route';

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
