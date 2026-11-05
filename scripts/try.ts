/**
 * Dev runner: logs in to the real portal and runs one operation.
 *
 *   npm run try -- <operation> ['<input as JSON>']
 *   npm run try -- notas
 *   npm run try -- listarDisciplinas '{"apenasEmCurso":true}'
 *
 * A file operation prints the file's name, type, size and first bytes, not the file.
 *
 * The user and password come from PORTAL_ALUNO_USER / PORTAL_ALUNO_PASSWORD or
 * are asked in the terminal. Output goes to stdout and contains your own data.
 */
import { z } from 'zod';
import { terminalCredentials } from '../src/cli/prompt.js';
import { PortalSession, isPortalError } from '../src/core/index.js';
import { isFileOperation, operations, runFileOperation, runOperation, type Operation } from '../src/operations/index.js';

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
    if (isFileOperation(operation)) {
      // The file itself stays out of the terminal: its name, type, size and first bytes are enough to check it.
      const file = await runFileOperation(operation, session, input);
      const inicio = [...file.conteudo.slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join(' ');
      console.log(JSON.stringify({ nome: file.nome, tipo: file.tipo, bytes: file.conteudo.length, inicio }, null, 2));
    } else {
      console.log(JSON.stringify(await runOperation(operation, session, input), null, 2));
    }
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
