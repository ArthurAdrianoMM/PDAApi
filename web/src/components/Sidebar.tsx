import { useEffect, useId } from 'react';
import type { DocModel, DocOperation, DocTag } from '../lib/spec';
import { loginHref, routeHref, useClosedGroups, type ConnectionState, type Route } from '../state';
import { ChevronUpIcon, LockIcon } from './Icons';
import { InlineText } from './Markdown';

const SESSION_TEXT: Record<ConnectionState, string> = {
  verificando: 'Verificando o servidor local…',
  conectado: 'A sessão com o portal fica só na memória do servidor, no seu terminal. Ctrl+C lá encerra e apaga.',
  sem_token: 'Você ainda não entrou. Dá para ler tudo; para testar com seus dados, entre com sua conta do portal.',
  token_invalido: 'Seu acesso não vale mais: o servidor reiniciou ou você entrou em outra aba. Entre de novo.',
  sessao_expirada: 'O portal encerrou a sessão e o servidor não conseguiu entrar de novo sozinho. Entre outra vez.',
  somente_leitura: 'Esta cópia não fala com o portal. Para testar com seus dados, rode `portal-aluno serve` no seu computador.',
};

function OperationLink({ operation, current }: { operation: DocOperation; current: boolean }) {
  return (
    <a
      className="nav-item"
      href={routeHref({ kind: 'operacao', id: operation.id })}
      {...(current ? { 'aria-current': 'page' as const } : {})}
    >
      <span>{operation.summary}</span>
      <span className="method">{operation.method}</span>
    </a>
  );
}

interface SidebarGroupProps {
  tag: DocTag;
  open: boolean;
  onToggle: () => void;
  currentId: string | null;
}

/** A tag's operations under a heading that opens and closes them. */
function SidebarGroup({ tag, open, onToggle, currentId }: SidebarGroupProps) {
  const bodyId = useId();
  return (
    <section className={`sidebar__group${open ? '' : ' sidebar__group--closed'}`}>
      <h2 className="sidebar__title">
        <button type="button" className="sidebar__toggle" aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
          <span className="overline">{tag.name}</span>
          <span className="sidebar__meta">
            <span className="sidebar__count">{tag.operations.length}</span>
            <ChevronUpIcon size={14} className="sidebar__chevron" />
          </span>
        </button>
      </h2>
      {/* Closed, the links leave the tab order and the accessibility tree. */}
      <div className="sidebar__body" id={bodyId} inert={!open}>
        <div className="sidebar__items">
          {tag.operations.map((op) => (
            <OperationLink key={op.id} operation={op} current={op.id === currentId} />
          ))}
        </div>
      </div>
    </section>
  );
}

interface SidebarProps {
  model: DocModel;
  route: Route;
  /** When searching, the matching operations; otherwise null. */
  results: DocOperation[] | null;
  connection: ConnectionState;
}

export function Sidebar({ model, route, results, connection }: SidebarProps) {
  const currentId = route.kind === 'operacao' ? route.id : null;
  const [closedGroups, setGroupOpen] = useClosedGroups();

  // Landing on an operation opens its group, so the current link is always in view.
  useEffect(() => {
    const tag = model.tags.find((t) => t.operations.some((op) => op.id === currentId));
    if (tag) setGroupOpen(tag.name, true);
  }, [model, currentId, setGroupOpen]);

  return (
    <nav className="sidebar" aria-label="Documentação">
      <div className="sidebar__group">
        <a className="nav-item" href="#/" {...(route.kind === 'inicio' ? { 'aria-current': 'page' as const } : {})}>
          Comece aqui
        </a>
      </div>

      {results ? (
        <div className="sidebar__group">
          <div className="sidebar__heading">
            <span className="overline">Resultados</span>
            <span className="sidebar__count">{results.length}</span>
          </div>
          {results.length === 0 ? (
            <p className="sidebar__empty">Nada encontrado.</p>
          ) : (
            results.map((op) => <OperationLink key={op.id} operation={op} current={op.id === currentId} />)
          )}
        </div>
      ) : (
        model.tags.map((tag) => {
          const open = !closedGroups.has(tag.name);
          return (
            <SidebarGroup
              key={tag.name}
              tag={tag}
              open={open}
              onToggle={() => setGroupOpen(tag.name, !open)}
              currentId={currentId}
            />
          );
        })
      )}

      <div className="session-card">
        <span className="session-card__title">
          <LockIcon size={15} />
          Sessão local
        </span>
        <p>
          <InlineText text={SESSION_TEXT[connection]} />
        </p>
        {(connection === 'sem_token' || connection === 'token_invalido' || connection === 'sessao_expirada') && (
          <a className="btn btn--ghost btn--small" href={loginHref(route)}>
            Entrar
          </a>
        )}
      </div>
      <p className="sidebar__note">Projeto de aula, não oficial. Sem vínculo com o SENAI ou a FIEB.</p>
    </nav>
  );
}
