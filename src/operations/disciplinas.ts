import { z } from 'zod';
import type { PortalSession } from '../core/index.js';
import { codeLike, integerLike, optionalCode } from '../core/schemas.js';
import { defineOperation } from './define.js';
import { periodoInput, periodoOutput } from './periodo.js';

/**
 * `TOTVSEducacional/DisciplinasAlunoPeriodoLetivo` (ENDPOINTS.md 4.3). Only the
 * fields used here are validated. `IDTURMADISC` is documented as a number; the
 * other types are not recorded.
 */
const upstreamSchema = z.array(
  z.looseObject({
    IDTURMADISC: z.number().int(),
    CODDISC: codeLike,
    NOME: z.string(),
    CODTURMA: codeLike,
    CODSUBTURMA: optionalCode,
    IDPERLET: integerLike,
    CODSTATUS: codeLike,
    DESCRICAO: z.string().nullish(),
  }),
);

export type DisciplinaRow = z.output<typeof upstreamSchema>[number];

/** The classes of one enrollment, as `DisciplinasAlunoPeriodoLetivo` lists them. */
export function lerDisciplinas(session: PortalSession, { apenasEmCurso = false, periodo }: { apenasEmCurso?: boolean; periodo?: string | undefined }) {
  return session.getData('TOTVSEducacional/DisciplinasAlunoPeriodoLetivo', { mostraApenasDiscEmCurso: apenasEmCurso }, upstreamSchema, { periodo });
}

const disciplinaSchema = z.object({
  idTurmaDisc: z.number().int().describe('ID da turma da disciplina. É a chave para aulas, faltas e etapas.'),
  codigo: z.string().describe('Código da disciplina (`CODDISC`).'),
  nome: z.string().describe('Nome da disciplina.'),
  turma: z.string().describe('Código da turma (`CODTURMA`).'),
  subturma: z
    .string()
    .nullable()
    .describe('Código da subturma (`CODSUBTURMA`), ou `null` quando não há. As chamadas por aula precisam dele.'),
  idPeriodo: z.number().int().describe('ID do período (`IDPERLET`). Combina com `id` em `/periodos`.'),
  status: z.object({
    codigo: z.string().describe('`CODSTATUS` do portal.'),
    descricao: z.string().nullable().describe('`DESCRICAO` do portal, o texto que acompanha o código.'),
  }),
});

export const listarDisciplinas = defineOperation({
  id: 'listarDisciplinas',
  method: 'get',
  path: '/disciplinas',
  tag: 'Período',
  summary: 'Disciplinas do período',
  description:
    'Lista as disciplinas de um período (padrão: o da matrícula da sessão). ' +
    'Cada uma traz o `idTurmaDisc` e a `subturma`, que os endpoints de aulas usam, e o `idPeriodo`.',
  callouts: [],
  upstream: ['TOTVSEducacional/DisciplinasAlunoPeriodoLetivo'],
  input: z.object({
    apenasEmCurso: z
      .boolean()
      .default(false)
      .describe('Quando `true`, pede ao portal só as disciplinas em curso, como a página de Arquivos faz.'),
    periodo: periodoInput,
  }),
  output: z.object({ periodo: periodoOutput, disciplinas: z.array(disciplinaSchema) }),
  example: {
    periodo: '2026S2',
    disciplinas: [
      {
        idTurmaDisc: 48213,
        codigo: 'PW2',
        nome: 'Programação Web II',
        turma: 'DS-2026-A',
        subturma: null,
        idPeriodo: 1042,
        status: { codigo: '1', descricao: 'Cursando' },
      },
      {
        idTurmaDisc: 48230,
        codigo: 'BD1',
        nome: 'Banco de Dados I',
        turma: 'DS-2026-A',
        subturma: 'SUBTURMA C',
        idPeriodo: 1042,
        status: { codigo: '1', descricao: 'Cursando' },
      },
    ],
  },
  async handler(session, { apenasEmCurso, periodo }) {
    const context = await session.contextFor(periodo);
    const rows = await lerDisciplinas(session, { apenasEmCurso, periodo });
    return {
      periodo: context.codPerLet,
      disciplinas: rows.map((row) => ({
        idTurmaDisc: row.IDTURMADISC,
        codigo: row.CODDISC,
        nome: row.NOME,
        turma: row.CODTURMA,
        subturma: row.CODSUBTURMA,
        idPeriodo: row.IDPERLET,
        status: { codigo: row.CODSTATUS, descricao: row.DESCRICAO ?? null },
      })),
    };
  },
});
