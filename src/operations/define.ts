import type { z } from 'zod';
import type { PortalSession } from '../core/index.js';
import type { OperationTag } from './tags.js';

/** A highlighted note on the endpoint's page. `body` is Markdown. */
export interface Callout {
  kind: 'info' | 'warning';
  title: string;
  body: string;
}

/** What every operation has, whatever it answers with. */
interface OperationBase<I extends z.ZodObject> {
  /** Stable identifier, used as the OpenAPI `operationId`. */
  id: string;
  method: 'get';
  /** Path on the local API, OpenAPI style (`/aulas/{idTurmaDisc}`). */
  path: string;
  tag: OperationTag;
  summary: string;
  /** Markdown. */
  description: string;
  callouts: Callout[];
  /** Portal endpoints this operation calls, relative to `/FrameHTML/RM/API/`. */
  upstream: string[];
  input: I;
}

/**
 * One endpoint of this API that answers with JSON, defined once. The HTTP
 * routes, the OpenAPI document and the MCP tools are all generated from these
 * definitions.
 */
export interface JsonOperation<I extends z.ZodObject = z.ZodObject, O extends z.ZodType = z.ZodType> extends OperationBase<I> {
  kind?: 'json';
  output: O;
  /** A made-up response that satisfies `output`. Never real data. */
  example: z.output<O>;
  handler: (session: PortalSession, input: z.output<I>) => Promise<z.input<O>>;
}

/** A file an operation answers with. */
export interface FileResult {
  /** The name to save it as, or `null` when the portal gives none. */
  nome: string | null;
  /** Media type, such as `application/pdf`. */
  tipo: string;
  conteudo: Uint8Array<ArrayBuffer>;
}

/** One endpoint of this API that answers with a file instead of JSON. */
export interface FileOperation<I extends z.ZodObject = z.ZodObject> extends OperationBase<I> {
  kind: 'file';
  file: {
    /** The media types it may answer with, for the docs. */
    mediaTypes: string[];
    /** Markdown, shown as the 200 response. */
    description: string;
  };
  handler: (session: PortalSession, input: z.output<I>) => Promise<FileResult>;
}

export type Operation = JsonOperation | FileOperation;

/** Keeps the input and output types tied to the schemas. */
export function defineOperation<I extends z.ZodObject, O extends z.ZodType>(operation: JsonOperation<I, O>): JsonOperation<I, O> {
  return operation;
}

/** Keeps the input type tied to the schema, for an operation that answers with a file. */
export function defineFileOperation<I extends z.ZodObject>(operation: Omit<FileOperation<I>, 'kind'>): FileOperation<I> {
  return { ...operation, kind: 'file' };
}

export const isFileOperation = (operation: Operation): operation is FileOperation => operation.kind === 'file';

/**
 * Validates the input, runs the handler and checks its result against the
 * output schema. Bad input throws a `ZodError`; portal failures a `PortalError`.
 * A result that breaks the output schema is a bug here, and throws a plain `Error`.
 */
export async function runOperation<I extends z.ZodObject, O extends z.ZodType>(
  operation: JsonOperation<I, O>,
  session: PortalSession,
  rawInput: unknown,
): Promise<z.output<O>> {
  const input = operation.input.parse(rawInput ?? {});
  const result = operation.output.safeParse(await operation.handler(session, input));
  if (!result.success) {
    throw new Error(`Operation ${operation.id} produced output that breaks its schema.`, { cause: result.error });
  }
  return result.data;
}

/** Like `runOperation`, for an operation that answers with a file. */
export async function runFileOperation<I extends z.ZodObject>(
  operation: FileOperation<I>,
  session: PortalSession,
  rawInput: unknown,
): Promise<FileResult> {
  const input = operation.input.parse(rawInput ?? {});
  const result = await operation.handler(session, input);
  if (!(result.conteudo instanceof Uint8Array) || !result.tipo) {
    throw new Error(`Operation ${operation.id} produced a file without content or type.`);
  }
  return result;
}
