import { useRef, useState, type KeyboardEvent } from 'react';
import { SAMPLE_LANGUAGES, TOKEN_VARIABLE, buildSample, buildUrl, type SampleLanguage } from '../lib/samples';
import type { DocModel, DocOperation } from '../lib/spec';
import { CopyButton } from './CopyButton';
import { JsonView } from './JsonView';
import { InlineText } from './Markdown';

export interface ApiResult {
  /** 0 when the local server did not answer. */
  status: number;
  statusText: string;
  ms: number;
  bytes: number;
  body: unknown;
  isJson: boolean;
}

function formatBytes(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1).replace('.', ',')} KB`;
}

function ResultStatus({ result }: { result: ApiResult }) {
  if (result.status === 0) {
    return <span className="status__code status__code--err">sem resposta</span>;
  }
  const ok = result.status >= 200 && result.status < 300;
  return (
    <span className="status">
      <span className={`status__code status__code--${ok ? 'ok' : 'err'}`}>
        {result.status} {result.statusText}
      </span>
      {result.ms} ms · {formatBytes(result.bytes)}
    </span>
  );
}

interface CodePanelProps {
  model: DocModel;
  operation: DocOperation;
  values: Record<string, string>;
  result: ApiResult | null;
  /** The current login's token, offered for copying into the samples. */
  token: string | null;
}

export function CodePanel({ model, operation, values, result, token }: CodePanelProps) {
  const [language, setLanguage] = useState<SampleLanguage>('curl');
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const url = buildUrl(model.serverUrl || location.origin, operation, values);
  const sample = buildSample(language, url);

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    const nextIndex = (index + step + SAMPLE_LANGUAGES.length) % SAMPLE_LANGUAGES.length;
    setLanguage(SAMPLE_LANGUAGES[nextIndex]!.id);
    tabs.current[nextIndex]?.focus();
  }

  return (
    <aside className="code-panel" aria-label="Exemplos e resposta">
      <div className="code-panel__url">
        <span className="method">{operation.method}</span>
        <code>{url}</code>
      </div>

      <div className="tabs" role="tablist" aria-label="Linguagem do exemplo">
        {SAMPLE_LANGUAGES.map((lang, index) => (
          <button
            key={lang.id}
            ref={(el) => {
              tabs.current[index] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${lang.id}`}
            aria-selected={lang.id === language}
            aria-controls="code-sample"
            tabIndex={lang.id === language ? 0 : -1}
            className="tab"
            onClick={() => setLanguage(lang.id)}
            onKeyDown={(event) => onTabKey(event, index)}
          >
            {lang.label}
          </button>
        ))}
      </div>

      <div className="code-panel__head">
        <span className="overline">Exemplo de requisição</span>
        <CopyButton text={sample} small />
      </div>
      <pre id="code-sample" role="tabpanel" aria-labelledby={`tab-${language}`} className="code-panel__block" tabIndex={0}>
        {sample}
      </pre>
      <div className="code-panel__hint code-panel__hint--token">
        <span>
          <InlineText
            text={
              token
                ? `Defina \`${TOKEN_VARIABLE}\` com o token da sua sessão.`
                : `Defina \`${TOKEN_VARIABLE}\` com o token que você recebe ao entrar.`
            }
          />
        </span>
        {token && <CopyButton text={token} label="Copiar token" small />}
      </div>

      <div className="code-panel__response" aria-live="polite">
        <div className="code-panel__head">
          <span className="overline">{result ? 'Sua resposta' : 'Exemplo de resposta'}</span>
          {result ? <ResultStatus result={result} /> : <span className="muted">dados fictícios</span>}
        </div>
        {result === null ? (
          <JsonView value={operation.example} label="Exemplo de resposta" />
        ) : result.status === 0 ? (
          <p className="code-panel__hint">O servidor local não respondeu. Ele ainda está rodando no terminal?</p>
        ) : result.isJson ? (
          <JsonView value={result.body} label="Resposta" />
        ) : (
          <pre className="code-panel__block">{String(result.body)}</pre>
        )}
      </div>
    </aside>
  );
}
