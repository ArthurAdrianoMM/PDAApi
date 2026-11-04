/**
 * The lessons of one class, as the class page (`#/disciplina` → "Aulas") shows
 * them, and one lesson in detail (ENDPOINTS.md 4.7).
 */
import { z } from 'zod';
import { PortalError } from '../core/index.js';
import { integerLike, optionalText } from '../core/schemas.js';
import { at, diaDaSemana, DIAS, diasEntre, hoje, segundaDaSemana, somarDias } from './dates.js';
import { defineOperation } from './define.js';
import { buscarDisciplina } from './disciplinas.js';
import { periodoInput, periodoOutput } from './periodo.js';
import {
  AULA_EXEMPLO,
  arquivoRowSchema,
  aulaDetalheSchema,
  planoAulaDetalheRowSchema,
  tipoAula,
  tipoAulaSchema,
  toAulaDetalhe,
} from './plano-aula.js';

/** The longest window one call may ask for: about the 8 months the page itself was seen asking for. */
const JANELA_MAXIMA_DIAS = 240;

/** `ListaFaltas[].TipoFrequencia` of an absence; `0` rows are presences (ENDPOINTS.md 4.7). */
const AUSENCIA = 1;

const hora = z.string().regex(/^\d{2}:\d{2}$/);
const dia = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T/)
  .transform((value) => value.slice(0, 10));
const quantidade = integerLike.nullish().transform((value) => value ?? 0);

/** `AulasDisciplina/{id}` answers in PascalCase, unlike the other lesson endpoints. Types as recorded on 2026-11-03. */
const licaoSchema = z.looseObject({
  PlanoAula: z.looseObject({
    IdPlanoAula: z.number().int(),
    IdHorarioTurma: z.number().int().nullish(),
    NumAula: integerLike.nullish(),
    DataAula: dia,
    HoraInicial: hora,
    HoraFinal: hora,
    Conteudo: optionalText,
    ConteudoEfetivo: optionalText,
    LicaoCasa: optionalText,
    Observacao: optionalText,
    Confirmado: z.boolean().nullish(),
    TipoAula: optionalText,
    UrlAulaOnline: optionalText,
  }),
  Frequencia: optionalText,
});

/** One row per lesson of the day; `Aula` was always `0`, so a row is matched to its lesson by slot. */
const faltaRowSchema = z.looseObject({
  TipoFrequencia: integerLike,
  IdHorarioTurma: z.number().int().nullish(),
  HoraInicial: hora.nullish(),
  Justificada: optionalText,
  JustificativaFalta: optionalText,
  AbonoFalta: optionalText,
});

const diaRowSchema = z.looseObject({
  DataAula: dia,
  QuantidadeFaltas: quantidade,
  QuantidadeAvaliacoes: quantidade,
  QuantidadeMateriais: quantidade,
  QuantidadeOcorrencia: quantidade,
  QuantidadeLicoesDeCasa: quantidade,
  ListaDetalhesPlanoAulaPortal: z.array(licaoSchema),
  ListaFaltas: z.array(faltaRowSchema).nullish(),
});

type FaltaRow = z.output<typeof faltaRowSchema>;
type LicaoRow = z.output<typeof licaoSchema>;

const aulaDaDisciplinaSchema = z.object({
  idPlanoAula: z.number().int().describe('ID da aula. Abre o detalhe em `/disciplinas/{idTurmaDisc}/aulas/{idPlanoAula}`.'),
  idHorarioTurma: z.number().int().nullable().describe('ID do horário na turma. Combina com `/horario`.'),
  aula: z.number().int().nullable().describe('Número da aula na disciplina.'),
  inicio: z.string().describe('Hora de início, `HH:mm`.'),
  fim: z.string().describe('Hora de fim, `HH:mm`.'),
  tipo: tipoAulaSchema,
  conteudoPrevisto: z.string().nullable().describe('"Conteúdo previsto". Texto puro.'),
  conteudoEfetivo: z.string().nullable().describe('"Conteúdo efetivo", o que foi dado. Texto puro.'),
  licaoDeCasa: z.string().nullable().describe('"Lição de casa".'),
  observacao: z.string().nullable().describe('Observação do professor.'),
  confirmada: z.boolean().nullable().describe('Se o professor confirmou a aula (`Confirmado`).'),
  urlAulaOnline: z.string().nullable().describe('Link da aula online, quando há.'),
  frequencia: z
    .string()
    .nullable()
    .describe('A sua frequência na aula, como o portal escreve (`Presente`, `Ausente`), ou `null` se ainda não foi lançada.'),
  falta: z
    .object({
      justificada: z.string().nullable().describe('O texto do portal para "justificada", ou `null` quando vazio.'),
      justificativa: z.string().nullable().describe('A justificativa registrada, ou `null`.'),
      abono: z.string().nullable().describe('O texto do portal sobre abono (ex.: `Não`), ou `null`.'),
    })
    .nullable()
    .describe('Os dados da falta, quando você faltou a esta aula.'),
});

const diaSchema = z.object({
  data: z.iso.date().describe('Dia (AAAA-MM-DD).'),
  diaSemana: z.number().int().min(1).max(7).describe('Dia da semana na numeração do portal: `1` é domingo… `7` sábado.'),
  dia: z.enum(DIAS).describe('O mesmo dia por extenso, sem acento.'),
  quantidades: z
    .object({
      faltas: z.number().int(),
      avaliacoes: z.number().int(),
      materiais: z.number().int(),
      ocorrencias: z.number().int(),
      licoesDeCasa: z.number().int(),
    })
    .describe('As contagens que o portal mostra para o dia.'),
  aulas: z.array(aulaDaDisciplinaSchema).describe('As aulas do dia, em ordem de horário.'),
});

/** The absence row of a lesson, by its slot (`IdHorarioTurma`), or by start time when a slot is missing. */
function faltaDa(licao: LicaoRow, faltas: FaltaRow[]): FaltaRow | undefined {
  const { IdHorarioTurma, HoraInicial } = licao.PlanoAula;
  return faltas.find(
    (f) =>
      f.TipoFrequencia === AUSENCIA &&
      (IdHorarioTurma != null && f.IdHorarioTurma != null ? f.IdHorarioTurma === IdHorarioTurma : f.HoraInicial === HoraInicial),
  );
}

function toAulaDaDisciplina(licao: LicaoRow, faltas: FaltaRow[]): z.output<typeof aulaDaDisciplinaSchema> {
  const p = licao.PlanoAula;
  const falta = faltaDa(licao, faltas);
  return {
    idPlanoAula: p.IdPlanoAula,
    idHorarioTurma: p.IdHorarioTurma ?? null,
    aula: p.NumAula ?? null,
    inicio: p.HoraInicial,
    fim: p.HoraFinal,
    tipo: tipoAula(p.TipoAula),
    conteudoPrevisto: p.Conteudo,
    conteudoEfetivo: p.ConteudoEfetivo,
    licaoDeCasa: p.LicaoCasa,
    observacao: p.Observacao,
    confirmada: p.Confirmado ?? null,
    urlAulaOnline: p.UrlAulaOnline,
    frequencia: licao.Frequencia,
    falta: falta ? { justificada: falta.Justificada, justificativa: falta.JustificativaFalta, abono: falta.AbonoFalta } : null,
  };
}

const idTurmaDiscInput = z.number().int().positive().describe('ID da turma da disciplina, como em `/disciplinas`.');

export const listarAulasDaDisciplina = defineOperation({
  id: 'listarAulasDaDisciplina',
  method: 'get',
  path: '/disciplinas/{idTurmaDisc}/aulas',
  tag: 'Rotina',
  summary: 'Aulas de uma disciplina',
  description:
    'Lista as aulas de uma disciplina, dia a dia, numa janela de datas: conteúdo, lição de casa e a sua frequência em cada aula ' +
    '(presente ou ausente), como a aba "Aulas" da disciplina no portal. Sem datas, traz a semana atual, de segunda a domingo, ' +
    'como a página faz ao abrir.',
  callouts: [
    {
      kind: 'info',
      title: 'Só a sua subturma',
      body:
        'Numa disciplina com subturmas, o portal devolve as aulas de todas elas quando a subturma não vai na chamada. ' +
        'A API envia a sua, a mesma de `subturma` em `/disciplinas`, como a página do portal faz.',
    },
    {
      kind: 'info',
      title: 'Datas',
      body:
        `\`de\` e \`ate\` são dias inteiros. Uma chamada cobre até ${JANELA_MAXIMA_DIAS} dias. ` +
        'A disciplina precisa estar em `/disciplinas` do mesmo período; para outro período, envie `periodo`.',
    },
  ],
  upstream: ['TOTVSEducacional/DisciplinasAlunoPeriodoLetivo', 'TOTVSEducacional/AulasDisciplina/{idTurmaDisc}'],
  input: z
    .object({
      idTurmaDisc: idTurmaDiscInput,
      de: z.iso.date().optional().describe('Primeiro dia (AAAA-MM-DD). Padrão: a segunda-feira desta semana.'),
      ate: z.iso.date().optional().describe('Último dia (AAAA-MM-DD). Padrão: seis dias depois de `de`.'),
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
    idTurmaDisc: z.number().int().describe('A disciplina pedida.'),
    subturma: z.string().nullable().describe('A sua subturma nesta disciplina, que foi enviada ao portal.'),
    de: z.iso.date().describe('Primeiro dia da janela usada.'),
    ate: z.iso.date().describe('Último dia da janela usada.'),
    dias: z.array(diaSchema).describe('Os dias com aula, em ordem de data.'),
  }),
  example: {
    periodo: '2026S2',
    idTurmaDisc: 48213,
    subturma: null,
    de: '2026-11-02',
    ate: '2026-11-08',
    dias: [
      {
        data: '2026-11-03',
        diaSemana: 3,
        dia: 'terca',
        quantidades: { faltas: 1, avaliacoes: 0, materiais: 0, ocorrencias: 0, licoesDeCasa: 0 },
        aulas: [
          {
            idPlanoAula: 7310452,
            idHorarioTurma: 90121,
            aula: 21,
            inicio: '18:30',
            fim: '19:20',
            tipo: { codigo: 'P', descricao: 'Aula prática' },
            conteudoPrevisto: 'Rotas e middlewares no servidor.',
            conteudoEfetivo: null,
            licaoDeCasa: null,
            observacao: null,
            confirmada: false,
            urlAulaOnline: null,
            frequencia: 'Ausente',
            falta: { justificada: null, justificativa: null, abono: 'Não' },
          },
        ],
      },
    ],
  },
  async handler(session, input) {
    const context = await session.contextFor(input.periodo);
    const disciplina = await buscarDisciplina(session, input.idTurmaDisc, input.periodo);
    const de = input.de ?? (input.ate ? somarDias(input.ate, -6) : segundaDaSemana(hoje()));
    const ate = input.ate ?? somarDias(de, 6);

    // The page sends noon of each day, and the class ID in the path (ENDPOINTS.md 4.7).
    const dias = await session.getData(
      `TOTVSEducacional/AulasDisciplina/${disciplina.IDTURMADISC}`,
      { codSubTurma: disciplina.CODSUBTURMA ?? '', dataInicio: at(de, 12).toISOString(), dataFim: at(ate, 12).toISOString() },
      z.array(diaRowSchema),
      { periodo: input.periodo },
    );

    return {
      periodo: context.codPerLet,
      idTurmaDisc: disciplina.IDTURMADISC,
      subturma: disciplina.CODSUBTURMA,
      de,
      ate,
      dias: dias
        .map((row) => {
          const diaSemana = at(row.DataAula, 12).getDay() + 1;
          const faltas = row.ListaFaltas ?? [];
          return {
            data: row.DataAula,
            diaSemana,
            dia: diaDaSemana(diaSemana),
            quantidades: {
              faltas: row.QuantidadeFaltas,
              avaliacoes: row.QuantidadeAvaliacoes,
              materiais: row.QuantidadeMateriais,
              ocorrencias: row.QuantidadeOcorrencia,
              licoesDeCasa: row.QuantidadeLicoesDeCasa,
            },
            aulas: row.ListaDetalhesPlanoAulaPortal.map((licao) => toAulaDaDisciplina(licao, faltas)).sort(
              (a, b) => a.inicio.localeCompare(b.inicio) || (a.aula ?? 0) - (b.aula ?? 0),
            ),
          };
        })
        // The portal sends the newest day first.
        .sort((a, b) => a.data.localeCompare(b.data)),
    };
  },
});

/** `data` of `PlanoAula/Aula` (ENDPOINTS.md 4.7). */
const detalheUpstreamSchema = z.looseObject({
  SPlanoAula: z.array(planoAulaDetalheRowSchema),
  SPlanoAulaArquivo: z.array(arquivoRowSchema).nullish(),
});

export const obterAula = defineOperation({
  id: 'obterAula',
  method: 'get',
  path: '/disciplinas/{idTurmaDisc}/aulas/{idPlanoAula}',
  tag: 'Rotina',
  summary: 'Uma aula em detalhe',
  description:
    'Retorna uma aula do plano de aulas: conteúdo previsto e efetivo, lição de casa, local e, depois que ela acontece, ' +
    'quando foi dada de fato. É o detalhe que o portal abre ao clicar numa aula.',
  callouts: [
    {
      kind: 'info',
      title: 'De onde vêm os IDs',
      body:
        '`idTurmaDisc` vem de `/disciplinas` e `idPlanoAula` de `/aulas`, `/disciplinas/{idTurmaDisc}/aulas` ou `/faltas/aulas`. ' +
        'Uma aula que o portal não encontra para a disciplina responde 404 `item_inexistente`.',
    },
    {
      kind: 'warning',
      title: 'Arquivos da aula',
      body:
        'O portal tem uma lista própria de arquivos da aula (`PlanoAula/ArquivoAula`), mas ela responde 403 para esta conta, ' +
        'e a API não tenta outro caminho. `arquivos` traz só os que vêm junto com a aula.',
    },
  ],
  upstream: ['TOTVSEducacional/DisciplinasAlunoPeriodoLetivo', 'TOTVSEducacional/PlanoAula/Aula'],
  input: z.object({
    idTurmaDisc: idTurmaDiscInput,
    idPlanoAula: z.number().int().positive().describe('ID da aula, como em `/aulas`.'),
    periodo: periodoInput,
  }),
  output: z.object({ periodo: periodoOutput, aula: aulaDetalheSchema }),
  example: {
    periodo: '2026S2',
    aula: {
      ...AULA_EXEMPLO,
      realizada: { data: '2026-11-03', inicio: '18:30', fim: '19:20' },
      reposicao: false,
      professorSubstituto: false,
    },
  },
  async handler(session, input) {
    const context = await session.contextFor(input.periodo);
    const disciplina = await buscarDisciplina(session, input.idTurmaDisc, input.periodo);
    const data = await session.getData(
      'TOTVSEducacional/PlanoAula/Aula',
      { idTurmaDisc: disciplina.IDTURMADISC, idPlanoAula: input.idPlanoAula },
      detalheUpstreamSchema,
      { periodo: input.periodo },
    );
    const row = data.SPlanoAula.find((r) => r.IDPLANOAULA === input.idPlanoAula);
    if (!row) {
      throw new PortalError('item_inexistente', `O portal não encontrou a aula ${input.idPlanoAula} na disciplina ${input.idTurmaDisc}.`);
    }
    return { periodo: context.codPerLet, aula: toAulaDetalhe(row, data.SPlanoAulaArquivo ?? []) };
  },
});

