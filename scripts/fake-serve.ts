/**
 * Serves the real app against the in-memory fake portal (test/support), so the
 * docs page can be developed without logging in to the real one. All data is made up.
 *
 *   npm run dev:fake          # API + built page on 127.0.0.1:4321
 *   npm run dev:web           # in another terminal: page with hot reload on localhost:5173
 */
import { serve } from '@hono/node-server';
import { createApp } from '../src/http/app.js';
import { CONTEXTS, ORIGIN, PASSWORD, USER, academicRoute, createFakePortal, fakeSession } from '../test/support/fake-portal.js';

const PORT = 4321;
const TOKEN = 'dev';
const CONTEXT_ID = CONTEXTS[1]!.IDCONTEXTOALUNO;

const portal = createFakePortal({
  routes: {
    'TOTVSEducacional/Periodos': academicRoute(CONTEXT_ID, [
      { CODPERLET: '2026S2', IDPERLET: 1042 },
      { CODPERLET: '2026S1', IDPERLET: 1017 },
      { CODPERLET: '2025S2', IDPERLET: 988 },
    ]),
    'TOTVSEducacional/DisciplinasAlunoPeriodoLetivo': academicRoute(CONTEXT_ID, [
      { IDTURMADISC: 48213, CODDISC: 'PW2', NOME: 'Programação Web II', CODTURMA: 'DS-2026-A', CODSUBTURMA: '', IDPERLET: 1042, CODSTATUS: 1, DESCRICAO: 'Cursando' },
      { IDTURMADISC: 48230, CODDISC: 'BD1', NOME: 'Banco de Dados I', CODTURMA: 'DS-2026-A', CODSUBTURMA: 'SUBTURMA C', IDPERLET: 1042, CODSTATUS: 1, DESCRICAO: 'Cursando' },
    ]),
    'TOTVSEducacional/NotaEtapa': academicRoute(CONTEXT_ID, {
      Notas: [
        { IDTURMADISC: 48213, CODDISC: 'PW2', DISCIPLINA: 'Programação Web II', CODTURMA: 'DS-2026-A', SITUACAO: 'Cursando', '1 - AV 1 / AV QT 1': '8,5', '2 - AV 2 / AV QT 2': null },
        { IDTURMADISC: 48230, CODDISC: 'BD1', DISCIPLINA: 'Banco de Dados I', CODTURMA: 'DS-2026-A', SITUACAO: 'Cursando', '1 - AV 1 / AV QT 1': '7', '2 - AV 2 / AV QT 2': 'A' },
      ],
    }),
    'TOTVSEducacional/FaltaEtapa': academicRoute(CONTEXT_ID, {
      FaltasEtapa: [
        { Filial: 'Unidade Exemplo', CODTURMA: 'DS-2026-A', CODDISC: 'PW2', Disciplina: 'Programação Web II', 'Situação': 'Matriculado', '0 - Faltas': '2', PERCENTUAL: 2.78, IDTURMADISC: 48213, SITUACAOFALTAS: 1 },
        { Filial: 'Unidade Exemplo', CODTURMA: 'DS-2026-A', CODDISC: 'BD1', Disciplina: 'Banco de Dados I', 'Situação': 'Matriculado', '0 - Faltas': '1', PERCENTUAL: 1.39, IDTURMADISC: 48230, SITUACAOFALTAS: 1 },
      ],
    }),
    // The fake ignores dataDe/dataAte and always answers with these rows.
    'TOTVSEducacional/Aluno/Falta/Aula': academicRoute(CONTEXT_ID, {
      SFREQUENCIAALUNO: [
        { CODCOLIGADA: 1, IDTURMADISC: 48213, IDPLANOAULA: 7310451, IDHORARIOTURMA: 912, AULA: 20, CODDISC: 'PW2', DISCIPLINA: 'Programação Web II', DATAFALTA: '2026-09-14T00:00:00', DATA: '2026-09-14T00:00:00', HORAINICIAL: '19:00', HORAFINAL: '19:50', JUSTIFICADAPERSONALIZADO: 'Não', ABONAFALTAPERSONALIZADO: '', MOTIVOPERSONALIZADO: null, COMPOETOTALFALTAS: null, PRESENCA: 'A', JUSTIFICADA: null, CODSUBTURMA: null, SITUACAO: 'Não justificada' },
        { CODCOLIGADA: 1, IDTURMADISC: 48213, IDPLANOAULA: 7310452, IDHORARIOTURMA: 912, AULA: 21, CODDISC: 'PW2', DISCIPLINA: 'Programação Web II', DATAFALTA: '2026-09-14T00:00:00', DATA: '2026-09-14T00:00:00', HORAINICIAL: '19:50', HORAFINAL: '20:40', JUSTIFICADAPERSONALIZADO: 'Não', ABONAFALTAPERSONALIZADO: '', MOTIVOPERSONALIZADO: null, COMPOETOTALFALTAS: null, PRESENCA: 'A', JUSTIFICADA: null, CODSUBTURMA: null, SITUACAO: 'Não justificada' },
        { CODCOLIGADA: 1, IDTURMADISC: 48230, IDPLANOAULA: 7311807, IDHORARIOTURMA: 915, AULA: 3, CODDISC: 'BD1', DISCIPLINA: 'Banco de Dados I', DATAFALTA: '2026-08-03T00:00:00', DATA: '2026-08-03T00:00:00', HORAINICIAL: '20:40', HORAFINAL: '21:30', JUSTIFICADAPERSONALIZADO: 'Não', ABONAFALTAPERSONALIZADO: '', MOTIVOPERSONALIZADO: null, COMPOETOTALFALTAS: null, PRESENCA: 'A', JUSTIFICADA: null, CODSUBTURMA: 'SUBTURMA C', SITUACAO: 'Não justificada' },
      ],
    }),
    'TOTVSEducacional/QuadroHorarioAluno': academicRoute(CONTEXT_ID, {
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
  },
});

// Logged in from the start with token "dev", like `serve` with the credentials in the environment.
const session = fakeSession(portal);
await session.login();
const app = createApp({
  openSession: (credentials) => fakeSession(portal, credentials),
  initial: { session, token: TOKEN },
  portalUrl: ORIGIN,
  port: PORT,
  log: (line) => console.error(line),
});
serve({ fetch: app.fetch, hostname: '127.0.0.1', port: PORT }, () => {
  console.log(
    [
      'Portal FALSO (dados inventados), para desenvolver a documentação.',
      '',
      `Página construída: http://127.0.0.1:${PORT}/docs/#token=${TOKEN}`,
      `Com hot reload:    http://localhost:5173/docs/#token=${TOKEN}   (rode npm run dev:web)`,
      '',
      `Para testar a tela de login: usuário ${USER}, senha ${PASSWORD}`,
    ].join('\n'),
  );
});
