/**
 * The in-memory fake portal (test/support) with made-up data for every
 * operation, for the dev servers: `dev:fake` (HTTP) and `dev:mcp:fake` (MCP).
 * The fake ignores most filters and answers the same rows.
 */
import { AULAS_DISCIPLINA, PLANO_AULA } from '../test/fixtures/aulas-disciplina.js';
import { CALENDARIO } from '../test/fixtures/calendario.js';
import { AVALIACOES_INSTITUCIONAIS, INFORMACOES_PESSOAIS } from '../test/fixtures/conta.js';
import { ETAPAS_FALTA, ETAPAS_NOTA } from '../test/fixtures/etapas.js';
import { MATERIAIS_DISCIPLINA, MATERIAIS_INSTITUCIONAIS, downloadResponse } from '../test/fixtures/materiais.js';
import { GRADE_CURRICULAR } from '../test/fixtures/grade-curricular.js';
import { CONTEXTS, contextRoute, createFakePortal } from '../test/support/fake-portal.js';

/** An academic route that answers the same for every enrollment, so `periodo` works. */
const academic = (data: unknown) => contextRoute(Object.fromEntries(CONTEXTS.map((c) => [c.IDCONTEXTOALUNO, data])));

/** The fake portal with made-up data for every operation. */
export function createDemoPortal() {
  return createFakePortal({
    routes: {
      'TOTVSEducacional/Periodos': academic([
        { CODPERLET: '2026S2', IDPERLET: 1042 },
        { CODPERLET: '2026S1', IDPERLET: 1017 },
        { CODPERLET: '2025S2', IDPERLET: 988 },
      ]),
      'TOTVSEducacional/DisciplinasAlunoPeriodoLetivo': academic([
        { IDTURMADISC: 48213, CODDISC: 'PW2', NOME: 'Programação Web II', CODTURMA: 'DS-2026-A', CODSUBTURMA: '', IDPERLET: 1042, CODSTATUS: 1, DESCRICAO: 'Cursando' },
        { IDTURMADISC: 48230, CODDISC: 'BD1', NOME: 'Banco de Dados I', CODTURMA: 'DS-2026-A', CODSUBTURMA: 'SUBTURMA C', IDPERLET: 1042, CODSTATUS: 1, DESCRICAO: 'Cursando' },
      ]),
      'TOTVSEducacional/NotaEtapa': academic({
        Notas: [
          { IDTURMADISC: 48213, CODDISC: 'PW2', DISCIPLINA: 'Programação Web II', CODTURMA: 'DS-2026-A', SITUACAO: 'Cursando', '1 - AV 1 / AV QT 1': '8,5', '2 - AV 2 / AV QT 2': null },
          { IDTURMADISC: 48230, CODDISC: 'BD1', DISCIPLINA: 'Banco de Dados I', CODTURMA: 'DS-2026-A', SITUACAO: 'Cursando', '1 - AV 1 / AV QT 1': '7', '2 - AV 2 / AV QT 2': 'A' },
        ],
      }),
      'TOTVSEducacional/FaltaEtapa': academic({
        FaltasEtapa: [
          { Filial: 'Unidade Exemplo', CODTURMA: 'DS-2026-A', CODDISC: 'PW2', Disciplina: 'Programação Web II', 'Situação': 'Matriculado', '0 - Faltas': '2', PERCENTUAL: 2.78, IDTURMADISC: 48213, SITUACAOFALTAS: 1 },
          { Filial: 'Unidade Exemplo', CODTURMA: 'DS-2026-A', CODDISC: 'BD1', Disciplina: 'Banco de Dados I', 'Situação': 'Matriculado', '0 - Faltas': '1', PERCENTUAL: 1.39, IDTURMADISC: 48230, SITUACAOFALTAS: 1 },
        ],
      }),
      // The fake ignores dataDe/dataAte and always answers with these rows.
      'TOTVSEducacional/Aluno/Falta/Aula': academic({
        SFREQUENCIAALUNO: [
          { CODCOLIGADA: 1, IDTURMADISC: 48213, IDPLANOAULA: 7310451, IDHORARIOTURMA: 912, AULA: 20, CODDISC: 'PW2', DISCIPLINA: 'Programação Web II', DATAFALTA: '2026-09-14T00:00:00', DATA: '2026-09-14T00:00:00', HORAINICIAL: '19:00', HORAFINAL: '19:50', JUSTIFICADAPERSONALIZADO: 'Não', ABONAFALTAPERSONALIZADO: '', MOTIVOPERSONALIZADO: null, COMPOETOTALFALTAS: null, PRESENCA: 'A', JUSTIFICADA: null, CODSUBTURMA: null, SITUACAO: 'Não justificada' },
          { CODCOLIGADA: 1, IDTURMADISC: 48213, IDPLANOAULA: 7310452, IDHORARIOTURMA: 912, AULA: 21, CODDISC: 'PW2', DISCIPLINA: 'Programação Web II', DATAFALTA: '2026-09-14T00:00:00', DATA: '2026-09-14T00:00:00', HORAINICIAL: '19:50', HORAFINAL: '20:40', JUSTIFICADAPERSONALIZADO: 'Não', ABONAFALTAPERSONALIZADO: '', MOTIVOPERSONALIZADO: null, COMPOETOTALFALTAS: null, PRESENCA: 'A', JUSTIFICADA: null, CODSUBTURMA: null, SITUACAO: 'Não justificada' },
          { CODCOLIGADA: 1, IDTURMADISC: 48230, IDPLANOAULA: 7311807, IDHORARIOTURMA: 915, AULA: 3, CODDISC: 'BD1', DISCIPLINA: 'Banco de Dados I', DATAFALTA: '2026-08-03T00:00:00', DATA: '2026-08-03T00:00:00', HORAINICIAL: '20:40', HORAFINAL: '21:30', JUSTIFICADAPERSONALIZADO: 'Não', ABONAFALTAPERSONALIZADO: '', MOTIVOPERSONALIZADO: null, COMPOETOTALFALTAS: null, PRESENCA: 'A', JUSTIFICADA: null, CODSUBTURMA: 'SUBTURMA C', SITUACAO: 'Não justificada' },
        ],
      }),
      'TOTVSEducacional/QuadroHorarioAluno': academic({
        SQuadroHorarioAluno: [],
        SHorarioAluno: [
          { DIASEMANA: '0', HORAINICIAL: '18:30', HORAFINAL: '19:20', IDTURMADISC: null, NOME: null, DATAINICIAL: null, DATAFINAL: null },
          { DIASEMANA: '0', HORAINICIAL: '19:20', HORAFINAL: '20:10', IDTURMADISC: null, NOME: null, DATAINICIAL: null, DATAFINAL: null },
          { DIASEMANA: '0', HORAINICIAL: '20:20', HORAFINAL: '21:10', IDTURMADISC: null, NOME: null, DATAINICIAL: null, DATAFINAL: null },
          { DIASEMANA: '2', HORAINICIAL: '18:30', HORAFINAL: '19:20', IDTURMADISC: 48213, IDHORARIOTURMA: 90121, CODDISC: 'PW2', NOME: 'Programação Web II', CODTURMA: 'DS-2026-A', CODSUBTURMA: null, PREDIO: 'PRD1 - Prédio 1', BLOCO: '1 - Bloco A', SALA: 'LAB3 - Laboratório 3', DATAINICIAL: '2026-08-03T00:00:00', DATAFINAL: '2026-12-18T00:00:00', URLAULAONLINE: null },
          { DIASEMANA: '2', HORAINICIAL: '19:20', HORAFINAL: '20:10', IDTURMADISC: 48213, IDHORARIOTURMA: 90122, CODDISC: 'PW2', NOME: 'Programação Web II', CODTURMA: 'DS-2026-A', CODSUBTURMA: null, PREDIO: 'PRD1 - Prédio 1', BLOCO: '1 - Bloco A', SALA: 'LAB3 - Laboratório 3', DATAINICIAL: '2026-08-03T00:00:00', DATAFINAL: '2026-12-18T00:00:00', URLAULAONLINE: null },
          { DIASEMANA: '4', HORAINICIAL: '18:30', HORAFINAL: '19:20', IDTURMADISC: 48230, IDHORARIOTURMA: 90140, CODDISC: 'BD1', NOME: 'Banco de Dados I', CODTURMA: 'DS-2026-A', CODSUBTURMA: 'SUBTURMA C', PREDIO: null, BLOCO: null, SALA: null, DATAINICIAL: '2026-08-03T00:00:00', DATAFINAL: '2026-12-18T00:00:00', URLAULAONLINE: null },
          { DIASEMANA: '6', HORAINICIAL: '20:20', HORAFINAL: '21:10', IDTURMADISC: 48230, IDHORARIOTURMA: 90141, CODDISC: 'BD1', NOME: 'Banco de Dados I', CODTURMA: 'DS-2026-A', CODSUBTURMA: 'SUBTURMA C', PREDIO: 'PRD1 - Prédio 1', BLOCO: '2 - Bloco B', SALA: 'S12 - Sala 12', DATAINICIAL: '2026-08-03T00:00:00', DATAFINAL: '2026-09-30T00:00:00', URLAULAONLINE: null },
        ],
        SDescDisc: [],
        SQuadroHorarioAulaOnline: [],
      }),
      'TOTVSEducacional/GradeCurricular/EnsinoSuperior': academic(GRADE_CURRICULAR),
      'TOTVSEducacional/Aluno/CalendarioAluno': academic(CALENDARIO),
      'TOTVSEducacional/Aluno/InformacoesPessoaisBasicas': academic(INFORMACOES_PESSOAIS),
      'TOTVSEducacional/AvaliacoesInstitucionais': academic(AVALIACOES_INSTITUCIONAIS),
      'TOTVSEducacional/Material/Institucional': academic(MATERIAIS_INSTITUCIONAIS),
      'TOTVSEducacional/Material': academic([]),
      'TOTVSEducacional/MateriaisTurmaDisciplina': academic(MATERIAIS_DISCIPLINA),
      // Every download is the same made-up PDF header.
      'TOTVSEducacional/Material/Download': () => downloadResponse(),
      'TOTVSEducacional/EtapasTurmaDisc': (req) => academic(req.url.searchParams.get('tipoEtapaTurmaDisc') === 'F' ? ETAPAS_FALTA : ETAPAS_NOTA)(req),
      // The fake ignores the window and the lesson asked for.
      'TOTVSEducacional/AulasDisciplina/48213': academic(AULAS_DISCIPLINA),
      'TOTVSEducacional/AulasDisciplina/48230': academic([]),
      'TOTVSEducacional/PlanoAula/Aula': academic(PLANO_AULA),
      // Only the slots matter here: /aulas reads which subclass each one is.
      'TOTVSEducacional/MatriculaDisciplinaPorHabilitacaoFilialTurmaDisc': academic({
        DisciplinaInfo: [],
        HorariosTurmaDiscInfo: [
          { IDHORARIOTURMA: 90140, CODSUBTURMA: 'SUBTURMA C' },
          { IDHORARIOTURMA: 90141, CODSUBTURMA: 'SUBTURMA C' },
        ],
        ProfessorTurmaDiscInfo: [],
      }),
      // The fake ignores dtInicial/dtFinal and always answers with these lessons.
      'TOTVSEducacional/v1/planoaulas/aulas': academic({
        SPlanoAula: [
          { IDHORARIOTURMA: 90121, DIASEMANA: 2, HORAINICIAL: '18:30', HORAFINAL: '19:20', PREDIO: 'PRD1 - Prédio 1', BLOCO: '1 - Bloco A', SALA: 'LAB3 - Laboratório 3', DATA: '2026-11-09T00:00:00', AULA: 23, IDTURMADISC: 48213, CONTEUDO: 'Rotas e middlewares no servidor.', CONTEUDOEFETIVO: 'Rotas, middlewares e tratamento de erros.', LICAOCASA: 'Terminar o exercício 3.', CODTURMA: 'DS-2026-A', CODDISC: 'PW2', NOMEDISC: 'Programação Web II', CODSUBTURMA: '', CONFIRMADO: 'N', IDPLANOAULA: 7310460, TIPOAULA: 'P', URLAULAONLINE: null, OBSERVACAO: null },
          { IDHORARIOTURMA: 90122, DIASEMANA: 2, HORAINICIAL: '19:20', HORAFINAL: '20:10', PREDIO: 'PRD1 - Prédio 1', BLOCO: '1 - Bloco A', SALA: 'LAB3 - Laboratório 3', DATA: '2026-11-09T00:00:00', AULA: 24, IDTURMADISC: 48213, CONTEUDO: 'Rotas e middlewares no servidor.', CONTEUDOEFETIVO: null, LICAOCASA: '', CODTURMA: 'DS-2026-A', CODDISC: 'PW2', NOMEDISC: 'Programação Web II', CODSUBTURMA: '', CONFIRMADO: 'N', IDPLANOAULA: 7310461, TIPOAULA: 'P', URLAULAONLINE: null, OBSERVACAO: null },
          { IDHORARIOTURMA: 90140, DIASEMANA: 4, HORAINICIAL: '18:30', HORAFINAL: '19:20', PREDIO: null, BLOCO: null, SALA: null, DATA: '2026-11-11T00:00:00', AULA: 12, IDTURMADISC: 48230, CONTEUDO: 'Normalização: 1FN a 3FN.', CONTEUDOEFETIVO: null, LICAOCASA: null, CODTURMA: 'DS-2026-A', CODDISC: 'BD1', NOMEDISC: 'Banco de Dados I', CODSUBTURMA: 'SUBTURMA C', CONFIRMADO: 'N', IDPLANOAULA: 7311807, TIPOAULA: 'T', URLAULAONLINE: null, OBSERVACAO: null },
        ],
        SPLANOAULAARQUIVO: [],
      }),
    },
  });
}
