/**
 * What the commands read from the environment. The password stays in this
 * process's memory; nothing here writes it anywhere.
 */
import type { Credentials } from './core/index.js';

export const USER_VAR = 'PORTAL_ALUNO_USER';
export const PASSWORD_VAR = 'PORTAL_ALUNO_PASSWORD';

/** The portal credentials in the environment, or the names of the variables that are missing. */
export function readEnvCredentials(env: NodeJS.ProcessEnv = process.env): { credentials: Credentials } | { missing: string[] } {
  const user = env[USER_VAR];
  const password = env[PASSWORD_VAR];
  if (user && password) return { credentials: { user, password } };
  return { missing: [...(user ? [] : [USER_VAR]), ...(password ? [] : [PASSWORD_VAR])] };
}
