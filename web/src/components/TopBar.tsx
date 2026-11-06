import { useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react';
import { loginHref, type Connection, type Route } from '../state';
import { ChevronDownIcon, DownloadIcon, LogOutIcon, SearchIcon, UserIcon } from './Icons';

function words(nome: string): string[] {
  return nome.trim().split(/\s+/).filter(Boolean);
}

/** First and last initials: "Mariana Costa Ribeiro" → "MR". */
function initials(nome: string): string {
  const parts = words(nome);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/** The first name, title-cased when the portal sends it in capitals. */
function firstName(nome: string): string {
  const first = words(nome)[0] ?? nome;
  return first === first.toUpperCase() ? first.charAt(0) + first.slice(1).toLowerCase() : first;
}

function Avatar({ nome, large = false }: { nome: string | null; large?: boolean }) {
  const letters = nome ? initials(nome) : '';
  return (
    <span className={`avatar${large ? ' avatar--lg' : ''}${letters ? '' : ' avatar--blank'}`} aria-hidden="true">
      {letters || <UserIcon size={large ? 17 : 15} />}
      {!large && <span className="avatar__dot" />}
    </span>
  );
}

/** The logged-in account: a trigger that opens a small panel with the way out. */
function AccountMenu({ nome, onLogout }: { nome: string | null; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const logout = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    logout.current?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Tabbing out of the account closes it.
  function onBlur(event: FocusEvent<HTMLDivElement>) {
    if (!root.current?.contains(event.relatedTarget as Node | null)) setOpen(false);
  }

  return (
    <div className="account" ref={root} onBlur={onBlur}>
      <button
        ref={trigger}
        type="button"
        className="account__trigger"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={nome ? `Conta de ${nome}` : 'Conta'}
        onClick={() => setOpen((value) => !value)}
      >
        <Avatar nome={nome} />
        <span className="account__first">{nome ? firstName(nome) : 'Conectado'}</span>
        <ChevronDownIcon size={14} className="account__chevron" />
      </button>

      <div id={panelId} className={`account__menu${open ? ' account__menu--open' : ''}`}>
        <div className="account__who">
          <Avatar nome={nome} large />
          <div className="account__who-text">
            <span className="account__full">{nome ?? 'Conectado'}</span>
            <span className="account__status">Sessão ativa</span>
          </div>
        </div>
        <div className="account__divider" aria-hidden="true" />
        <button
          ref={logout}
          type="button"
          className="account__item"
          onClick={() => {
            setOpen(false);
            onLogout();
          }}
        >
          <LogOutIcon />
          Sair
        </button>
      </div>
    </div>
  );
}

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
  if (state === 'conectado') return <AccountMenu nome={connection.nome} onLogout={connection.logout} />;
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
}

export function TopBar({ title, version, query, onQuery, onSubmitQuery, connection, route }: TopBarProps) {
  const header = useRef<HTMLElement>(null);
  const input = useRef<HTMLInputElement>(null);

  // The sidebar sticks right under the bar, which grows when its contents wrap.
  useEffect(() => {
    const bar = header.current;
    if (!bar) return;
    const observer = new ResizeObserver(() => {
      document.documentElement.style.setProperty('--topbar-height', `${bar.offsetHeight}px`);
    });
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);

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
    <header className="topbar" ref={header}>
      <a className="brand" href="#/">
        <span className="brand__mark" aria-hidden="true">
          p2
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
        <Account connection={connection} route={route} />
      </div>
    </header>
  );
}
