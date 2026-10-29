import type { DocOperation } from './spec.js';

export type SampleLanguage = 'curl' | 'javascript' | 'python';

export const SAMPLE_LANGUAGES: { id: SampleLanguage; label: string }[] = [
  { id: 'curl', label: 'cURL' },
  { id: 'javascript', label: 'Node.js' },
  { id: 'python', label: 'Python' },
];

/** The environment variable the samples read the token from. */
export const TOKEN_VARIABLE = 'PORTAL_ALUNO_TOKEN';

/**
 * The request URL for the given parameter values. Path parameters without a
 * value stay as `{name}`; empty query values are left out.
 */
export function buildUrl(base: string, operation: DocOperation, values: Record<string, string>): string {
  let path = operation.path;
  const query = new URLSearchParams();
  for (const param of operation.parameters) {
    const value = values[param.name]?.trim() ?? '';
    if (param.in === 'path') {
      if (value) path = path.replace(`{${param.name}}`, encodeURIComponent(value));
    } else if (value) {
      query.set(param.name, value);
    }
  }
  const search = query.toString();
  return `${base.replace(/\/+$/, '')}${path}${search ? `?${search}` : ''}`;
}

export function buildSample(language: SampleLanguage, url: string): string {
  switch (language) {
    case 'curl':
      return [`curl "${url}" \\`, `  -H "Authorization: Bearer $${TOKEN_VARIABLE}"`].join('\n');
    case 'javascript':
      return [
        `const res = await fetch("${url}", {`,
        `  headers: { Authorization: \`Bearer \${process.env.${TOKEN_VARIABLE}}\` },`,
        '});',
        'const data = await res.json();',
      ].join('\n');
    case 'python':
      return [
        'import os',
        'import requests',
        '',
        'r = requests.get(',
        `    "${url}",`,
        `    headers={"Authorization": f"Bearer {os.environ['${TOKEN_VARIABLE}']}"},`,
        ')',
        'data = r.json()',
      ].join('\n');
  }
}
