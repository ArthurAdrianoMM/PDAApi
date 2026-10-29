import { createInterface } from 'node:readline/promises';
import type { Credentials, CredentialsProvider } from '../core/index.js';

/** Reads one line. Fails if the input ends first (readline would otherwise never answer). */
export async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const closed = new Promise<never>((_, reject) => {
    rl.once('close', () => reject(new Error('A entrada terminou antes da resposta.')));
  });
  try {
    return (await Promise.race([rl.question(question), closed])).trim();
  } finally {
    rl.close();
  }
}

/** Reads a line without echoing it. Needs an interactive terminal. */
export function askHidden(question: string): Promise<string> {
  const { stdin, stdout } = process;
  if (!stdin.isTTY) {
    return Promise.reject(new Error('A senha precisa ser digitada num terminal interativo. Outra opção: PORTAL_ALUNO_PASSWORD.'));
  }

  stdout.write(question);
  stdin.setRawMode(true);
  stdin.setEncoding('utf8');
  stdin.resume();

  return new Promise((resolve, reject) => {
    let value = '';
    const finish = (error?: Error) => {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write('\n');
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n' || char === '\u0004') return finish();
        if (char === '\u0003') return finish(new Error('Cancelado.'));
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else if (char >= ' ') value += char;
      }
    };
    stdin.on('data', onData);
  });
}

/**
 * Credentials from `PORTAL_ALUNO_USER` / `PORTAL_ALUNO_PASSWORD`, or asked in
 * the terminal. Kept in this process's memory only, so the session can log in
 * again after the portal expires it.
 */
export function terminalCredentials(env: NodeJS.ProcessEnv = process.env): CredentialsProvider {
  let cached: Credentials | undefined;
  return async () => {
    if (!cached) {
      const user = env.PORTAL_ALUNO_USER || (await ask('Usuário (RA): '));
      const password = env.PORTAL_ALUNO_PASSWORD || (await askHidden('Senha: '));
      if (!user || !password) throw new Error('Usuário e senha são obrigatórios.');
      cached = { user, password };
    }
    return cached;
  };
}
