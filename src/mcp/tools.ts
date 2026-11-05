/**
 * How an operation is presented as an MCP tool: name, texts, schemas and
 * annotations. Pure: no session, no transport.
 */
import type { StandardSchemaWithJSON, ToolAnnotations } from '@modelcontextprotocol/server';
import type { z } from 'zod';
import { jsonSchema } from '../api/json-schema.js';
import { isFileOperation, type Operation } from '../operations/index.js';

/** Every tool only reads, reading twice changes nothing, and the portal is outside this process. */
export const ANNOTATIONS: ToolAnnotations = { readOnlyHint: true, idempotentHint: true, openWorldHint: true };

export interface ToolConfig {
  title: string;
  description: string;
  inputSchema: StandardSchemaWithJSON<Record<string, unknown>, Record<string, unknown>>;
  /** JSON operations only; a file is not JSON. */
  outputSchema?: StandardSchemaWithJSON;
  annotations: ToolAnnotations;
}

type Rewrite = (text: string) => string;

/**
 * Rewrites mentions of this API's paths, such as `` `/disciplinas` ``, as the
 * tools that answer them (`` `listarDisciplinas` ``). The operation texts are
 * written for the HTTP API; a model calling tools only knows tool names.
 */
export function pathsToTools(operations: readonly Operation[]): Rewrite {
  const byPath = new Map(operations.map((operation) => [operation.path, operation.id]));
  return (text) =>
    text.replace(/`(\/[^`?\s]*)(\?[^`]*)?`/g, (mention, path: string) => {
      const id = byPath.get(path);
      return id === undefined ? mention : `\`${id}\``;
    });
}

/** The description, then each callout. Callouts hold what is easy to get wrong, so the model must see them too. */
export function toolDescription(operation: Operation, rewrite: Rewrite): string {
  const parts = [operation.description, ...operation.callouts.map(({ title, body }) => `**${title}:** ${body}`)];
  if (isFileOperation(operation)) parts.push(`**Resposta:** ${operation.file.description}`);
  return rewrite(parts.join('\n\n'));
}

/** Applies `rewrite` to every `description` in a JSON Schema. */
function rewriteDescriptions(node: unknown, rewrite: Rewrite): unknown {
  if (Array.isArray(node)) return node.map((item) => rewriteDescriptions(item, rewrite));
  if (node === null || typeof node !== 'object') return node;
  return Object.fromEntries(
    Object.entries(node).map(([key, value]) => [
      key,
      key === 'description' && typeof value === 'string' ? rewrite(value) : rewriteDescriptions(value, rewrite),
    ]),
  );
}

/**
 * The Zod schema, still validated by Zod, published with the same JSON Schema
 * as the OpenAPI document, with its descriptions rewritten for tools.
 */
export function toolSchema<S extends z.ZodType>(schema: S, rewrite: Rewrite): StandardSchemaWithJSON<z.input<S>, z.output<S>> {
  const publish = (io: 'input' | 'output') => rewriteDescriptions(jsonSchema(schema, io), rewrite) as Record<string, unknown>;
  return {
    '~standard': {
      ...schema['~standard'],
      jsonSchema: { input: () => publish('input'), output: () => publish('output') },
    },
  };
}

export function toolConfig(operation: Operation, rewrite: Rewrite): ToolConfig {
  return {
    title: operation.summary,
    description: toolDescription(operation, rewrite),
    inputSchema: toolSchema(operation.input, rewrite),
    ...(isFileOperation(operation) ? {} : { outputSchema: toolSchema(operation.output, rewrite) }),
    annotations: ANNOTATIONS,
  };
}
