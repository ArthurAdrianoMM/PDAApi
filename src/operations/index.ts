import type { Operation } from './define.js';
import { listarDisciplinas } from './disciplinas.js';
import { obterNotas } from './notas.js';
import { listarPeriodos } from './periodos.js';

export { defineOperation, runOperation, type Callout, type Operation } from './define.js';
export { TAGS, type OperationTag } from './tags.js';

/** Every operation of the API, in docs order. */
export const operations: readonly Operation[] = [listarPeriodos, listarDisciplinas, obterNotas];

export function findOperation(id: string): Operation | undefined {
  return operations.find((operation) => operation.id === id);
}
