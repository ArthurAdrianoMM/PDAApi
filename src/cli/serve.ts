import type { AddressInfo } from 'node:net';
import { serve, type ServerType } from '@hono/node-server';
import { DEFAULT_CONFIG, PortalSession, type Credentials, type PortalConfig } from '../core/index.js';
import { createApp } from '../http/app.js';
import { createToken } from '../http/login.js';

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

/** `PORTAL_ALUNO_USER` and `PORTAL_ALUNO_PASSWORD`, when both are set. */
export function envCredentials(env: NodeJS.ProcessEnv = process.env): Credentials | null {
  const user = env.PORTAL_ALUNO_USER;
  const password = env.PORTAL_ALUNO_PASSWORD;
  if (!user && !password) return null;
  if (!user || !password) throw new Error('Defina PORTAL_ALUNO_USER e PORTAL_ALUNO_PASSWORD juntos, ou nenhum dos dois.');
  return { user, password };
}

/**
 * `portal-aluno serve`: serves the API and its docs on 127.0.0.1. Login happens
 * in the docs page, or at startup when the credentials are in the environment.
 */
export async function serveCommand(options: ServeOptions): Promise<void> {
  const config: Partial<PortalConfig> = options.period === undefined ? {} : { codPerLet: options.period };
  // Kept in this process's memory only, so the session can log in again after the portal expires it.
  const openSession = (credentials: Credentials) => new PortalSession({ credentials: async () => credentials, config });

  const fromEnv = envCredentials();
  let initial: { session: PortalSession; token: string; period: string } | undefined;
  if (fromEnv) {
    console.log('Entrando no portal…');
    const session = openSession(fromEnv);
    const { context } = await session.login();
    initial = { session, token: createToken(), period: context.codPerLet };
  }

  const app = createApp({
    openSession,
    ...(initial ? { initial } : {}),
    portalUrl: config.baseUrl ?? DEFAULT_CONFIG.baseUrl,
    port: options.port,
    log: (line) => console.error(line),
  });
  const server = await listen(app, options.port);
  const { port } = server.address() as AddressInfo;
  const docs = `http://${HOSTNAME}:${port}/docs/`;

  const lines = initial
    ? [
        `✓ Conectado. Matrícula do período ${initial.period}.`,
        '',
        `Documentação: ${docs}#token=${initial.token}`,
        `Token:        ${initial.token}`,
      ]
    : [`Documentação: ${docs}`, '', 'Entre com o usuário e a senha do portal pelo ícone no canto superior direito.'];
  console.log([...lines, '', 'A sessão fica só na memória deste processo. Ctrl+C encerra e a apaga.'].join('\n'));

  const stop = () => {
    server.close();
    process.exit(0);
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}
