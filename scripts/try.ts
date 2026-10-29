/**
 * Dev runner: logs in to the real portal and runs one operation.
 *
 *   npm run try -- <operation> ['<input as JSON>']
 *   npm run try -- notas
 *   npm run try -- listarDisciplinas '{"apenasEmCurso":true}'
 *
 * The user and password come from PORTAL_ALUNO_USER / PORTAL_ALUNO_PASSWORD or
 * are asked in the terminal. Output goes to stdout and contains your own data.
 */
import { z } from 'zod';
import { terminalCredentials } from '../src/cli/prompt.js';
import { PortalSession, isPortalError } from '../src/core/index.js';
import { operations, runOperation, type Operation } from '../src/operations/index.js';

function resolve(name: string | undefined): Operation | undefined {
  if (!name) return undefined;
  const path = '/' + name.replace(/^\/+/, '');
  return operations.find((op) => op.id === name || op.path === path);
}

function usage(): never {
  const list = operations.map((op) => `  ${op.id.padEnd(20)} ${op.path}`).join('\n');
  console.error(`Usage: npm run try -- <operation> ['<input JSON>']\n\nOperations:\n${list}`);
  process.exit(2);
}

async function main(): Promise<void> {
  const [name, rawInput] = process.argv.slice(2);
  const operation = resolve(name);
  if (!operation) usage();

  let input: unknown = {};
  if (rawInput) {
    try {
      input = JSON.parse(rawInput);
    } catch {
      console.error('A entrada precisa ser JSON, por exemplo \'{"apenasEmCurso":true}\'.');
      process.exit(2);
    }
  }

  const session = new PortalSession({ credentials: terminalCredentials() });
  try {
    const result = await runOperation(operation, session, input);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    if (isPortalError(error)) {
      console.error(`Erro [${error.code}]: ${error.message}`);
      for (const message of error.portalMessages) console.error(`  portal: ${message.type ?? ''} ${message.detail ?? ''}`);
    } else if (error instanceof z.ZodError) {
      console.error(`Entrada inválida:\n${z.prettifyError(error)}`);
    } else {
      console.error(error instanceof Error ? error.message : error);
    }
    process.exitCode = 1;
  } finally {
    session.forget();
  }
}

await main();
