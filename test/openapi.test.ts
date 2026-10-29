import { readFile } from 'node:fs/promises';
import { Validator } from '@seriousme/openapi-schema-validator';
import { describe, expect, it } from 'vitest';
import { generateOpenApi } from '../src/openapi/generate.js';
import { operations } from '../src/operations/index.js';
import { VERSION } from '../src/version.js';

const readJson = async (path: string) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));

type Doc = {
  paths: Record<string, Record<string, { operationId: string; parameters: { name: string; in: string; required: boolean }[]; responses: Record<string, unknown> }>>;
};

describe('OpenAPI document', () => {
  const doc = generateOpenApi();

  it('is valid OpenAPI 3.1', async () => {
    const result = await new Validator().validate(structuredClone(doc));
    expect(result.errors).toBeUndefined();
    expect(result.valid).toBe(true);
  });

  it('matches the committed openapi.json (run `npm run openapi` after changing operations)', async () => {
    expect(await readJson('../openapi.json')).toEqual(JSON.parse(JSON.stringify(doc)));
  });

  it('uses the package version', async () => {
    expect(VERSION).toBe((await readJson('../package.json')).version);
  });

  it('has one operation per definition, with a 200 example and the error responses', () => {
    const { paths } = doc as Doc;
    for (const op of operations) {
      const entry = paths[op.path]![op.method]!;
      expect(entry.operationId).toBe(op.id);
      expect(entry.responses['200']).toMatchObject({ content: { 'application/json': { example: op.example } } });
      expect(Object.keys(entry.responses)).toEqual(expect.arrayContaining(['400', '401', '403', '502', '503']));
    }
  });

  it('turns input fields into query parameters with their defaults', () => {
    const { parameters } = (doc as Doc).paths['/disciplinas']!.get!;
    expect(parameters).toEqual([
      expect.objectContaining({ name: 'apenasEmCurso', in: 'query', required: false, schema: { type: 'boolean', default: false } }),
    ]);
  });

  it('uses the given server URL', () => {
    expect(generateOpenApi({ serverUrl: 'http://127.0.0.1:9999' })).toMatchObject({ servers: [{ url: 'http://127.0.0.1:9999' }] });
  });
});
