import { z } from 'zod';
import type { PortalSession } from '../core/index.js';
import { at, diasEntre, hoje } from './dates.js';
import { defineOperation } from './define.js';
import { lerDisciplinas } from './disciplinas.js';
import { periodoInput, periodoOutput } from './periodo.js';
import { AULA_EXEMPLO, arquivoRowSchema, aulaSchema, planoAulaRowSchema, toAula, type PlanoAulaRow } from './plano-aula.js';
import { subturmasPorHorario } from './subturmas.js';

/** The longest window one call may ask for. The page asks for one day; a month was checked on 2026-11-03. */
const JANELA_MAXIMA_DIAS = 31;

/** `data` of `v1/planoaulas/aulas` (ENDPOINTS.md 4.8). */
const upstreamSchema = z.looseObject({
  SPlanoAula: z.array(planoAulaRowSchema),
  SPLANOAULAARQUIVO: z.array(arquivoRowSchema).nullish(),
});

/**
 * The subclass of each lesson, and whether it is the student's. Only classes
 * where the student has a subclass are looked up, one request each; the other
 * lessons are all the student's.
 */
async function subturmasDasAulas(session: PortalSession, rows: PlanoAulaRow[], periodo: string | undefined) {
  const turmas = new Set(rows.map((row) => row.IDTURMADISC));
  const suas = new Map<number, string>();
  if (turmas.size > 0) {
    for (const disciplina of await lerDisciplinas(session, { periodo })) {
      if (disciplina.CODSUBTURMA && turmas.has(disciplina.IDTURMADISC)) suas.set(disciplina.IDTURMADISC, disciplina.CODSUBTURMA);
    }
  }
  const porHorario = new Map<number, Map<number, string | null>>();
  for (const idTurmaDisc of suas.keys()) porHorario.set(idTurmaDisc, await subturmasPorHorario(session, idTurmaDisc, periodo));

  return (row: PlanoAulaRow): { aula: string | null; sua: boolean } => {
    const sua = suas.get(row.IDTURMADISC);
    if (sua === undefined) return { aula: row.CODSUBTURMA, sua: true };
    const daAula = row.IDHORARIOTURMA == null ? undefined : porHorario.get(row.IDTURMADISC)?.get(row.IDHORARIOTURMA);
    // A slot the class info doesn't list is kept: there is no way to tell it isn't the student's.
    return daAula === undefined ? { aula: sua, sua: true } : { aula: daAula, sua: daAula === sua };
  };
}

export const listarAulas = defineOperation({
  id: 'listarAulas',
  method: 'get',
  path: '/aulas',
  tag: 'Rotina',
  summary: 'Aulas por dia',
  description:
    'Lista as aulas do plano de aulas num dia ou numa janela de dias, de todas as disciplinas: horário, ' +
    'conteúdo previsto e efetivo, lição de casa e local. Sem datas, traz as aulas de hoje, como a página ' +
    '"Plano de aula" do portal. Os itens vêm em ordem de data e horário.',
  callouts: [
    {
      kind: 'info',
      title: 'Datas',
      body:
        '`de` e `ate` são dias inteiros. Sem nenhum dos dois, a janela é hoje; com só um, é aquele dia. ' +
        `Uma chamada cobre até ${JANELA_MAXIMA_DIAS} dias. \`idTurmaDisc\` filtra aqui, depois da resposta, como a página do portal faz.`,
    },
    {
      kind: 'info',
      title: 'Feriados e dias sem aula',
      body: 'Um dia sem aula no plano, como um feriado, simplesmente não aparece na lista.',
    },
    {
      kind: 'info',
      title: 'Só a sua subturma',
      body:
        'Numa disciplina com subturmas, o portal lista as aulas de todas elas, sem dizer de qual é cada uma. ' +
        'A API descobre a subturma de cada aula pelo horário e deixa só as da sua, a mesma de `subturma` em `/disciplinas`. ' +
        'Com `incluirOutrasSubturmas=true`, vêm todas, como na página do portal, cada uma com a sua `subturma`.',
    },
    {
      kind: 'info',
      title: 'Uma aula em detalhe',
      body: '`idPlanoAula` e `idTurmaDisc` abrem a aula em `/disciplinas/{idTurmaDisc}/aulas/{idPlanoAula}`.',
    },
  ],
  upstream: [
    'TOTVSEducacional/v1/planoaulas/aulas',
    'TOTVSEducacional/DisciplinasAlunoPeriodoLetivo',
    'TOTVSEducacional/MatriculaDisciplinaPorHabilitacaoFilialTurmaDisc',
  ],
  input: z
    .object({
      de: z.iso.date().optional().describe('Primeiro dia (AAAA-MM-DD). Padrão: `ate`, ou hoje.'),
      ate: z.iso.date().optional().describe('Último dia (AAAA-MM-DD). Padrão: `de`.'),
      idTurmaDisc: z.number().int().positive().optional().describe('Só as aulas desta disciplina.'),
      incluirOutrasSubturmas: z
        .boolean()
        .default(false)
        .describe('Quando `true`, inclui as aulas das outras subturmas das suas disciplinas, como a página do portal mostra.'),
      periodo: periodoInput,
    })
    .refine(({ de, ate }) => de === undefined || ate === undefined || de <= ate, {
      path: ['de'],
      message: '`de` precisa ser igual ou anterior a `ate`.',
    })
    .refine(({ de, ate }) => de === undefined || ate === undefined || diasEntre(de, ate) <= JANELA_MAXIMA_DIAS, {
      path: ['ate'],
      message: `A janela pode ter até ${JANELA_MAXIMA_DIAS} dias.`,
    }),
  output: z.object({
    periodo: periodoOutput,
    de: z.iso.date().describe('Primeiro dia da janela usada.'),
    ate: z.iso.date().describe('Último dia da janela usada.'),
    aulas: z.array(aulaSchema),
  }),
  example: { periodo: '2026S2', de: '2026-11-03', ate: '2026-11-03', aulas: [AULA_EXEMPLO] },
  async handler(session, input) {
    const context = await session.contextFor(input.periodo);
    const de = input.de ?? input.ate ?? hoje();
    const ate = input.ate ?? de;
    // The page sends an instant on the chosen day; the portal reads it as a local date. Noon keeps the day in any nearby zone.
    const data = await session.getData(
      'TOTVSEducacional/v1/planoaulas/aulas',
      { dtInicial: at(de, 12).toISOString(), dtFinal: at(ate, 12).toISOString(), orderby: 'HORAINICIAL' },
      upstreamSchema,
      { periodo: input.periodo, contextParam: 'idContextoAluno' },
    );

    const rows = data.SPlanoAula.filter((row) => input.idTurmaDisc === undefined || row.IDTURMADISC === input.idTurmaDisc);
    const subturmaDe = await subturmasDasAulas(session, rows, input.periodo);
    const arquivos = data.SPLANOAULAARQUIVO ?? [];

    const aulas = rows
      .flatMap((row) => {
        const { aula: subturma, sua } = subturmaDe(row);
        return sua || input.incluirOutrasSubturmas ? [{ ...toAula(row, arquivos), subturma }] : [];
      })
      .sort((a, b) => a.data.localeCompare(b.data) || a.inicio.localeCompare(b.inicio) || (a.aula ?? 0) - (b.aula ?? 0));

    return { periodo: context.codPerLet, de, ate, aulas };
  },
});
