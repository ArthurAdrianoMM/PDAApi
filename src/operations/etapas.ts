import { z } from 'zod';
import { integerLike, optionalDecimal, optionalText } from '../core/schemas.js';
import { defineOperation } from './define.js';
import { buscarDisciplina } from './disciplinas.js';
import { periodoInput, periodoOutput } from './periodo.js';
import { simNao } from './plano-aula.js';

/** `tipoEtapaTurmaDisc` / `TIPOETAPA` (`eduEnumsConsts.TipoEtapa`). */
const TIPOS = { nota: 'N', falta: 'F' } as const;
type Tipo = keyof typeof TIPOS;

const dia = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}/)
  .nullish()
  .transform((value) => value?.slice(0, 10) ?? null);

/** `EtapasTurmaDisc` rows (ENDPOINTS.md 4.7). Types as recorded on 2026-11-03. */
const upstreamSchema = z.array(
  z.looseObject({
    CODETAPA: z.number().int(),
    TIPOETAPA: z.enum(['N', 'F']),
    DESCRICAO: z.string(),
    PONTDIST: optionalDecimal,
    MEDIA: optionalDecimal,
    FREQMIN: optionalDecimal,
    AULASDADAS: integerLike.nullish(),
    AULASPREVISTAS: integerLike.nullish(),
    DTINICIO: dia,
    DTFIM: dia,
    DTINICIODIGITACAO: dia,
    DTLIMITEDIGITACAO: dia,
    ETAPAENCERRADA: optionalText,
    ETAPAFINAL: optionalText,
    DISPONIVELALUNOS: optionalText,
  }),
);

const etapaSchema = z.object({
  codigo: z.number().int().describe('`CODETAPA`. É o `etapa` de `/notas` e de `/faltas`.'),
  tipo: z.enum(['nota', 'falta']).describe('Etapa de notas ou de faltas (`TIPOETAPA` `N` ou `F`).'),
  nome: z.string().describe('Nome da etapa, como em `/notas` e `/faltas` (ex.: `AV 1 / AV QT 1`, `Faltas`).'),
  pontosDistribuidos: z.number().nullable().describe('Pontos que a etapa vale (`PONTDIST`), nas etapas de nota.'),
  media: z.number().nullable().describe('Média da etapa (`MEDIA`), quando a escola define.'),
  frequenciaMinima: z.number().nullable().describe('Frequência mínima para aprovação, em % (`FREQMIN`), nas etapas de falta.'),
  aulasDadas: z.number().int().nullable().describe('Aulas dadas até agora (`AULASDADAS`), nas etapas de falta.'),
  aulasPrevistas: z.number().int().nullable().describe('Aulas previstas (`AULASPREVISTAS`), quando a escola informa.'),
  inicio: z.iso.date().nullable().describe('Início da etapa.'),
  fim: z.iso.date().nullable().describe('Fim da etapa.'),
  lancamento: z
    .object({
      inicio: z.iso.date().nullable().describe('Primeiro dia em que o professor pode lançar (`DTINICIODIGITACAO`).'),
      limite: z.iso.date().nullable().describe('Último dia para lançar (`DTLIMITEDIGITACAO`).'),
    })
    .describe('O prazo de lançamento de notas ou faltas pelo professor.'),
  encerrada: z.boolean().nullable().describe('Se a etapa foi encerrada (`ETAPAENCERRADA`).'),
  final: z.boolean().nullable().describe('Se é a etapa final (`ETAPAFINAL`).'),
  disponivelParaAlunos: z.boolean().nullable().describe('Se o portal mostra a etapa aos alunos (`DISPONIVELALUNOS`).'),
});

export const listarEtapasDaDisciplina = defineOperation({
  id: 'listarEtapasDaDisciplina',
  method: 'get',
  path: '/disciplinas/{idTurmaDisc}/etapas',
  tag: 'Desempenho',
  summary: 'Etapas de uma disciplina',
  description:
    'Lista as etapas de avaliação de uma disciplina: as de nota, com os pontos que cada uma vale, e as de falta, ' +
    'com a frequência mínima e as aulas dadas até agora. Os números de etapa são os mesmos de `/notas` e `/faltas`.',
  callouts: [
    {
      kind: 'info',
      title: 'Frequência mínima e percentual de faltas',
      body:
        '`frequenciaMinima` é a frequência que a disciplina exige, em %. O `percentual` de `/faltas` conta as faltas sobre o total ' +
        'de aulas da disciplina, não sobre `aulasDadas`: na conta testada, os dois só coincidiram nas disciplinas já terminadas. ' +
        'O portal não informa esse total (`aulasPrevistas` veio `null`), então a API não calcula quantas faltas ainda cabem.',
    },
    {
      kind: 'warning',
      title: 'Nem toda etapa de `/notas` está aqui',
      body:
        'Na conta testada, `/notas` trouxe uma etapa de nota que esta lista não tinha, e uma disciplina sem nenhuma etapa de nota aqui ' +
        'também não apareceu em `/notas`. Use esta lista para os pesos e prazos, e `/notas` para as notas.',
    },
  ],
  upstream: ['TOTVSEducacional/DisciplinasAlunoPeriodoLetivo', 'TOTVSEducacional/EtapasTurmaDisc'],
  input: z.object({
    idTurmaDisc: z.number().int().positive().describe('ID da turma da disciplina, como em `/disciplinas`.'),
    tipo: z.enum(['nota', 'falta']).optional().describe('Só as etapas deste tipo. Sem ele, vêm as duas.'),
    periodo: periodoInput,
  }),
  output: z.object({
    periodo: periodoOutput,
    idTurmaDisc: z.number().int().describe('A disciplina pedida.'),
    etapas: z.array(etapaSchema).describe('As etapas de nota e depois as de falta, cada grupo em ordem de etapa.'),
  }),
  example: {
    periodo: '2026S2',
    idTurmaDisc: 48213,
    etapas: [
      {
        codigo: 1,
        tipo: 'nota',
        nome: 'AV 1 / AV QT 1',
        pontosDistribuidos: 10,
        media: null,
        frequenciaMinima: null,
        aulasDadas: null,
        aulasPrevistas: null,
        inicio: null,
        fim: null,
        lancamento: { inicio: '2026-08-03', limite: '2026-12-18' },
        encerrada: false,
        final: null,
        disponivelParaAlunos: true,
      },
      {
        codigo: 0,
        tipo: 'falta',
        nome: 'Faltas',
        pontosDistribuidos: null,
        media: null,
        frequenciaMinima: 75,
        aulasDadas: 38,
        aulasPrevistas: null,
        inicio: '2026-08-03',
        fim: '2026-12-18',
        lancamento: { inicio: '2026-08-03', limite: '2026-12-18' },
        encerrada: false,
        final: true,
        disponivelParaAlunos: true,
      },
    ],
  },
  async handler(session, { idTurmaDisc, tipo, periodo }) {
    const context = await session.contextFor(periodo);
    const disciplina = await buscarDisciplina(session, idTurmaDisc, periodo);
    const tipos: Tipo[] = tipo ? [tipo] : ['nota', 'falta'];

    const etapas = [];
    for (const t of tipos) {
      const rows = await session.getData(
        'TOTVSEducacional/EtapasTurmaDisc',
        { idTurmaDisc: disciplina.IDTURMADISC, tipoEtapaTurmaDisc: TIPOS[t] },
        upstreamSchema,
        { periodo },
      );
      const doTipo = rows
        .filter((row) => row.TIPOETAPA === TIPOS[t])
        .map((row) => ({
          codigo: row.CODETAPA,
          tipo: t,
          nome: row.DESCRICAO,
          pontosDistribuidos: row.PONTDIST,
          media: row.MEDIA,
          frequenciaMinima: row.FREQMIN,
          aulasDadas: row.AULASDADAS ?? null,
          aulasPrevistas: row.AULASPREVISTAS ?? null,
          inicio: row.DTINICIO,
          fim: row.DTFIM,
          lancamento: { inicio: row.DTINICIODIGITACAO, limite: row.DTLIMITEDIGITACAO },
          encerrada: simNao(row.ETAPAENCERRADA),
          final: simNao(row.ETAPAFINAL),
          disponivelParaAlunos: simNao(row.DISPONIVELALUNOS),
        }))
        .sort((a, b) => a.codigo - b.codigo);
      etapas.push(...doTipo);
    }

    return { periodo: context.codPerLet, idTurmaDisc: disciplina.IDTURMADISC, etapas };
  },
});
