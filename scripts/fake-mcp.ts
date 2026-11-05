/**
 * The MCP server on stdio against the in-memory fake portal, so the tools can
 * be tried in an MCP client or the MCP Inspector without the real portal. All
 * data is made up, and it logs in as the fake account on its own.
 *
 *   npm run -s dev:mcp:fake                   # -s keeps npm's banner off stdout, which carries the protocol
 *   npm run -s dev:mcp:fake -- --senha-errada # a refused login, to see login_falhou and then login_recusado
 */
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { PASSWORD_VAR, USER_VAR } from '../src/env.js';
import { envSession } from '../src/mcp/env-session.js';
import { createMcpServer } from '../src/mcp/server.js';
import { PASSWORD, USER, fakeSession } from '../test/support/fake-portal.js';
import { createDemoPortal } from './demo-portal.js';

const portal = createDemoPortal();
const wrongPassword = process.argv.includes('--senha-errada');
const session = envSession({
  env: { [USER_VAR]: USER, [PASSWORD_VAR]: wrongPassword ? 'senha-errada' : PASSWORD },
  open: (credentials) => fakeSession(portal, credentials),
});

serveStdio(() => createMcpServer({ session }));
console.error(`Portal FALSO (dados inventados): servidor MCP no stdio${wrongPassword ? ', com a senha errada' : ''}.`);
