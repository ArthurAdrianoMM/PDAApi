import { flattenSchema } from './schema.js';
import type { DocOperation } from './spec.js';

/** Lower case, without accents: "Período" and "periodo" match. */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/** Searches the route, title, group, description, parameters and response fields. */
export function searchOperations(operations: DocOperation[], query: string): DocOperation[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return operations;
  return operations.filter((op) => {
    const haystack = normalize(
      [
        op.summary,
        op.path,
        op.id,
        op.tag,
        op.description,
        ...op.parameters.map((p) => p.name),
        ...flattenSchema(op.output).map((field) => field.path),
      ].join(' '),
    );
    return terms.every((term) => haystack.includes(term));
  });
}
