/**
 * Builds the OpenAPI 3.1 document from the operation definitions. Nothing in it
 * is written by hand: schemas come from Zod, texts from each operation file.
 */
import { z } from 'zod';
import { DEFAULT_CONFIG, PORTAL_ERROR_CODES } from '../core/index.js';
import { ERROR_DESCRIPTIONS, ERROR_STATUS, apiErrorSchema, type ApiErrorCode } from '../http/errors.js';
import { TAGS, operations as allOperations, type Callout, type Operation } from '../operations/index.js';
import { VERSION } from '../version.js';

export const DEFAULT_SERVER_URL = 'http://127.0.0.1:4321';
export const SECURITY_SCHEME = 'tokenLocal';

type JsonSchema = Record<string, unknown>;
export type OpenApiDocument = Record<string, unknown>;

export interface OpenApiOptions {
  serverUrl?: string;
  /** The portal this server talks to, shown in the docs. */
  portalUrl?: string;
  operations?: readonly Operation[];
}

const API_DESCRIPTION = [
  'API somente leitura para os seus dados do Portal do Aluno do SENAI. Ela roda no seu computador ' +
    '(`portal-aluno serve`) e fala com o portal usando a sua conta. Nenhum outro servidor participa.',
  '**Autenticação:** cada execução do servidor gera um token novo e o mostra no terminal. ' +
    'Envie-o como `Authorization: Bearer <token>`. O link da documentação que o terminal mostra já traz o token.',
  'Projeto de aula, não oficial. Sem vínculo com o SENAI ou a FIEB.',
].join('\n\n');

/** Errors any operation can return, besides the portal's. */
const OPERATION_LOCAL_ERRORS: ApiErrorCode[] = ['parametro_invalido', 'token_invalido', 'erro_interno'];

function jsonSchema(schema: z.ZodType, io: 'input' | 'output'): JsonSchema {
  const { $schema: _, ...rest } = z.toJSONSchema(schema, {
    io,
    unrepresentable: 'throw',
    // `.int()` adds the safe-integer range as bounds; they are noise in the docs.
    override: ({ jsonSchema }) => {
      if (jsonSchema.minimum === Number.MIN_SAFE_INTEGER) delete jsonSchema.minimum;
      if (jsonSchema.maximum === Number.MAX_SAFE_INTEGER) delete jsonSchema.maximum;
    },
  }) as JsonSchema;
  return rest;
}

/** Callouts as GitHub-style alerts, so any Markdown viewer shows them. */
function alert(kind: Callout['kind'], title: string, body: string): string {
  const lines = body.split('\n').map((line) => `> ${line}`.trimEnd());
  return [`> [!${kind === 'warning' ? 'WARNING' : 'NOTE'}]`, `> **${title}**`, '>', ...lines].join('\n');
}

function operationDescription(operation: Operation): string {
  const upstream = operation.upstream.map((path) => `\`${path}\``).join(', ');
  return [
    operation.description,
    ...operation.callouts.map((c) => alert(c.kind, c.title, c.body)),
    alert(
      'info',
      'De onde vêm os dados',
      `O servidor local chama ${upstream} no portal. A resposta vai do portal para o seu computador e para mais nenhum lugar.`,
    ),
  ].join('\n\n');
}

function parameters(operation: Operation): JsonSchema[] {
  const schema = jsonSchema(operation.input, 'input') as { properties?: Record<string, JsonSchema>; required?: string[] };
  return Object.entries(schema.properties ?? {}).map(([name, { description, ...property }]) => {
    const inPath = operation.path.includes(`{${name}}`);
    return {
      name,
      in: inPath ? 'path' : 'query',
      required: inPath || (schema.required ?? []).includes(name),
      ...(description === undefined ? {} : { description }),
      schema: property,
    };
  });
}

/** One response per status, listing the error codes it can carry, with an example of each. */
function errorResponses(codes: ApiErrorCode[]): Record<string, JsonSchema> {
  const byStatus = new Map<number, ApiErrorCode[]>();
  for (const code of codes) byStatus.set(ERROR_STATUS[code], [...(byStatus.get(ERROR_STATUS[code]) ?? []), code]);

  const responses: Record<string, JsonSchema> = {};
  for (const [status, group] of [...byStatus].sort(([a], [b]) => a - b)) {
    responses[String(status)] = {
      description: group.map((code) => `\`${code}\`: ${ERROR_DESCRIPTIONS[code]}`).join('\n\n'),
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/Erro' },
          examples: Object.fromEntries(
            group.map((code) => [code, { summary: code, value: { erro: code, mensagem: ERROR_DESCRIPTIONS[code] } }]),
          ),
        },
      },
    };
  }
  return responses;
}

function operationObject(operation: Operation): JsonSchema {
  const errorCodes = [...OPERATION_LOCAL_ERRORS, ...(Object.keys(PORTAL_ERROR_CODES) as ApiErrorCode[])];
  return {
    operationId: operation.id,
    tags: [operation.tag],
    summary: operation.summary,
    description: operationDescription(operation),
    parameters: parameters(operation),
    responses: {
      '200': {
        description: operation.summary,
        content: { 'application/json': { schema: jsonSchema(operation.output, 'output'), example: operation.example } },
      },
      ...errorResponses(errorCodes),
    },
    'x-upstream': operation.upstream,
  };
}

export function generateOpenApi(options: OpenApiOptions = {}): OpenApiDocument {
  const operations = options.operations ?? allOperations;
  const usedTags = new Set(operations.map((op) => op.tag));

  const paths: Record<string, Record<string, JsonSchema>> = {};
  for (const operation of operations) {
    paths[operation.path] = { ...paths[operation.path], [operation.method]: operationObject(operation) };
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'Portal do Aluno API',
      version: VERSION,
      description: API_DESCRIPTION,
      'x-portal': { url: options.portalUrl ?? DEFAULT_CONFIG.baseUrl },
    },
    servers: [{ url: options.serverUrl ?? DEFAULT_SERVER_URL, description: 'Servidor local (`portal-aluno serve`)' }],
    security: [{ [SECURITY_SCHEME]: [] }],
    tags: TAGS.filter((tag) => usedTags.has(tag.name)).map((tag) => ({ name: tag.name, description: tag.description })),
    paths,
    components: {
      securitySchemes: {
        [SECURITY_SCHEME]: {
          type: 'http',
          scheme: 'bearer',
          description: 'Token desta execução, mostrado no terminal por `portal-aluno serve`.',
        },
      },
      schemas: { Erro: jsonSchema(apiErrorSchema, 'output') },
    },
  };
}
