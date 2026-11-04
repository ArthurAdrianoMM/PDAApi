import { z } from 'zod';
import { at, diasEntre, hoje } from './dates.js';
import { defineOperation } from './define.js';
import { periodoInput, periodoOutput } from './periodo.js';
import { AULA_EXEMPLO, arquivoRowSchema, aulaSchema, planoAulaRowSchema, toAula } from './plano-aula.js';

/** The longest window one call may ask for. The page asks for one day; a month was checked on 2026-11-03. */
const JANELA_MAXIMA_DIAS = 31;

/** `data` of `v1/planoaulas/aulas` (ENDPOINTS.md 4.8). */
const upstreamSchema = z.looseObject({
  SPlanoAula: z.array(planoAulaRowSchema),
  SPLANOAULAARQUIVO: z.array(arquivoRowSchema).nullish(),
});

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
      title: 'Uma aula em detalhe',
      body: '`idPlanoAula` e `idTurmaDisc` abrem a aula em `/disciplinas/{idTurmaDisc}/aulas/{idPlanoAula}`.',
    },
  ],
  upstream: ['TOTVSEducacional/v1/planoaulas/aulas'],
  input: z
    .object({
      de: z.iso.date().optional().describe('Primeiro dia (AAAA-MM-DD). Padrão: `ate`, ou hoje.'),
      ate: z.iso.date().optional().describe('Último dia (AAAA-MM-DD). Padrão: `de`.'),
      idTurmaDisc: z.number().int().positive().optional().describe('Só as aulas desta disciplina.'),
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

    const arquivos = data.SPLANOAULAARQUIVO ?? [];
    const aulas = data.SPlanoAula.filter((row) => input.idTurmaDisc === undefined || row.IDTURMADISC === input.idTurmaDisc)
      .map((row) => toAula(row, arquivos))
      .sort((a, b) => a.data.localeCompare(b.data) || a.inicio.localeCompare(b.inicio) || (a.aula ?? 0) - (b.aula ?? 0));

    return { periodo: context.codPerLet, de, ate, aulas };
  },
});
