/** The docs page's logic (web/src/lib), checked against the real generated spec. */
import { describe, expect, it } from 'vitest';
import { generateOpenApi } from '../src/openapi/generate.js';
import { operations } from '../src/operations/index.js';
import { tokenizeJson } from '../web/src/lib/json.js';
import { parseBlocks, parseInline } from '../web/src/lib/markdown.js';
import { buildSample, buildUrl } from '../web/src/lib/samples.js';
import { flattenSchema } from '../web/src/lib/schema.js';
import { searchOperations } from '../web/src/lib/search.js';
import { buildModel, type DocOperation, type OpenApiDocument } from '../web/src/lib/spec.js';

const model = buildModel(generateOpenApi({ portalUrl: 'https://portal.test' }) as unknown as OpenApiDocument);
const byId = (id: string) => model.operations.find((op) => op.id === id) as DocOperation;

describe('spec model', () => {
  it('has every operation, grouped by tag, with its example', () => {
    expect(model.operations.map((op) => op.id).sort()).toEqual(operations.map((op) => op.id).sort());
    for (const op of operations) expect(byId(op.id).example).toEqual(op.example);
    expect(model.tags.map((t) => t.name)).toEqual(['Período', 'Desempenho']);
  });

  it('reads parameters, errors, upstream calls and the portal address', () => {
    expect(byId('listarDisciplinas').parameters).toEqual([
      expect.objectContaining({ name: 'apenasEmCurso', in: 'query', required: false, schema: { type: 'boolean', default: false } }),
    ]);
    expect(byId('obterNotas').errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'token_invalido', status: 401 }),
        expect.objectContaining({ code: 'portal_recusou', status: 403 }),
      ]),
    );
    expect(byId('obterNotas').upstream).toEqual(['TOTVSEducacional/NotaEtapa']);
    expect(model.portalUrl).toBe('https://portal.test');
  });
});

describe('markdown', () => {
  it('reads the generated description into paragraphs and callouts', () => {
    const blocks = parseBlocks(byId('obterNotas').description);
    expect(blocks[0]).toMatchObject({ kind: 'paragraph' });
    expect(blocks).toContainEqual(expect.objectContaining({ kind: 'alert', tone: 'warning', title: 'Avaliações mudam de nome' }));
    expect(blocks).toContainEqual(expect.objectContaining({ kind: 'alert', tone: 'note', title: 'De onde vêm os dados' }));
  });

  it('reads code, bold and links', () => {
    expect(parseInline('a `x` **b** [c](https://d.test)')).toEqual([
      { type: 'text', value: 'a ' },
      { type: 'code', value: 'x' },
      { type: 'text', value: ' ' },
      { type: 'strong', value: 'b' },
      { type: 'text', value: ' ' },
      { type: 'link', value: 'c', href: 'https://d.test' },
    ]);
  });

  it('keeps links to other schemes as plain text', () => {
    const parts = parseInline('[e](javascript:alert(1))');
    expect(parts.some((part) => part.type === 'link')).toBe(false);
    expect(parts.map((part) => part.value).join('')).toBe('[e](javascript:alert(1))');
  });
});

describe('response fields', () => {
  it('lists nested fields with array markers and nullable types', () => {
    const rows = flattenSchema(byId('obterNotas').output);
    expect(rows.map((r) => r.path)).toEqual([
      'periodo',
      'disciplinas[]',
      'disciplinas[].idTurmaDisc',
      'disciplinas[].codigo',
      'disciplinas[].nome',
      'disciplinas[].turma',
      'disciplinas[].situacao',
      'disciplinas[].avaliacoes[]',
      'disciplinas[].avaliacoes[].etapa',
      'disciplinas[].avaliacoes[].nome',
      'disciplinas[].avaliacoes[].valor',
      'disciplinas[].avaliacoes[].nota',
    ]);
    expect(rows.find((r) => r.path === 'disciplinas[].avaliacoes[].nota')?.type).toBe('number | null');
    expect(rows.find((r) => r.path === 'disciplinas[]')?.type).toBe('array<object>');
  });
});

describe('code samples', () => {
  const disciplinas = byId('listarDisciplinas');
  const pathOp: DocOperation = { ...disciplinas, path: '/aulas/{id}', parameters: [{ name: 'id', in: 'path', required: true, description: '', schema: {} }] };

  it('puts query values in the URL and leaves empty ones out', () => {
    expect(buildUrl('http://127.0.0.1:4321/', disciplinas, { apenasEmCurso: 'true' })).toBe('http://127.0.0.1:4321/disciplinas?apenasEmCurso=true');
    expect(buildUrl('http://127.0.0.1:4321', disciplinas, { apenasEmCurso: ' ' })).toBe('http://127.0.0.1:4321/disciplinas');
  });

  it('fills path parameters, encoded, or keeps the placeholder', () => {
    expect(buildUrl('http://x', pathOp, { id: 'a/b' })).toBe('http://x/aulas/a%2Fb');
    expect(buildUrl('http://x', pathOp, {})).toBe('http://x/aulas/{id}');
  });

  it('reads the token from an environment variable, never inlines it', () => {
    for (const language of ['curl', 'javascript', 'python'] as const) {
      expect(buildSample(language, 'http://x/notas')).toContain('PORTAL_ALUNO_TOKEN');
    }
  });
});

describe('json highlighting', () => {
  it('classifies keys, strings, numbers and literals without changing the text', () => {
    const json = JSON.stringify({ a: 'x: "y"', b: -1.5e3, c: [true, null] }, null, 2);
    const tokens = tokenizeJson(json);
    expect(tokens.map((t) => t.text).join('')).toBe(json);
    expect(tokens.filter((t) => t.kind === 'key').map((t) => t.text)).toEqual(['"a"', '"b"', '"c"']);
    expect(tokens.find((t) => t.kind === 'string')?.text).toBe('"x: \\"y\\""');
    expect(tokens.filter((t) => t.kind === 'literal').map((t) => t.text)).toEqual(['true', 'null']);
  });
});

describe('search', () => {
  it('ignores accents and case, and looks into response fields', () => {
    expect(searchOperations(model.operations, 'PERIODO').map((op) => op.id)).toContain('listarPeriodos');
    expect(searchOperations(model.operations, 'avaliacoes nota').map((op) => op.id)).toEqual(['obterNotas']);
    expect(searchOperations(model.operations, 'nada-disso')).toEqual([]);
  });
});
