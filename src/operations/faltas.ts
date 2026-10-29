import { z } from 'zod';
import { codeLike, optionalText } from '../core/schemas.js';
import { defineOperation } from './define.js';
import { readStageColumns } from './stages.js';

/** `SITUACAOFALTAS` codes, with the texts of the portal's own legend on `#/faltas`. */
const LIMITE_DESCRICOES: Record<number, string> = {
  1: 'Faltas dentro do limite',
  2: 'Faltas próximas do limite',
  3: 'Faltas acima do limite',
  4: 'Não foi possível calcular o percentual',
};

/** One `data.FaltasEtapa[]` row: fixed fields plus one column per stage (`0 - Faltas`). */
const upstreamRowSchema = z
  .looseObject({
    IDTURMADISC: z.number().int(),
    CODDISC: codeLike,
    Disciplina: z.string(),
    CODTURMA: codeLike,
    Situação: optionalText,
    PERCENTUAL: z.number().nullish(),
    SITUACAOFALTAS: z.number().int().nullish(),
  })
  .transform((row, ctx) => ({
    idTurmaDisc: row.IDTURMADISC,
    codigo: row.CODDISC,
    nome: row.Disciplina,
    turma: row.CODTURMA,
    situacao: row.Situação,
    percentual: row.PERCENTUAL ?? null,
    limite: {
      codigo: row.SITUACAOFALTAS ?? null,
      descricao: (row.SITUACAOFALTAS && LIMITE_DESCRICOES[row.SITUACAOFALTAS]) || null,
    },
    etapas: readStageColumns(row, ctx).map(({ etapa, nome, valor, numero }) => ({ etapa, nome, valor, faltas: numero })),
  }));

const upstreamSchema = z.looseObject({ FaltasEtapa: z.array(upstreamRowSchema) });

const etapaSchema = z.object({
  etapa: z.number().int().describe('Número da etapa, o que vem antes do hífen no nome da coluna do portal.'),
  nome: z.string().describe('Nome da etapa, o texto depois do hífen (ex.: `Faltas`).'),
  valor: z.string().nullable().describe('O valor como o portal envia, ou `null` quando vazio.'),
  faltas: z.number().nullable().describe('`valor` como número quando ele é numérico; senão `null`.'),
});

const disciplinaSchema = z.object({
  idTurmaDisc: z.number().int().describe('ID da turma da disciplina. Combina com `/disciplinas` e `/faltas/aulas`.'),
  codigo: z.string().describe('Código da disciplina (`CODDISC`).'),
  nome: z.string().describe('Nome da disciplina.'),
  turma: z.string().describe('Código da turma (`CODTURMA`).'),
  situacao: z.string().nullable().describe('Situação na disciplina, como o portal envia (ex.: `Matriculado`).'),
  percentual: z.number().nullable().describe('Percentual de faltas que o portal calcula (`PERCENTUAL`), ou `null`.'),
  limite: z.object({
    codigo: z
      .number()
      .int()
      .nullable()
      .describe('`SITUACAOFALTAS` do portal: 1 dentro do limite, 2 próximo, 3 acima, 4 sem cálculo.'),
    descricao: z.string().nullable().describe('O texto da legenda do portal para `codigo`, ou `null` se o código for outro.'),
  }),
  etapas: z.array(etapaSchema).describe('Uma por etapa, em ordem de etapa.'),
});

export const obterFaltas = defineOperation({
  id: 'obterFaltas',
  method: 'get',
  path: '/faltas',
  tag: 'Desempenho',
  summary: 'Faltas por disciplina',
  description:
    'Retorna o total de faltas de cada disciplina da matrícula que a sessão está usando, ' +
    'com uma entrada por etapa, o percentual e a situação em relação ao limite. ' +
    'Para ver cada aula em que houve falta, use `/faltas/aulas`.',
  callouts: [
    {
      kind: 'warning',
      title: 'Etapas mudam de nome',
      body:
        'Como em `/notas`, o portal manda cada etapa como uma coluna com nome livre, como `0 - Faltas`. ' +
        'Aqui elas viram itens de `etapas[]`: `etapa` é o número antes do hífen e `nome` o texto depois. ' +
        'Leia pelo `etapa`, nunca pela posição.',
    },
    {
      kind: 'info',
      title: 'Limite e percentual',
      body:
        '`limite.codigo` segue a legenda do portal: 1 dentro do limite, 2 próximo do limite, 3 acima do limite, ' +
        '4 não foi possível calcular o percentual. O portal só mostra essa legenda e o percentual quando a escola ' +
        'liga a validação de limite de faltas. Na conta testada, todas as disciplinas vieram com 4, mesmo com `percentual` preenchido.',
    },
    {
      kind: 'info',
      title: 'Total e faltas por aula',
      body:
        'Na conta testada, `faltas` da etapa `0` foi igual ao número de itens de `/faltas/aulas` da mesma disciplina ' +
        'quando a janela de datas cobria o período. Cada falta conta uma aula.',
    },
  ],
  upstream: ['TOTVSEducacional/FaltaEtapa'],
  input: z.object({
    idTurmaDisc: z
      .number()
      .int()
      .positive()
      .optional()
      .describe('Só esta disciplina, como quando se escolhe uma disciplina na página do portal. Sem ele, vêm todas.'),
  }),
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
        situacao: 'Matriculado',
        percentual: 8.33,
        limite: { codigo: 1, descricao: 'Faltas dentro do limite' },
        etapas: [{ etapa: 0, nome: 'Faltas', valor: '6', faltas: 6 }],
      },
    ],
  },
  async handler(session, { idTurmaDisc }) {
    const { context } = await session.ensureSession();
    // Without idTurmaDisc the portal answers for every class of the context in the cookie (ENDPOINTS.md 4.3).
    const data = await session.getData('TOTVSEducacional/FaltaEtapa', { idTurmaDisc }, upstreamSchema);
    return { periodo: context.codPerLet, disciplinas: data.FaltasEtapa };
  },
});
