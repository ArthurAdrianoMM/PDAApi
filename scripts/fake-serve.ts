/**
 * Serves the real app against the in-memory fake portal (test/support), so the
 * docs page can be developed without logging in to the real one. All data is made up.
 *
 *   npm run dev:fake          # API + built page on 127.0.0.1:4321
 *   npm run dev:web           # in another terminal: page with hot reload on localhost:5173
 */
import { serve } from '@hono/node-server';
import { createApp } from '../src/http/app.js';
import { CONTEXTS, academicRoute, createTestSession } from '../test/support/fake-portal.js';

const PORT = 4321;
const TOKEN = 'dev';
const CONTEXT_ID = CONTEXTS[1]!.IDCONTEXTOALUNO;

const { session } = createTestSession({
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
  },
});

await session.login();
const app = createApp({ session, token: TOKEN, port: PORT, log: (line) => console.error(line) });
serve({ fetch: app.fetch, hostname: '127.0.0.1', port: PORT }, () => {
  console.log(
    [
      'Portal FALSO (dados inventados), para desenvolver a documentação.',
      '',
      `Página construída: http://127.0.0.1:${PORT}/docs/#token=${TOKEN}`,
      `Com hot reload:    http://localhost:5173/docs/#token=${TOKEN}   (rode npm run dev:web)`,
    ].join('\n'),
  );
});
