/**
 * Serves the real app against the in-memory fake portal (test/support), so the
 * docs page can be developed without logging in to the real one. All data is made up.
 *
 *   npm run dev:fake          # API + built page on 127.0.0.1:4321
 *   npm run dev:web           # in another terminal: page with hot reload on localhost:5173
 */
import { serve } from '@hono/node-server';
import { createApp } from '../src/http/app.js';
import { ORIGIN, PASSWORD, USER, fakeSession } from '../test/support/fake-portal.js';
import { createDemoPortal } from './demo-portal.js';

const PORT = Number(process.env.PORT ?? 4321);
const TOKEN = 'dev';

const portal = createDemoPortal();

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
