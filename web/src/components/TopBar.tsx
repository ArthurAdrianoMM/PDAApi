import { useEffect, useRef, type KeyboardEvent } from 'react';
import type { ConnectionState, Theme } from '../state';
import { DownloadIcon, MoonIcon, SearchIcon, SunIcon } from './Icons';

const PILL: Record<ConnectionState, { tone: 'ok' | 'warn' | 'neutral'; label: (host: string) => string }> = {
  verificando: { tone: 'neutral', label: () => 'Verificando…' },
  conectado: { tone: 'ok', label: (host) => `Conectado · ${host}` },
  sem_token: { tone: 'warn', label: () => 'Falta o token' },
  token_invalido: { tone: 'warn', label: () => 'Token inválido' },
  sessao_expirada: { tone: 'warn', label: () => 'Sessão do portal expirou' },
  somente_leitura: { tone: 'neutral', label: () => 'Somente leitura' },
};

interface TopBarProps {
  title: string;
  version: string;
  query: string;
  onQuery: (query: string) => void;
  onSubmitQuery: () => void;
  connection: ConnectionState;
  theme: Theme;
  onToggleTheme: () => void;
}

export function TopBar({ title, version, query, onQuery, onSubmitQuery, connection, theme, onToggleTheme }: TopBarProps) {
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

  const pill = PILL[connection];
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
        <span className={`pill pill--${pill.tone}`} role="status">
          {pill.label(location.host)}
        </span>
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
      </div>
    </header>
  );
}
