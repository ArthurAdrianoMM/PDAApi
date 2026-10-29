import type { JsonSchema } from './spec.js';

export interface FieldRow {
  /** Dotted path, `[]` for array items: `disciplinas[].avaliacoes[].nota`. */
  path: string;
  type: string;
  description: string;
}

/** `string`, `string | null`, `array<object>`… */
export function typeLabel(schema: JsonSchema): string {
  if (schema.anyOf) return [...new Set(schema.anyOf.map(typeLabel))].join(' | ');
  if (Array.isArray(schema.type)) return schema.type.join(' | ');
  if (schema.type === 'array') return `array<${schema.items ? typeLabel(schema.items) : 'unknown'}>`;
  if (schema.enum) return schema.enum.map((value) => JSON.stringify(value)).join(' | ');
  return schema.type ?? 'unknown';
}

/** The object schema a field leads into, if any (through arrays and nullable unions). */
function nestedObject(schema: JsonSchema): { schema: JsonSchema; suffix: string } | null {
  if (schema.type === 'object' && schema.properties) return { schema, suffix: '' };
  if (schema.type === 'array' && schema.items) {
    const inner = nestedObject(schema.items);
    return inner ? { schema: inner.schema, suffix: `[]${inner.suffix}` } : null;
  }
  for (const option of schema.anyOf ?? []) {
    const inner = nestedObject(option);
    if (inner) return inner;
  }
  return null;
}

/** Lists every field of an object schema, depth first, in declaration order. */
export function flattenSchema(schema: JsonSchema, prefix = ''): FieldRow[] {
  const rows: FieldRow[] = [];
  for (const [name, field] of Object.entries(schema.properties ?? {})) {
    const nested = nestedObject(field);
    const path = `${prefix}${name}${field.type === 'array' ? '[]' : ''}`;
    rows.push({ path, type: typeLabel(field), description: field.description ?? '' });
    if (nested) {
      const childPrefix = `${prefix}${name}${nested.suffix}.`;
      rows.push(...flattenSchema(nested.schema, childPrefix));
    }
  }
  return rows;
}
