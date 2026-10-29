import { z } from 'zod';
import { codeLike, optionalCode, optionalText } from '../core/schemas.js';
import { defineOperation } from './define.js';

/** The `#/faltas` page's default window: 360 days back from today. */
const JANELA_PADRAO_DIAS = 360;

const pad = (n: number) => String(n).padStart(2, '0');
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hoje = () => localDate(new Date());

/** `AAAA-MM-DD` as a local `Date` at the given time. */
function at(date: string, hours: number, minutes = 0, seconds = 0, ms = 0): Date {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  return new Date(year, month - 1, day, hours, minutes, seconds, ms);
}

function diasAntes(date: string, dias: number): string {
  const d = at(date, 12);
  d.setDate(d.getDate() - dias);
  return localDate(d);
}

/**
 * `data.SFREQUENCIAALUNO[]` (ENDPOINTS.md 4.3). Types as recorded on 2026-10-29.
 * The portal's page guards `DATAFALTA` and `DISCIPLINA` against null, so they may be.
 */
const upstreamSchema = z.looseObject({
  SFREQUENCIAALUNO: z.array(
    z.looseObject({
      IDTURMADISC: z.number().int(),
      IDPLANOAULA: z.number().int().nullish(),
      AULA: z.number().int(),
      CODDISC: codeLike,
      DISCIPLINA: z.string().nullish(),
      CODSUBTURMA: optionalCode,
      DATAFALTA: z.string().regex(/^\d{4}-\d{2}-\d{2}/).nullish(),
      HORAINICIAL: optionalText,
      HORAFINAL: optionalText,
      SITUACAO: optionalText,
      JUSTIFICADAPERSONALIZADO: optionalText,
      ABONAFALTAPERSONALIZADO: optionalText,
      MOTIVOPERSONALIZADO: optionalText,
    }),
  ),
});

const faltaSchema = z.object({
  idTurmaDisc: z.number().int().describe('ID da turma da disciplina. Combina com `/disciplinas` e `/faltas`.'),
  codigo: z.string().describe('Código da disciplina (`CODDISC`).'),
  disciplina: z.string().nullable().describe('Nome da disciplina.'),
  subturma: z.string().nullable().describe('Código da subturma (`CODSUBTURMA`), ou `null` quando não há.'),
  data: z.iso.date().nullable().describe('Dia da aula (AAAA-MM-DD).'),
  aula: z.number().int().describe('Número da aula na disciplina (`AULA`).'),
  horaInicial: z.string().nullable().describe('Início da aula (`HH:MM`).'),
  horaFinal: z.string().nullable().describe('Fim da aula (`HH:MM`).'),
  situacao: z.string().nullable().describe('Situação da falta, como o portal envia (ex.: `Não justificada`).'),
  justificada: z.string().nullable().describe('O texto do portal para "justificada" (ex.: `Não`).'),
  abono: z.string().nullable().describe('O texto do portal sobre abono da falta, ou `null` quando vazio.'),
  motivo: z.string().nullable().describe('A justificativa registrada, ou `null` quando não há.'),
  idPlanoAula: z.number().int().nullable().describe('ID da aula no plano de aulas (`IDPLANOAULA`).'),
});

export const listarFaltasPorAula = defineOperation({
  id: 'listarFaltasPorAula',
  method: 'get',
  path: '/faltas/aulas',
  tag: 'Desempenho',
  summary: 'Faltas por aula',
  description:
    'Lista cada aula em que você faltou, dentro de uma janela de datas, na matrícula que a sessão está usando. ' +
    'Sem `de` e `ate`, a janela é a da página do portal: os últimos 360 dias até hoje. ' +
    'Os itens vêm em ordem de data e horário.',
  callouts: [
    {
      kind: 'info',
      title: 'Só faltas, só a matrícula da sessão',
      body:
        'O portal é chamado com `tipoFrequencia=A` (ausência), como a página faz, então presenças não aparecem. ' +
        'Na conta testada, uma janela que cobria o período anterior trouxe só faltas do período da sessão.',
    },
    {
      kind: 'info',
      title: 'Datas',
      body:
        '`de` e `ate` são dias inteiros no fuso do seu computador: o portal recebe o começo de `de` e o fim de `ate`. ' +
        '`idTurmaDisc` filtra aqui, depois da resposta, como a página do portal faz.',
    },
  ],
  upstream: ['TOTVSEducacional/Aluno/Falta/Aula'],
  input: z
    .object({
      de: z.iso
        .date()
        .optional()
        .describe('Primeiro dia da janela (AAAA-MM-DD). Padrão: 360 dias antes de `ate`.'),
      ate: z.iso.date().optional().describe('Último dia da janela (AAAA-MM-DD). Padrão: hoje.'),
      idTurmaDisc: z.number().int().positive().optional().describe('Só as faltas desta disciplina.'),
    })
    .refine(({ de, ate }) => de === undefined || de <= (ate ?? hoje()), {
      path: ['de'],
      message: '`de` precisa ser igual ou anterior a `ate` (padrão: hoje).',
    }),
  output: z.object({
    periodo: z.string().describe('Código do período da matrícula da sessão (ex.: `2026S2`).'),
    de: z.iso.date().describe('Primeiro dia da janela usada.'),
    ate: z.iso.date().describe('Último dia da janela usada.'),
    faltas: z.array(faltaSchema),
  }),
  example: {
    periodo: '2026S2',
    de: '2025-11-03',
    ate: '2026-10-29',
    faltas: [
      {
        idTurmaDisc: 48213,
        codigo: 'PW2',
        disciplina: 'Programação Web II',
        subturma: null,
        data: '2026-09-14',
        aula: 21,
        horaInicial: '19:00',
        horaFinal: '19:50',
        situacao: 'Não justificada',
        justificada: 'Não',
        abono: null,
        motivo: null,
        idPlanoAula: 7310452,
      },
    ],
  },
  async handler(session, input) {
    const { context } = await session.ensureSession();
    const ate = input.ate ?? hoje();
    const de = input.de ?? diasAntes(ate, JANELA_PADRAO_DIAS);
    const data = await session.getData(
      'TOTVSEducacional/Aluno/Falta/Aula',
      { dataDe: at(de, 0).toISOString(), dataAte: at(ate, 23, 59, 59, 999).toISOString(), tipoFrequencia: 'A' },
      upstreamSchema,
    );

    const faltas = data.SFREQUENCIAALUNO.filter(
      (row) => input.idTurmaDisc === undefined || row.IDTURMADISC === input.idTurmaDisc,
    ).map((row) => ({
      idTurmaDisc: row.IDTURMADISC,
      codigo: row.CODDISC,
      disciplina: row.DISCIPLINA ?? null,
      subturma: row.CODSUBTURMA,
      data: row.DATAFALTA?.slice(0, 10) ?? null,
      aula: row.AULA,
      horaInicial: row.HORAINICIAL,
      horaFinal: row.HORAFINAL,
      situacao: row.SITUACAO,
      justificada: row.JUSTIFICADAPERSONALIZADO,
      abono: row.ABONAFALTAPERSONALIZADO,
      motivo: row.MOTIVOPERSONALIZADO,
      idPlanoAula: row.IDPLANOAULA ?? null,
    }));
    // Nulls last; then by time and lesson number.
    const key = (f: (typeof faltas)[number]) => `${f.data ?? '9999'} ${f.horaInicial ?? '99:99'} ${String(f.aula).padStart(6, '0')}`;
    faltas.sort((a, b) => key(a).localeCompare(key(b)));

    return { periodo: context.codPerLet, de, ate, faltas };
  },
});
