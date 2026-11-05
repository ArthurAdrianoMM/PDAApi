import { serveStdio } from '@modelcontextprotocol/server/stdio';
import type { PortalConfig } from '../core/index.js';
import { readEnvCredentials } from '../env.js';
import { envSession } from '../mcp/env-session.js';
import { createMcpServer } from '../mcp/server.js';
import { VERSION } from '../version.js';

export interface McpOptions {
  /** Period code of the enrollment to use (`CODPERLET`). */
  period?: string;
}

/**
 * `portal-aluno mcp`: the MCP server on stdio, started by an MCP client. It
 * starts without contacting the portal and logs in on the first tool call.
 * stdout carries the protocol, so everything else goes to stderr, which the
 * client keeps in its log for this server.
 */
export function mcpCommand(options: McpOptions): void {
  const config: Partial<PortalConfig> = options.period === undefined ? {} : { codPerLet: options.period };
  const log = (line: string) => console.error(line);
  const session = envSession({ config });

  serveStdio(() => createMcpServer({ session, log }), { onerror: (error) => log(`erro no transporte MCP: ${error.message}`) });

  log(`portal-aluno ${VERSION}: servidor MCP no stdio. A sessão do portal fica só na memória deste processo.`);
  const read = readEnvCredentials();
  if ('missing' in read) log(`Aviso: falta ${read.missing.join(' e ')}. As ferramentas vão responder com o erro sem_credenciais.`);
}
