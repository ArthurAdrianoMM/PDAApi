import { useMemo } from 'react';
import { tokenizeJson } from '../lib/json';

const CLASS = { key: 'json-key', string: 'json-string', number: 'json-number', literal: 'json-literal' } as const;

export function JsonView({ value, label }: { value: unknown; label: string }) {
  const tokens = useMemo(() => tokenizeJson(JSON.stringify(value, null, 2) ?? 'undefined'), [value]);
  return (
    <pre className="code-panel__block" aria-label={label} tabIndex={0}>
      {tokens.map((token, i) =>
        token.kind === 'plain' ? token.text : (
          <span key={i} className={CLASS[token.kind]}>
            {token.text}
          </span>
        ),
      )}
    </pre>
  );
}
