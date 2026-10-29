export type JsonTokenKind = 'key' | 'string' | 'number' | 'literal' | 'plain';

export interface JsonToken {
  kind: JsonTokenKind;
  text: string;
}

const TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b/g;

/** Splits pretty-printed JSON into colored runs. Joining the texts gives the input back. */
export function tokenizeJson(json: string): JsonToken[] {
  const tokens: JsonToken[] = [];
  let last = 0;
  for (const match of json.matchAll(TOKEN)) {
    if (match.index > last) tokens.push({ kind: 'plain', text: json.slice(last, match.index) });
    const [whole, string, colon, number] = match;
    if (string !== undefined && colon !== undefined) {
      tokens.push({ kind: 'key', text: string }, { kind: 'plain', text: colon });
    } else if (string !== undefined) {
      tokens.push({ kind: 'string', text: string });
    } else if (number !== undefined) {
      tokens.push({ kind: 'number', text: number });
    } else {
      tokens.push({ kind: 'literal', text: whole });
    }
    last = match.index + whole.length;
  }
  if (last < json.length) tokens.push({ kind: 'plain', text: json.slice(last) });
  return tokens;
}
