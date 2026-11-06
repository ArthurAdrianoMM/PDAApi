/**
 * Builds the Claude Desktop bundle (.mcpb): the built server, its production
 * dependencies, and a manifest generated from package.json and the operations.
 * Claude Desktop ships Node.js, asks for the user and password in a form, and
 * keeps the password in its secure storage instead of a config file.
 *
 *   npm run pack:mcpb        # builds first; writes <name>-<version>.mcpb
 *
 * The bundler runs through npx, pinned, so its dependencies stay out of this project.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { PASSWORD_VAR, USER_VAR } from '../src/env.js';
import { operations } from '../src/operations/index.js';

const MCPB = '@anthropic-ai/mcpb@2.1.2';
const ROOT = resolve(import.meta.dirname, '..');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { name: string; version: string; engines: { node: string } };

const manifest = {
  manifest_version: '0.4',
  name: pkg.name,
  display_name: 'Portal 2',
  version: pkg.version,
  description: 'Seus dados do Portal do Aluno do SENAI, só para leitura: notas, faltas, horário, aulas, calendário e materiais.',
  long_description:
    'Roda no seu computador e fala com o portal usando a sua conta. Nenhum outro servidor participa. ' +
    'A senha fica guardada pelo Claude Desktop e na memória do servidor, e só é enviada ao portal. ' +
    'Projeto de aula, não oficial. Sem vínculo com o SENAI ou a FIEB.',
  author: { name: 'ArthurAdrianoMM', url: 'https://github.com/ArthurAdrianoMM' },
  repository: { type: 'git', url: 'https://github.com/ArthurAdrianoMM/portal-2' },
  server: {
    type: 'node',
    entry_point: 'dist/cli/main.js',
    mcp_config: {
      command: 'node',
      args: ['${__dirname}/dist/cli/main.js', 'mcp'],
      env: { [USER_VAR]: '${user_config.usuario}', [PASSWORD_VAR]: '${user_config.senha}' },
    },
  },
  tools: operations.map((operation) => ({ name: operation.id, description: operation.summary })),
  user_config: {
    usuario: {
      type: 'string',
      title: 'Usuário do portal',
      description: 'O usuário com que você entra no Portal do Aluno.',
      required: true,
    },
    senha: {
      type: 'string',
      title: 'Senha do portal',
      description: 'Guardada pelo Claude Desktop e enviada só ao portal.',
      sensitive: true,
      required: true,
    },
  },
  compatibility: { platforms: ['darwin', 'win32', 'linux'], runtimes: { node: pkg.engines.node } },
  keywords: ['senai', 'portal do aluno', 'notas', 'faltas', 'horário'],
};

const npx = (...args: string[]) => execFileSync('npx', ['-y', MCPB, ...args], { stdio: 'inherit' });

const out = join(ROOT, `${pkg.name}-${pkg.version}.mcpb`);
const stage = mkdtempSync(join(tmpdir(), `${pkg.name}-mcpb-`));
try {
  // The server only: MCP clients never open the docs page.
  const web = join(ROOT, 'dist', 'web');
  cpSync(join(ROOT, 'dist'), join(stage, 'dist'), {
    recursive: true,
    filter: (src) => src !== web && !src.startsWith(web + sep),
  });
  for (const file of ['package.json', 'package-lock.json']) cpSync(join(ROOT, file), join(stage, file));
  execFileSync('npm', ['ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: stage, stdio: 'inherit' });

  writeFileSync(join(stage, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  npx('validate', join(stage, 'manifest.json'));
  npx('pack', stage, out);
} finally {
  rmSync(stage, { recursive: true, force: true });
}
