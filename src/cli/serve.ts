import { randomBytes } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { serve, type ServerType } from '@hono/node-server';
import { PortalSession } from '../core/index.js';
import { createApp } from '../http/app.js';
import { terminalCredentials } from './prompt.js';

export interface ServeOptions {
  port: number;
  /** Period code of the enrollment to use (`CODPERLET`). */
  period?: string;
}

const HOSTNAME = '127.0.0.1';

function listen(app: ReturnType<typeof createApp>, port: number): Promise<ServerType> {
  return new Promise((resolve, reject) => {
    const server = serve({ fetch: app.fetch, hostname: HOSTNAME, port }, () => resolve(server));
    server.once('error', (error: NodeJS.ErrnoException) => {
      reject(
        error.code === 'EADDRINUSE'
          ? new Error(`A porta ${port} já está em uso. Escolha outra com --port.`)
          : error,
      );
    });
  });
}

/**
 * `portal-aluno serve`: logs in (asking for the password in the terminal),
 * then serves the API and its docs on 127.0.0.1 with a fresh token.
 */
export async function serveCommand(options: ServeOptions): Promise<void> {
  const session = new PortalSession({
    credentials: terminalCredentials(),
    config: options.period === undefined ? {} : { codPerLet: options.period },
  });

  console.log('Entrando no portal…');
  const { context } = await session.login();

  const token = randomBytes(32).toString('base64url');
  const app = createApp({ session, token, port: options.port, log: (line) => console.error(line) });
  const server = await listen(app, options.port);
  const { port } = server.address() as AddressInfo;

  console.log(
    [
      `✓ Conectado. Matrícula do período ${context.codPerLet}.`,
      '',
      `Documentação: http://${HOSTNAME}:${port}/docs/#token=${token}`,
      `Token:        ${token}`,
      '',
      'A sessão fica só na memória deste processo. Ctrl+C encerra e a apaga.',
    ].join('\n'),
  );

  const stop = () => {
    session.forget();
    server.close();
    process.exit(0);
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}
