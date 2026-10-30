import { useMemo, useState } from 'react';
import { buildUrl } from '../lib/samples';
import { flattenSchema } from '../lib/schema';
import type { DocModel, DocOperation } from '../lib/spec';
import { errorCodeOf, routeHref, type Connection } from '../state';
import { CodePanel, type ApiResult } from './CodePanel';
import { CopyButton } from './CopyButton';
import { InlineText, Markdown } from './Markdown';
import { TryIt } from './TryIt';

interface OperationPageProps {
  model: DocModel;
  operation: DocOperation;
  connection: Connection;
}

/** Lets long field paths wrap after each `.`, never inside a name. */
function FieldPath({ path }: { path: string }) {
  const parts = path.split(/(?<=\.)/);
  return (
    <code>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && <wbr />}
        </span>
      ))}
    </code>
  );
}

export function OperationPage({ model, operation, connection }: OperationPageProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ApiResult | null>(null);
  const [sending, setSending] = useState(false);
  const fields = useMemo(() => flattenSchema(operation.output), [operation]);

  const index = model.operations.indexOf(operation);
  const previous = model.operations[index - 1];
  const next = model.operations[index + 1];

  async function send() {
    setSending(true);
    const started = performance.now();
    try {
      const res = await fetch(buildUrl(location.origin, operation, values), {
        headers: { authorization: `Bearer ${connection.token}`, accept: 'application/json' },
        cache: 'no-store',
      });
      const text = await res.text();
      let body: unknown = text;
      let isJson = false;
      try {
        body = JSON.parse(text);
        isJson = true;
      } catch {
        // Shown as text.
      }
      setResult({
        status: res.status,
        statusText: res.statusText,
        ms: Math.round(performance.now() - started),
        bytes: new Blob([text]).size,
        body,
        isJson,
      });
      connection.report(res.ok ? null : isJson ? errorCodeOf(body) : null);
    } catch {
      setResult({ status: 0, statusText: '', ms: Math.round(performance.now() - started), bytes: 0, body: null, isJson: false });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="content__inner">
      <div>
        <p className="overline overline--gold">{operation.tag}</p>
        <h1 className="page-title">{operation.summary}</h1>
      </div>

      <div className="op-columns">
        <article className="card op-doc">
          <section className="op-section" aria-label="Descrição">
            <div className="op-endpoint">
              <span className="method method--chip">{operation.method}</span>
              <code className="code-chip">{operation.path}</code>
              <CopyButton text={operation.path} small label="Copiar rota" />
              <span className="op-endpoint__badges">
                <span className="pill pill--warn">Requer token</span>
                {operation.method === 'GET' && <span className="pill pill--ok">Somente leitura</span>}
              </span>
            </div>
            <Markdown text={operation.description} className="prose op-description" />
          </section>

          <TryIt
            operation={operation}
            values={values}
            onValues={setValues}
            connection={connection}
            sending={sending}
            onSend={send}
            onClear={result ? () => setResult(null) : null}
          />

          <section className="op-section" aria-labelledby="campos">
            <h2 id="campos" className="overline">
              Resposta 200 · campos
            </h2>
            <div className="fields">
              {fields.map((field) => (
                <div className="field-row" key={field.path}>
                  <div className="field-row__name">
                    <FieldPath path={field.path} />
                    <span className="field-row__type">{field.type}</span>
                  </div>
                  <p className="field-row__desc">
                    <InlineText text={field.description} />
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="op-section" aria-labelledby="erros">
            <h2 id="erros" className="overline">
              Erros
            </h2>
            <div className="errors">
              {operation.errors.map((error) => (
                <div className="error-row" key={error.code}>
                  <span className="error-row__status">{error.status}</span>
                  <div className="error-row__body">
                    <code>{error.code}</code>
                    <span>{error.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </article>

        <CodePanel
          model={model}
          operation={operation}
          values={values}
          result={result}
          token={connection.state === 'conectado' ? connection.token : null}
        />
      </div>

      <nav className="pager" aria-label="Navegação entre endpoints">
        {previous ? (
          <a href={routeHref({ kind: 'operacao', id: previous.id })}>
            <span>Anterior</span>← {previous.summary}
          </a>
        ) : (
          <a href="#/">
            <span>Anterior</span>← Comece aqui
          </a>
        )}
        {next && (
          <a className="pager__next" href={routeHref({ kind: 'operacao', id: next.id })}>
            <span>Próximo</span>
            {next.summary} →
          </a>
        )}
      </nav>
    </div>
  );
}
