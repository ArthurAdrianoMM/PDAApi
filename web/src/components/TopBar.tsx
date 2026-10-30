import { useEffect, useRef, type KeyboardEvent } from 'react';
import { loginHref, type Connection, type Route, type Theme } from '../state';
import { DownloadIcon, LogOutIcon, MoonIcon, SearchIcon, SunIcon, UserIcon } from './Icons';

/** Top right: who is logged in, or the way to the login screen. */
function Account({ connection, route }: { connection: Connection; route: Route }) {
  const { state } = connection;
  if (state === 'verificando') return null;
  if (state === 'somente_leitura') {
    return (
      <span className="pill pill--neutral" role="status">
        Somente leitura
      </span>
    );
  }
  if (state === 'conectado') {
    return (
      <div className="account">
        <span className="pill pill--ok account__name" role="status">
          {connection.nome ?? 'Conectado'}
        </span>
        <button type="button" className="icon-btn" onClick={connection.logout} aria-label="Sair" title="Sair">
          <LogOutIcon />
        </button>
      </div>
    );
  }
  const problem = state === 'token_invalido' || state === 'sessao_expirada';
  return (
    <a
      className={`icon-btn account__login${problem ? ' account__login--alert' : ''}`}
      href={loginHref(route)}
      aria-label={problem ? 'Entrar de novo: seu acesso não vale mais' : 'Entrar'}
      title="Entrar"
    >
      <UserIcon />
    </a>
  );
}

interface TopBarProps {
  title: string;
  version: string;
  query: string;
  onQuery: (query: string) => void;
  onSubmitQuery: () => void;
  connection: Connection;
  route: Route;
  theme: Theme;
  onToggleTheme: () => void;
}

export function TopBar({ title, version, query, onQuery, onSubmitQuery, connection, route, theme, onToggleTheme }: TopBarProps) {
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') onSubmitQuery();
    if (event.key === 'Escape') onQuery('');
  }

  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <header className="topbar">
      <a className="brand" href="#/">
        <span className="brand__mark" aria-hidden="true">
          pa
        </span>
        <span className="brand__name">{title}</span>
        <span className="brand__version">v{version}</span>
      </a>

      <label className="search">
        <SearchIcon />
        <span className="sr-only">Buscar na documentação</span>
        <input
          ref={input}
          id="busca"
          name="busca"
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Buscar rota, campo ou assunto (ex.: notas, idTurmaDisc)"
        />
        <kbd>{isMac ? '⌘K' : 'Ctrl K'}</kbd>
      </label>

      <div className="topbar__actions">
        <a className="btn btn--ghost" href="../openapi.json" download="openapi.json">
          <DownloadIcon size={15} />
          openapi.json
        </a>
        <button
          type="button"
          className="icon-btn"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
        <Account connection={connection} route={route} />
      </div>
    </header>
  );
}
