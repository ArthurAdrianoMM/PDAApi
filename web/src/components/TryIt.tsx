import { useState, type FormEvent } from 'react';
import type { DocOperation, Parameter } from '../lib/spec';
import { loginHref, type Connection, type ConnectionState } from '../state';
import { CopyButton } from './CopyButton';
import { PlayIcon, UserIcon } from './Icons';
import { InlineText } from './Markdown';

const SERVE_COMMAND = 'portal-aluno serve';

/** Why the form is hidden, for each state that needs a login first. */
const LOGIN_NEEDED: Partial<Record<ConnectionState, { title: string; text: string }>> = {
  sem_token: {
    title: 'Entre para testar com seus dados',
    text: 'A documentação funciona sem conta. Para enviar requisições, entre com o usuário e a senha do portal.',
  },
  token_invalido: {
    title: 'Seu acesso não vale mais',
    text: 'O servidor reiniciou ou você entrou em outra aba. Entre de novo para continuar testando.',
  },
  sessao_expirada: {
    title: 'A sessão no portal expirou',
    text: 'O servidor não conseguiu entrar de novo sozinho. Entre outra vez com seu usuário e senha.',
  },
};

function ParameterInput({ param, value, onChange }: { param: Parameter; value: string; onChange: (value: string) => void }) {
  const id = `param-${param.name}`;
  const type = typeof param.schema.type === 'string' ? param.schema.type : 'string';
  const fallback = param.schema.default === undefined ? null : String(param.schema.default);

  return (
    <div className="param">
      <label htmlFor={id} className="param__label">
        <code>{param.name}</code>
        <span className="param__meta">
          {param.in === 'path' ? 'caminho' : 'query'} · {type} · {param.required ? 'obrigatório' : 'opcional'}
        </span>
      </label>
      {type === 'boolean' ? (
        <select id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">{fallback === null ? 'Não enviar' : `Padrão (${fallback})`}</option>
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      ) : (
        <input
          id={id}
          className="field"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode={type === 'integer' || type === 'number' ? 'numeric' : 'text'}
          placeholder={fallback ?? ''}
          required={param.required}
        />
      )}
      {param.description && (
        <span className="param__help">
          <InlineText text={param.description} />
        </span>
      )}
    </div>
  );
}

interface TryItProps {
  operation: DocOperation;
  values: Record<string, string>;
  onValues: (values: Record<string, string>) => void;
  connection: Connection;
  sending: boolean;
  onSend: () => void;
  /** Present when there is a response to clear. */
  onClear: (() => void) | null;
}

export function TryIt({ operation, values, onValues, connection, sending, onSend, onClear }: TryItProps) {
  const [missing, setMissing] = useState<string[]>([]);
  const { state } = connection;

  if (state === 'somente_leitura') {
    return (
      <section className="op-section" aria-labelledby="testar">
        <h2 id="testar" className="overline">
          Testar
        </h2>
        <div className="notice notice--dashed">
          <strong>Para testar com seus dados, rode o servidor no seu computador</strong>
          <div className="actions">
            <code className="code-chip">{SERVE_COMMAND}</code>
            <CopyButton text={SERVE_COMMAND} />
          </div>
          <p>Depois, entre com seu usuário e senha na documentação que ele serve. A senha vai do seu computador direto para o portal.</p>
        </div>
      </section>
    );
  }

  const needed = LOGIN_NEEDED[state];
  if (needed) {
    return (
      <section className="op-section" aria-labelledby="testar">
        <h2 id="testar" className="overline">
          Testar
        </h2>
        <div className="notice notice--warn" role={state === 'sem_token' ? undefined : 'alert'}>
          <strong>{needed.title}</strong>
          <p>{needed.text}</p>
          <div className="actions">
            <a className="btn btn--primary" href={loginHref({ kind: 'operacao', id: operation.id })}>
              <UserIcon size={15} />
              Entrar
            </a>
          </div>
        </div>
      </section>
    );
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const empty = operation.parameters.filter((p) => p.required && !values[p.name]?.trim()).map((p) => p.name);
    setMissing(empty);
    if (empty.length === 0) onSend();
  }

  const canSend = state === 'conectado' && !sending;
  const calls = Math.max(operation.upstream.length, 1);

  return (
    <section className="op-section" aria-labelledby="testar">
      <div className="section-head">
        <h2 id="testar" className="overline">
          Parâmetros · testar
        </h2>
        {operation.parameters.length === 0 && <span className="muted">Este endpoint não tem parâmetros.</span>}
      </div>

      <form onSubmit={submit} noValidate>
        <div className="params">
          {operation.parameters.map((param) => (
            <ParameterInput
              key={param.name}
              param={param}
              value={values[param.name] ?? ''}
              onChange={(value) => onValues({ ...values, [param.name]: value })}
            />
          ))}
        </div>

        {missing.length > 0 && (
          <p className="form-error" role="alert">
            Preencha: {missing.join(', ')}.
          </p>
        )}

        <div className="actions">
          <button type="submit" className="btn btn--primary" disabled={!canSend}>
            <PlayIcon size={15} />
            {sending ? 'Enviando…' : 'Enviar requisição'}
          </button>
          {onClear && (
            <button type="button" className="btn btn--ghost" onClick={onClear}>
              Limpar resposta
            </button>
          )}
          <span className="muted">
            {calls === 1 ? 'Cada envio faz uma chamada ao portal.' : `Cada envio faz ${calls} chamadas ao portal.`}
          </span>
        </div>
      </form>
    </section>
  );
}
