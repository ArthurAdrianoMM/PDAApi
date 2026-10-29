import { useState, type FormEvent } from 'react';
import type { DocOperation, Parameter } from '../lib/spec';
import type { Connection } from '../state';
import { CopyButton } from './CopyButton';
import { PlayIcon } from './Icons';
import { InlineText } from './Markdown';

const SERVE_COMMAND = 'portal-aluno serve';

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
  const { state, token } = connection;

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
          <p>Ele pede seu usuário e senha no terminal e abre esta documentação já conectada. A senha vai do seu computador direto para o portal.</p>
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

  const canSend = Boolean(token) && state !== 'verificando' && !sending;
  const calls = Math.max(operation.upstream.length, 1);

  return (
    <section className="op-section" aria-labelledby="testar">
      <div className="section-head">
        <h2 id="testar" className="overline">
          Parâmetros · testar
        </h2>
        {operation.parameters.length === 0 && <span className="muted">Este endpoint não tem parâmetros.</span>}
      </div>

      {state === 'sessao_expirada' && (
        <div className="notice notice--warn" role="alert">
          <strong>A sessão no portal expirou</strong>
          <p>
            O servidor tentou entrar de novo e não conseguiu. No terminal, pare o servidor (Ctrl+C) e rode{' '}
            <code>{SERVE_COMMAND}</code> outra vez. A senha é pedida lá, nunca nesta página.
          </p>
        </div>
      )}

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
          <div className="param">
            <label htmlFor="token" className="param__label">
              <code>Authorization</code>
              <span className="param__meta">header · Bearer</span>
            </label>
            <input
              id="token"
              className="field"
              type="password"
              autoComplete="off"
              value={token}
              onChange={(e) => connection.setToken(e.target.value)}
              placeholder="Cole o token do terminal"
            />
            <span className="param__help">
              {state === 'token_invalido'
                ? 'Este token não é o da execução atual. Use o link ou o token que o terminal mostrou por último.'
                : 'Token desta execução, preenchido pelo link do terminal.'}
            </span>
          </div>
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
