import { z } from 'zod';
import { codeLike } from '../core/schemas.js';
import { defineOperation } from './define.js';
import { readStageColumns } from './stages.js';

const avaliacaoSchema = z.object({
  etapa: z.number().int().describe('Número da etapa, o que vem antes do hífen no nome da coluna do portal.'),
  nome: z.string().describe('Nome da avaliação, o texto depois do hífen (ex.: `AV 1 / AV QT 1`).'),
  valor: z.string().nullable().describe('O valor como o portal envia, ou `null` quando vazio.'),
  nota: z.number().nullable().describe('`valor` como número quando ele é numérico; senão `null`.'),
});

/** One `data.Notas[]` row: fixed fields plus one column per assessment (`1 - AV 1 / AV QT 1`). */
const upstreamRowSchema = z
  .looseObject({
    IDTURMADISC: z.number().int(),
    CODDISC: codeLike,
    DISCIPLINA: z.string(),
    CODTURMA: codeLike,
    SITUACAO: z.string().nullish(),
  })
  .transform((row, ctx) => ({
    idTurmaDisc: row.IDTURMADISC,
    codigo: row.CODDISC,
    nome: row.DISCIPLINA,
    turma: row.CODTURMA,
    situacao: row.SITUACAO ?? null,
    avaliacoes: readStageColumns(row, ctx).map(({ etapa, nome, valor, numero }) => ({ etapa, nome, valor, nota: numero })),
  }));

const upstreamSchema = z.looseObject({ Notas: z.array(upstreamRowSchema) });

const disciplinaSchema = z.object({
  idTurmaDisc: z.number().int().describe('ID da turma da disciplina. Combina com `/disciplinas`.'),
  codigo: z.string().describe('Código da disciplina (`CODDISC`).'),
  nome: z.string().describe('Nome da disciplina.'),
  turma: z.string().describe('Código da turma (`CODTURMA`).'),
  situacao: z.string().nullable().describe('Situação na disciplina, como o portal envia.'),
  avaliacoes: z.array(avaliacaoSchema).describe('Uma por avaliação, em ordem de etapa.'),
});

export const obterNotas = defineOperation({
  id: 'obterNotas',
  method: 'get',
  path: '/notas',
  tag: 'Desempenho',
  summary: 'Notas',
  description:
    'Retorna as notas de cada disciplina da matrícula que a sessão está usando, ' +
    'com uma entrada por avaliação. O período respondido vem em `periodo`.',
  callouts: [
    {
      kind: 'warning',
      title: 'Avaliações mudam de nome',
      body:
        'O portal manda cada avaliação como uma coluna com nome livre, como `1 - AV 1 / AV QT 1`. ' +
        'Aqui elas viram itens de `avaliacoes[]`: `etapa` é o número antes do hífen e `nome` o texto depois. ' +
        'Leia pelo `etapa`, nunca pela posição.',
    },
    {
      kind: 'info',
      title: 'Valor e nota',
      body:
        '`valor` é o texto como o portal envia. `nota` é o mesmo valor como número quando ele é numérico ' +
        '(com vírgula ou ponto) e `null` nos outros casos, como avaliações ainda sem nota.',
    },
  ],
  upstream: ['TOTVSEducacional/NotaEtapa'],
  input: z.object({}),
  output: z.object({
    periodo: z.string().describe('Código do período da matrícula da sessão (ex.: `2026S2`).'),
    disciplinas: z.array(disciplinaSchema),
  }),
  example: {
    periodo: '2026S2',
    disciplinas: [
      {
        idTurmaDisc: 48213,
        codigo: 'PW2',
        nome: 'Programação Web II',
        turma: 'DS-2026-A',
        situacao: 'Cursando',
        avaliacoes: [
          { etapa: 1, nome: 'AV 1 / AV QT 1', valor: '8,5', nota: 8.5 },
          { etapa: 3, nome: 'AV 3 / AV QT 3', valor: null, nota: null },
        ],
      },
    ],
  },
  async handler(session) {
    const { context } = await session.ensureSession();
    // No parameters: the portal answers for the context in the cookie (ENDPOINTS.md 4.3).
    const data = await session.getData('TOTVSEducacional/NotaEtapa', {}, upstreamSchema);
    return { periodo: context.codPerLet, disciplinas: data.Notas };
  },
});
