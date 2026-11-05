/**
 * Made-up answers of the per-class lesson endpoints, in the shapes recorded on
 * 2026-11-03 (ENDPOINTS.md 4.7). Shared by the operation tests and the fake server.
 */

const licao = (numAula: number, idHorarioTurma: number, data: string, inicio: string, fim: string, extra: Record<string, unknown> = {}) => ({
  PlanoAula: {
    CodColigada: 1,
    IdTurmaDisc: 48213,
    NumAula: numAula,
    IdHorarioTurma: idHorarioTurma,
    CodFilial: 1,
    CodPredio: '',
    CodBloco: '',
    CodSala: '',
    CodProf: '',
    CodHorario: 3,
    DataAula: `${data}T00:00:00`,
    HoraInicial: inicio,
    HoraFinal: fim,
    Conteudo: 'Rotas e middlewares no servidor.',
    Locacao: '',
    ConteudoEfetivo: '',
    DataEfetiva: null,
    Reposicao: null,
    Substituto: null,
    PagamentoProf: null,
    TipoFalta: null,
    LicaoCasa: '',
    TipoOperacao: 0,
    Observacao: '',
    Confirmado: false,
    IdPlanoAula: 7310000 + numAula,
    TipoAula: 'P',
    MaxAlunosValidacao: null,
    FrequenciaDispWeb: '1',
    UrlAulaOnline: '',
    InternalId: null,
    ...extra,
  },
  Horario: { CodColigada: 1, IdTurmaDisc: 48213, IdHorarioTurma: idHorarioTurma, DiaSemana: 3, HoraInicial: inicio, HoraFinal: fim, InternalId: null },
  Frequencia: 'Presente',
  QuantidadeMateriais: null,
  InternalId: null,
});

/** `ListaFaltas` has one row per lesson; `Aula` is always 0, `TipoFrequencia` 1 is an absence. */
const frequencia = (idHorarioTurma: number, data: string, inicio: string, fim: string, ausente: boolean) => ({
  $id: '1',
  CodColigada: 1,
  IdHorarioTurma: idHorarioTurma,
  IdTurmaDisc: 48213,
  RA: null,
  Data: `${data}T00:00:00`,
  TipoFrequencia: ausente ? 1 : 0,
  Aula: 0,
  Justificada: '',
  JustificativaFalta: '',
  AbonoFalta: ausente ? 'Não' : '',
  HoraInicial: inicio,
  HoraFinal: fim,
  CodTurma: null,
  CodEtapa: null,
  InternalId: null,
});

const dia = (data: string, faltas: number, licoes: unknown[], frequencias: unknown[]) => ({
  ListaDetalhesPlanoAulaPortal: licoes,
  ListaMateriais: [],
  ListaFaltas: frequencias,
  CodColigada: 1,
  IdTurmaDisc: 48213,
  DataAula: `${data}T00:00:00`,
  QuantidadeFaltas: faltas,
  QuantidadeAvaliacoes: 0,
  QuantidadeMateriais: 0,
  QuantidadeOcorrencia: 0,
  QuantidadeLicoesDeCasa: 0,
  InternalId: null,
});

/** `AulasDisciplina/48213`, newest day first as the portal sends it. The 2026-11-05 lessons haven't happened yet. */
export const AULAS_DISCIPLINA = [
  dia(
    '2026-11-05',
    0,
    [
      { ...licao(24, 90124, '2026-11-05', '19:20', '20:10', { Conteudo: '', TipoAula: '' }), Frequencia: null },
      { ...licao(23, 90123, '2026-11-05', '18:30', '19:20', { Conteudo: '', TipoAula: '' }), Frequencia: null },
    ],
    [],
  ),
  dia(
    '2026-11-03',
    1,
    [
      licao(21, 90121, '2026-11-03', '18:30', '19:20', { ConteudoEfetivo: 'Rotas, middlewares e erros.' }),
      { ...licao(22, 90122, '2026-11-03', '19:20', '20:10'), Frequencia: 'Ausente' },
    ],
    [frequencia(90121, '2026-11-03', '18:30', '19:20', false), frequencia(90122, '2026-11-03', '19:20', '20:10', true)],
  ),
];

/** `PlanoAula/Aula` for lesson 7310021 of class 48213. */
export const PLANO_AULA = {
  SPlanoAula: [
    {
      CODCOLIGADA: 1, IDTURMADISC: 48213, AULA: 21, IDHORARIOTURMA: 90121, CODFILIAL: 1, CODPREDIO: null, CODSALA: null, CODPROF: null, CODHOR: 3,
      DATA: '2026-11-03T00:00:00', CONTEUDO: 'Rotas e middlewares no servidor.', LOCACAO: null, CONTEUDOEFETIVO: 'Rotas, middlewares e erros.',
      DATAEFETIVA: '2026-11-03T00:00:00', REPOSICAO: 'N', SUBSTITUTO: 'N', PAGAMENTOPROF: null, HORAINICIAL: '18:30',
      HORAINICIALREALIZADO: '18:30', HORAFINALREALIZADO: '19:20', HORAFINAL: '19:20', CODTURMA: 'DS-2026-A', CODDISC: 'PW2',
      NOMEDISC: 'Programação Web II', TIPOFALTA: null, CODBLOCO: null, FREQUENCIADISPWEB: null, DIASEMANA: '3', CODSUBTURMA: '',
      LICAOCASA: null, OBSERVACAO: null, CONFIRMADO: 'N', IDPLANOAULA: 7310021, TIPOAULA: 'P', IDPERLET: 1042, PREDIO: null, BLOCO: null,
      SALA: null, URLAULAONLINE: null, CODTURNO: 3,
    },
  ],
  SPlanoAulaArquivo: [],
};
