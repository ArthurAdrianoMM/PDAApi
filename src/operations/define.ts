import type { z } from 'zod';
import type { PortalSession } from '../core/index.js';
import type { OperationTag } from './tags.js';

/** A highlighted note on the endpoint's page. `body` is Markdown. */
export interface Callout {
  kind: 'info' | 'warning';
  title: string;
  body: string;
}

/**
 * One endpoint of this API, defined once. The HTTP routes, the OpenAPI
 * document and the MCP tools are all generated from these definitions.
 */
export interface Operation<I extends z.ZodObject = z.ZodObject, O extends z.ZodType = z.ZodType> {
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
  output: O;
  /** A made-up response that satisfies `output`. Never real data. */
  example: z.output<O>;
  handler: (session: PortalSession, input: z.output<I>) => Promise<z.input<O>>;
}

/** Keeps the input and output types tied to the schemas. */
export function defineOperation<I extends z.ZodObject, O extends z.ZodType>(operation: Operation<I, O>): Operation<I, O> {
  return operation;
}

/**
 * Validates the input, runs the handler and checks its result against the
 * output schema. Bad input throws a `ZodError`; portal failures a `PortalError`.
 * A result that breaks the output schema is a bug here, and throws a plain `Error`.
 */
export async function runOperation<I extends z.ZodObject, O extends z.ZodType>(
  operation: Operation<I, O>,
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
