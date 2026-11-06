import { z } from 'zod';

export type JsonSchema = Record<string, unknown>;

/**
 * The JSON Schema of one side of a Zod schema, as the OpenAPI document and the
 * MCP tools publish it. `io` picks the side: `input` for what callers send
 * (defaults are optional), `output` for what they get back.
 */
export function jsonSchema(schema: z.ZodType, io: 'input' | 'output'): JsonSchema {
  const { $schema: _, ...rest } = z.toJSONSchema(schema, {
    io,
    unrepresentable: 'throw',
    // `.int()` adds the safe-integer range as bounds; they are noise for readers.
    override: ({ jsonSchema }) => {
      if (jsonSchema.minimum === Number.MIN_SAFE_INTEGER) delete jsonSchema.minimum;
      if (jsonSchema.maximum === Number.MAX_SAFE_INTEGER) delete jsonSchema.maximum;
    },
  }) as JsonSchema;
  return rest;
}
