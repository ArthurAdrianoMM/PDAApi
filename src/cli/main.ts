#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { isPortalError } from '../core/index.js';
import { VERSION } from '../version.js';
import { serveCommand } from './serve.js';

const HELP = `portal-aluno ${VERSION}: seus dados do Portal do Aluno, numa API local.

Uso:
  portal-aluno serve [--port 4321] [--period 2026S2]

Comandos:
  serve        Serve a API e a documentação em 127.0.0.1.

Opções de serve:
  --port       Porta local (padrão 4321).
  --period     Período da matrícula a usar (CODPERLET). Padrão: a matrícula mais recente.

Entre com usuário e senha na documentação. Com PORTAL_ALUNO_USER e PORTAL_ALUNO_PASSWORD
definidos, o servidor já entra no portal ao iniciar.
`;

function fail(message: string): never {
  console.error(message);
  process.exit(2);
}

async function main(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      port: { type: 'string' },
      period: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
    },
  });

  if (values.version) return void console.log(VERSION);
  const [command, ...extra] = positionals;
  if (values.help || command === undefined) return void console.log(HELP);
  if (extra.length > 0) fail(`Argumento a mais: ${extra.join(' ')}\n\n${HELP}`);

  switch (command) {
    case 'serve': {
      const port = Number(values.port ?? 4321);
      if (!Number.isInteger(port) || port < 1 || port > 65535) fail('--port precisa ser um número entre 1 e 65535.');
      return serveCommand({ port, ...(values.period === undefined ? {} : { period: values.period }) });
    }
    default:
      fail(`Comando desconhecido: ${command}\n\n${HELP}`);
  }
}

main(process.argv.slice(2)).catch((error: unknown) => {
  if (isPortalError(error)) console.error(`Erro [${error.code}]: ${error.message}`);
  else console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
