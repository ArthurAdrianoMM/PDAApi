import { listarAulas } from './aulas.js';
import { listarAulasDaDisciplina, obterAula } from './aulas-disciplina.js';
import { listarEventosDoCalendario } from './calendario.js';
import type { Operation } from './define.js';
import { listarDisciplinas } from './disciplinas.js';
import { obterFaltas } from './faltas.js';
import { listarEtapasDaDisciplina } from './etapas.js';
import { listarFaltasPorAula } from './faltas-aulas.js';
import { obterGradeCurricular } from './grade-curricular.js';
import { obterHorario } from './horario.js';
import { obterNotas } from './notas.js';
import { listarPeriodos } from './periodos.js';

export {
  defineFileOperation,
  defineOperation,
  isFileOperation,
  runFileOperation,
  runOperation,
  type Callout,
  type FileOperation,
  type FileResult,
  type JsonOperation,
  type Operation,
} from './define.js';
export { TAGS, type OperationTag } from './tags.js';

/** Every operation of the API, in docs order. */
export const operations: readonly Operation[] = [
  listarPeriodos,
  listarDisciplinas,
  obterNotas,
  obterFaltas,
  listarFaltasPorAula,
  listarEtapasDaDisciplina,
  obterGradeCurricular,
  obterHorario,
  listarAulas,
  listarAulasDaDisciplina,
  obterAula,
  listarEventosDoCalendario,
];

export function findOperation(id: string): Operation | undefined {
  return operations.find((operation) => operation.id === id);
}
