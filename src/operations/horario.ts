import { z } from 'zod';
import { codeLike, optionalCode, optionalText } from '../core/schemas.js';
import { defineOperation } from './define.js';

/** `DIASEMANA` as the portal's page reads it: `'1'` is Sunday, `'7'` Saturday (ENDPOINTS.md 4.3). */
const DIAS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'] as const;

const hora = z.string().regex(/^\d{2}:\d{2}$/);
/** `YYYY-MM-DDTHH:mm:ss` without a zone; only the date matters for a slot's validity. */
const data = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T/)
  .transform((value) => value.slice(0, 10));

/** A `DIASEMANA` `'0'` row: only a time band of the grid, every other field null. */
const faixaRowSchema = z.looseObject({
  DIASEMANA: z.literal('0'),
  HORAINICIAL: hora,
  HORAFINAL: hora,
});

const aulaRowSchema = z.looseObject({
  DIASEMANA: z.enum(['1', '2', '3', '4', '5', '6', '7']),
  HORAINICIAL: hora,
  HORAFINAL: hora,
  IDTURMADISC: z.number().int(),
  IDHORARIOTURMA: z.number().int(),
  CODDISC: codeLike,
  NOME: z.string(),
  CODTURMA: codeLike,
  CODSUBTURMA: optionalCode,
  PREDIO: optionalText,
  BLOCO: optionalText,
  SALA: optionalText,
  DATAINICIAL: data.nullish(),
  DATAFINAL: data.nullish(),
  // Always null so far; the page uses it as a link.
  URLAULAONLINE: optionalText,
});

/** Only `SHorarioAluno` is used. `SDescDisc` repeats what the slots carry (ENDPOINTS.md 4.3). */
const upstreamSchema = z.looseObject({
  SHorarioAluno: z.array(z.discriminatedUnion('DIASEMANA', [faixaRowSchema, aulaRowSchema])),
});

const faixaSchema = z.object({
  inicio: z.string().describe('Hora de início, `HH:mm`.'),
  fim: z.string().describe('Hora de fim, `HH:mm`.'),
});

const horarioSchema = z.object({
  diaSemana: z.number().int().min(1).max(7).describe('Dia da semana na numeração do portal: `1` é domingo, `2` segunda… `7` sábado.'),
  dia: z.enum(DIAS).describe('O mesmo dia por extenso, sem acento.'),
  inicio: z.string().describe('Hora de início, `HH:mm`.'),
  fim: z.string().describe('Hora de fim, `HH:mm`.'),
  idTurmaDisc: z.number().int().describe('ID da turma da disciplina. Combina com `/disciplinas` e `/notas`.'),
  idHorarioTurma: z.number().int().describe('ID deste horário na turma (`IDHORARIOTURMA`).'),
  codigo: z.string().describe('Código da disciplina (`CODDISC`).'),
  nome: z.string().describe('Nome da disciplina.'),
  turma: z.string().describe('Código da turma (`CODTURMA`).'),
  subturma: z.string().nullable().describe('Código da subturma (`CODSUBTURMA`), ou `null` quando não há.'),
  local: z.object({
    predio: z.string().nullable().describe('Prédio, como o portal envia (código e nome).'),
    bloco: z.string().nullable().describe('Bloco, como o portal envia.'),
    sala: z.string().nullable().describe('Sala, como o portal envia.'),
  }),
  vigencia: z
    .object({
      inicio: z.string().describe('Primeiro dia, `AAAA-MM-DD`.'),
      fim: z.string().describe('Último dia, `AAAA-MM-DD`.'),
    })
    .nullable()
    .describe('Período em que o horário vale, ou `null` quando o portal não manda datas.'),
  urlAulaOnline: z.string().nullable().describe('Link da aula online, quando há.'),
});

type Horario = z.output<typeof horarioSchema>;
type AulaRow = z.output<typeof aulaRowSchema>;

function toHorario(row: AulaRow): Horario {
  const diaSemana = Number(row.DIASEMANA);
  return {
    diaSemana,
    dia: DIAS[diaSemana - 1]!,
    inicio: row.HORAINICIAL,
    fim: row.HORAFINAL,
    idTurmaDisc: row.IDTURMADISC,
    idHorarioTurma: row.IDHORARIOTURMA,
    codigo: row.CODDISC,
    nome: row.NOME,
    turma: row.CODTURMA,
    subturma: row.CODSUBTURMA,
    local: { predio: row.PREDIO, bloco: row.BLOCO, sala: row.SALA },
    // The page treats a slot as modular only when both dates are set.
    vigencia: row.DATAINICIAL && row.DATAFINAL ? { inicio: row.DATAINICIAL, fim: row.DATAFINAL } : null,
    urlAulaOnline: row.URLAULAONLINE,
  };
}

/** Today in this machine's time zone, `YYYY-MM-DD`. */
function today(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export const obterHorario = defineOperation({
  id: 'obterHorario',
  method: 'get',
  path: '/horario',
  tag: 'Rotina',
  summary: 'Quadro de horário',
  description:
    'Retorna o quadro de horário semanal da matrícula que a sessão está usando: um item por aula na semana, ' +
    'em ordem de dia e hora, e as faixas de horário da grade. O período respondido vem em `periodo`.',
  callouts: [
    {
      kind: 'info',
      title: 'Horários encerrados',
      body:
        'Cada horário vale entre as datas de `vigencia`. Como a página do portal, a resposta deixa de fora ' +
        'os horários cuja vigência já terminou. Use `incluirEncerrados=true` para recebê-los também, ' +
        'como "Mostrar todos" no portal. Um horário ainda aparece no seu último dia.',
    },
    {
      kind: 'info',
      title: 'Dias da semana',
      body:
        '`diaSemana` segue a numeração do portal: `1` é domingo e `7` é sábado. ' +
        'É o `getDay()` do JavaScript mais um. `dia` traz o mesmo dia por extenso.',
    },
    {
      kind: 'info',
      title: 'Faixas',
      body:
        '`faixas` são as linhas da grade do portal, inclusive as que não têm aula nenhuma. ' +
        'Servem para desenhar o quadro; as aulas estão em `horarios`.',
    },
  ],
  upstream: ['TOTVSEducacional/QuadroHorarioAluno'],
  input: z.object({
    incluirEncerrados: z
      .boolean()
      .default(false)
      .describe('Quando `true`, inclui os horários cuja vigência já terminou, como "Mostrar todos" no portal.'),
  }),
  output: z.object({
    periodo: z.string().describe('Código do período da matrícula da sessão (ex.: `2026S2`).'),
    faixas: z.array(faixaSchema).describe('Faixas de horário da grade, em ordem, sem repetição.'),
    horarios: z.array(horarioSchema).describe('Uma entrada por aula na semana, em ordem de dia e hora de início.'),
  }),
  example: {
    periodo: '2026S2',
    faixas: [
      { inicio: '18:30', fim: '19:20' },
      { inicio: '19:20', fim: '20:10' },
    ],
    horarios: [
      {
        diaSemana: 2,
        dia: 'segunda',
        inicio: '18:30',
        fim: '19:20',
        idTurmaDisc: 48213,
        idHorarioTurma: 90121,
        codigo: 'PW2',
        nome: 'Programação Web II',
        turma: 'DS-2026-A',
        subturma: null,
        local: { predio: 'PRD1 - Prédio 1', bloco: '1 - Bloco A', sala: 'LAB3 - Laboratório 3' },
        vigencia: { inicio: '2026-08-03', fim: '2026-12-18' },
        urlAulaOnline: null,
      },
    ],
  },
  async handler(session, { incluirEncerrados }) {
    const { context } = await session.ensureSession();
    // No parameters: the portal answers for the context in the cookie, like its own page (ENDPOINTS.md 4.3).
    const { SHorarioAluno: rows } = await session.getData('TOTVSEducacional/QuadroHorarioAluno', {}, upstreamSchema);

    const faixas = new Map<string, { inicio: string; fim: string }>();
    for (const row of rows) faixas.set(`${row.HORAINICIAL}-${row.HORAFINAL}`, { inicio: row.HORAINICIAL, fim: row.HORAFINAL });

    const hoje = today();
    const horarios = rows
      .filter((row): row is AulaRow => row.DIASEMANA !== '0')
      .map(toHorario)
      .filter((horario) => incluirEncerrados || horario.vigencia === null || horario.vigencia.fim >= hoje)
      .sort((a, b) => a.diaSemana - b.diaSemana || a.inicio.localeCompare(b.inicio) || a.fim.localeCompare(b.fim));

    return {
      periodo: context.codPerLet,
      faixas: [...faixas.values()].sort((a, b) => a.inicio.localeCompare(b.inicio) || a.fim.localeCompare(b.fim)),
      horarios,
    };
  },
});
