/**
 * Mapping aid: logs in to the real portal once, GETs each API path given and
 * prints the *shape* of its `data`: field names, JSON types, string formats and
 * counts. Values are never printed, except the distinct values of fields named
 * in `--values`, which is meant for codes and enums, never for personal fields.
 *
 *   npm run probe -- <path[?query]>… [--values CAMPO,CAMPO] [--periodo 2026S1] [--contexto PARAM]
 *   npm run probe -- TOTVSEducacional/Periodos
 *   npm run probe -- 'TOTVSEducacional/EtapasTurmaDisc?idTurmaDisc=1&tipoEtapaTurmaDisc=F'
 *   npm run probe -- TOTVSEducacional/Aluno/CalendarioAluno --values EVENTTYPE,LABEL
 *
 * `--contexto PARAM` sends the enrollment's context ID in that query parameter,
 * as `v1/planoaulas/aulas` needs (ENDPOINTS.md 4.8). The ID is never printed.
 *
 * The user and password come from PORTAL_ALUNO_USER / PORTAL_ALUNO_PASSWORD or
 * are asked in the terminal, like `npm run try`.
 */
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { terminalCredentials } from '../src/cli/prompt.js';
import { PortalSession, isPortalError, type RequestOptions } from '../src/core/index.js';

const MAX_VALUES = 25;

/** A string's format, without its value. */
function stringFormat(value: string): string {
  if (value === '') return 'string(vazio)';
  if (value.trim() === '') return 'string(espaços)';
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) return 'string(data-hora)';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'string(data)';
  if (/^\d{2}\/\d{2}\/\d{4}/.test(value)) return 'string(dd/mm/aaaa)';
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(value)) return 'string(hora)';
  if (/^-?\d+$/.test(value)) return 'string(inteiro)';
  if (/^-?\d+[.,]\d+$/.test(value)) return 'string(decimal)';
  if (value.startsWith('data:')) return `string(data-url ${value.slice(5, value.indexOf(';'))})`;
  if (/^<\?xml|^<[A-Za-z]/.test(value)) return 'string(xml/html)';
  if (/^https?:\/\//.test(value)) return 'string(url)';
  if (value.length > 200) return `string(${value.length} caracteres)`;
  return 'string';
}

function typeOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  if (typeof value === 'string') return stringFormat(value);
  return typeof value;
}

/** Merged shape of every value seen at one path. */
interface Shape {
  types: Map<string, number>;
  seen: number;
  fields: Map<string, Shape>;
  items: Shape | null;
  lengths: number[];
}

const newShape = (): Shape => ({ types: new Map(), seen: 0, fields: new Map(), items: null, lengths: [] });

function add(shape: Shape, value: unknown): void {
  const type = typeOf(value);
  shape.seen += 1;
  shape.types.set(type, (shape.types.get(type) ?? 0) + 1);
  if (Array.isArray(value)) {
    shape.lengths.push(value.length);
    shape.items ??= newShape();
    for (const item of value) add(shape.items, item);
  } else if (type === 'object') {
    for (const [key, field] of Object.entries(value as Record<string, unknown>)) {
      let child = shape.fields.get(key);
      if (!child) shape.fields.set(key, (child = newShape()));
      add(child, field);
    }
  }
}

function describe(shape: Shape): string {
  const types = [...shape.types].map(([type, count]) => (shape.types.size > 1 ? `${type}×${count}` : type)).join(' | ');
  const lengths = shape.lengths.length
    ? ` [${Math.min(...shape.lengths)}${shape.lengths.length > 1 ? `–${Math.max(...shape.lengths)}` : ''} itens]`
    : '';
  return types + lengths;
}

function print(shape: Shape, name: string, indent: string, parentSeen: number): void {
  const missing = parentSeen > shape.seen ? ` (em ${shape.seen}/${parentSeen})` : '';
  console.log(`${indent}${name}: ${describe(shape)}${missing}`);
  for (const [key, child] of shape.fields) print(child, key, `${indent}  `, shape.types.get('object') ?? 0);
  if (shape.items && (shape.items.fields.size > 0 || shape.items.items)) print(shape.items, '[]', `${indent}  `, shape.items.seen);
  else if (shape.items && shape.items.seen > 0) console.log(`${indent}  []: ${describe(shape.items)}`);
}

/** Distinct values of the named fields, anywhere in the response. */
function collect(value: unknown, names: Set<string>, out: Map<string, Map<string, number>>): void {
  if (Array.isArray(value)) return value.forEach((item) => collect(item, names, out));
  if (typeof value !== 'object' || value === null) return;
  for (const [key, field] of Object.entries(value)) {
    if (names.has(key) && (typeof field !== 'object' || field === null)) {
      const text = field === null ? 'null' : JSON.stringify(field).slice(0, 120);
      const counts = out.get(key) ?? new Map<string, number>();
      counts.set(text, (counts.get(text) ?? 0) + 1);
      out.set(key, counts);
    }
    collect(field, names, out);
  }
}

/** Prints the shape of one path's `data`, and the values asked for. */
async function probe(session: PortalSession, target: string, valueFields: Set<string>, options: RequestOptions): Promise<void> {
  const [path = '', search = ''] = target.split('?', 2);
  const data = await session.getData(path, Object.fromEntries(new URLSearchParams(search)), z.unknown(), options);
  const shape = newShape();
  add(shape, data);
  print(shape, 'data', '', 1);

  const out = new Map<string, Map<string, number>>();
  collect(data, valueFields, out);
  for (const [field, counts] of out) {
    const list = [...counts].sort((a, b) => b[1] - a[1]);
    console.log(`\n${field}: ${counts.size} valores distintos`);
    for (const [text, count] of list.slice(0, MAX_VALUES)) console.log(`  ${text} ×${count}`);
    if (list.length > MAX_VALUES) console.log(`  … mais ${list.length - MAX_VALUES}`);
  }
}

function report(error: unknown): void {
  if (isPortalError(error)) {
    console.error(`Erro [${error.code}]: ${error.message}`);
    for (const message of error.portalMessages) console.error(`  portal: ${message.type ?? ''} ${message.detail ?? ''}`);
  } else {
    console.error(error instanceof Error ? error.message : error);
  }
  process.exitCode = 1;
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { values: { type: 'string' }, periodo: { type: 'string' }, contexto: { type: 'string' } },
  });
  if (positionals.length === 0) {
    console.error('Uso: npm run probe -- <caminho[?query]>… [--values CAMPO,CAMPO] [--periodo 2026S1] [--contexto PARAM]');
    process.exit(2);
  }
  const valueFields = new Set(values.values?.split(',') ?? []);
  const options: RequestOptions = { periodo: values.periodo, ...(values.contexto ? { contextParam: values.contexto } : {}) };

  const session = new PortalSession({ credentials: terminalCredentials() });
  try {
    const { context } = await session.login();
    console.log(`Matrícula da sessão: ${context.codPerLet}${values.periodo ? `; pedindo ${values.periodo}` : ''}`);
    for (const target of positionals) {
      console.log(`\n## ${target}`);
      // One failing path doesn't stop the others.
      await probe(session, target, valueFields, options).catch(report);
    }
  } catch (error) {
    report(error);
  } finally {
    session.forget();
  }
}

await main();
