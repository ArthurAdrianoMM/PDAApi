/**
 * The session resolver of the stdio server: one portal session for the life of
 * the process, made from the credentials in its environment, and logged in on
 * the first tool call rather than at startup, so the server always starts and
 * setup mistakes reach the model as tool errors.
 */
import { LocalError } from '../api/errors.js';
import { PortalSession, isPortalError, type Credentials, type PortalConfig } from '../core/index.js';
import { readEnvCredentials } from '../env.js';

export interface EnvSessionOptions {
  env?: NodeJS.ProcessEnv;
  config?: Partial<PortalConfig>;
  /** Creates the session. For tests and the fake portal; defaults to the real portal. */
  open?: (credentials: Credentials) => PortalSession;
}

export function envSession(options: EnvSessionOptions = {}): () => Promise<PortalSession> {
  const { env = process.env, config = {} } = options;
  const open = options.open ?? ((credentials: Credentials) => new PortalSession({ credentials: async () => credentials, config }));
  let session: PortalSession | undefined;
  // The credentials can't change while the process runs. After the portal refuses them,
  // trying again could only repeat the refusal, and many tries could lock the account.
  let refused = false;

  return async () => {
    const read = readEnvCredentials(env);
    if ('missing' in read) {
      throw new LocalError(
        'sem_credenciais',
        `Defina ${read.missing.join(' e ')} na configuração deste servidor MCP, no seu cliente, e reinicie-o. ` +
          'São o usuário e a senha do Portal do Aluno.',
      );
    }
    if (refused) {
      throw new LocalError(
        'login_recusado',
        'O login no portal já falhou com estas credenciais. Para não bloquear a conta, o servidor não tenta de novo: ' +
          'confira o usuário e a senha na configuração deste servidor MCP e reinicie-o.',
      );
    }
    session ??= open(read.credentials);
    try {
      await session.ensureSession();
    } catch (error) {
      if (isPortalError(error, 'login_falhou')) refused = true;
      throw error;
    }
    return session;
  };
}
