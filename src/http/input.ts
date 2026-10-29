import { z } from 'zod';
import type { Operation } from '../operations/index.js';

type PropertyType = 'boolean' | 'integer' | 'number' | 'string' | 'other';

const typeCache = new WeakMap<Operation, Map<string, PropertyType>>();

/** The JSON type of each input property, read from the operation's input schema. */
function propertyTypes(operation: Operation): Map<string, PropertyType> {
  let types = typeCache.get(operation);
  if (!types) {
    const schema = z.toJSONSchema(operation.input, { io: 'input' }) as { properties?: Record<string, { type?: unknown }> };
    types = new Map(
      Object.entries(schema.properties ?? {}).map(([name, property]) => {
        const type = property.type;
        const known = type === 'boolean' || type === 'integer' || type === 'number' || type === 'string';
        return [name, known ? type : 'other'];
      }),
    );
    typeCache.set(operation, types);
  }
  return types;
}

/** Converts one query or path string to the declared type. Values that don't convert stay strings, so the schema reports them. */
function coerce(value: string, type: PropertyType | undefined): unknown {
  if (type === 'boolean') return value === 'true' ? true : value === 'false' ? false : value;
  if ((type === 'integer' || type === 'number') && /^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
}

/**
 * Builds an operation's input from path parameters and the query string, and
 * validates it strictly: unknown parameters are an error, not ignored.
 */
export function readInput(
  operation: Operation,
  params: Record<string, string>,
  query: Record<string, string[]>,
): Record<string, unknown> {
  const types = propertyTypes(operation);
  const raw: Record<string, unknown> = {};
  for (const [name, values] of Object.entries(query)) {
    raw[name] = values.length === 1 ? coerce(values[0]!, types.get(name)) : values;
  }
  for (const [name, value] of Object.entries(params)) raw[name] = coerce(value, types.get(name));

  z.strictObject(operation.input.shape).parse(raw);
  return raw;
}

/** `/aulas/{idTurmaDisc}` → `/aulas/:idTurmaDisc` */
export function toRoutePath(openApiPath: string): string {
  return openApiPath.replace(/\{([^}]+)\}/g, ':$1');
}
