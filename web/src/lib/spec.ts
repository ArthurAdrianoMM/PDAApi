/**
 * Reads the OpenAPI document the server generates (src/openapi/generate.ts)
 * into the shape the pages use. The page knows nothing about the endpoints
 * except what this document says.
 */

export type JsonSchema = {
  type?: string | string[];
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  anyOf?: JsonSchema[];
  enum?: unknown[];
  default?: unknown;
  [key: string]: unknown;
};

interface ParameterObject {
  name: string;
  in: string;
  required?: boolean;
  description?: string;
  schema?: JsonSchema;
}

interface MediaObject {
  schema?: JsonSchema;
  example?: unknown;
  examples?: Record<string, { value?: { erro?: string; mensagem?: string } }>;
}

interface OperationObject {
  operationId: string;
  tags?: string[];
  summary?: string;
  description?: string;
  parameters?: ParameterObject[];
  responses?: Record<string, { description?: string; content?: Record<string, MediaObject> }>;
  'x-upstream'?: string[];
}

export interface OpenApiDocument {
  info: { title: string; version: string; description?: string; 'x-portal'?: { url?: string } };
  servers?: { url: string }[];
  tags?: { name: string; description?: string }[];
  paths: Record<string, Record<string, OperationObject>>;
}

export interface Parameter {
  name: string;
  in: 'query' | 'path';
  required: boolean;
  description: string;
  schema: JsonSchema;
}

export interface ErrorInfo {
  code: string;
  status: number;
  description: string;
}

export interface DocOperation {
  id: string;
  method: string;
  path: string;
  tag: string;
  summary: string;
  description: string;
  parameters: Parameter[];
  output: JsonSchema;
  example: unknown;
  errors: ErrorInfo[];
  upstream: string[];
}

export interface DocTag {
  name: string;
  description: string;
  operations: DocOperation[];
}

export interface DocModel {
  title: string;
  version: string;
  description: string;
  serverUrl: string;
  /** The portal the local server talks to. */
  portalUrl: string;
  tags: DocTag[];
  /** In sidebar order. */
  operations: DocOperation[];
}

const JSON_TYPE = 'application/json';

function toOperation(path: string, method: string, op: OperationObject): DocOperation {
  const responses = op.responses ?? {};
  const ok = responses['200']?.content?.[JSON_TYPE];

  const errors: ErrorInfo[] = [];
  for (const [status, response] of Object.entries(responses)) {
    if (status === '200') continue;
    for (const [code, example] of Object.entries(response.content?.[JSON_TYPE]?.examples ?? {})) {
      errors.push({ code, status: Number(status), description: example.value?.mensagem ?? '' });
    }
  }

  return {
    id: op.operationId,
    method: method.toUpperCase(),
    path,
    tag: op.tags?.[0] ?? '',
    summary: op.summary ?? op.operationId,
    description: op.description ?? '',
    parameters: (op.parameters ?? [])
      .filter((p) => p.in === 'query' || p.in === 'path')
      .map((p) => ({
        name: p.name,
        in: p.in as Parameter['in'],
        required: p.in === 'path' || Boolean(p.required),
        description: p.description ?? '',
        schema: p.schema ?? {},
      })),
    output: ok?.schema ?? {},
    example: ok?.example,
    errors: errors.sort((a, b) => a.status - b.status),
    upstream: op['x-upstream'] ?? [],
  };
}

export function buildModel(doc: OpenApiDocument): DocModel {
  const all = Object.entries(doc.paths).flatMap(([path, methods]) =>
    Object.entries(methods).map(([method, op]) => toOperation(path, method, op)),
  );

  const tagOrder = (doc.tags ?? []).map((t) => t.name);
  const tagNames = [...tagOrder, ...new Set(all.map((op) => op.tag).filter((name) => !tagOrder.includes(name)))];
  const tags = tagNames
    .map((name) => ({
      name,
      description: doc.tags?.find((t) => t.name === name)?.description ?? '',
      operations: all.filter((op) => op.tag === name),
    }))
    .filter((tag) => tag.operations.length > 0);

  return {
    title: doc.info.title,
    version: doc.info.version,
    description: doc.info.description ?? '',
    serverUrl: doc.servers?.[0]?.url ?? '',
    portalUrl: doc.info['x-portal']?.url ?? '',
    tags,
    operations: tags.flatMap((tag) => tag.operations),
  };
}
