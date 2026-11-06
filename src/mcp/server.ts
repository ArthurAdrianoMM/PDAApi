/**
 * The MCP server. Every tool is generated from the operation definitions, like
 * the HTTP routes and the OpenAPI document.
 *
 * Transport-neutral: it never holds a session. Each tool call asks `session`
 * for one, so the same server serves stdio (one student, credentials from the
 * environment), HTTP (the session behind a bearer token) or, later, a remote
 * server (the session of the user named by an OAuth token). See docs/MCP.md.
 */
import { McpServer } from '@modelcontextprotocol/server';
import type { PortalSession } from '../core/index.js';
import {
  operations as allOperations,
  isFileOperation,
  runFileOperation,
  runOperation,
  type Operation,
} from '../operations/index.js';
import { VERSION } from '../version.js';
import { INSTRUCTIONS } from './instructions.js';
import { errorResult, fileResult, fileUri, jsonResult } from './results.js';
import { pathsToTools, toolConfig } from './tools.js';

export interface McpDeps {
  /**
   * The portal session for this call. Throws when there is none (a
   * `LocalError` with a code and a message the model can relay).
   */
  session: () => Promise<PortalSession>;
  /** Where unexpected errors go. Never stdout, which carries the protocol on stdio. */
  log?: (line: string) => void;
  operations?: readonly Operation[];
}

export const SERVER_INFO = { name: 'portal-aluno', title: 'Portal do Aluno', version: VERSION };

export function createMcpServer(deps: McpDeps): McpServer {
  const { session, log = (line: string) => console.error(line) } = deps;
  const operations = deps.operations ?? allOperations;
  const rewrite = pathsToTools(operations);
  const server = new McpServer(SERVER_INFO, { instructions: INSTRUCTIONS });

  for (const operation of operations) {
    server.registerTool(operation.id, toolConfig(operation, rewrite), async (args) => {
      try {
        // The SDK has validated `args` already; the run validates again, as the HTTP routes do. Both are pure.
        if (isFileOperation(operation)) {
          return fileResult(await runFileOperation(operation, await session(), args), fileUri(operation.path, args));
        }
        return jsonResult(await runOperation(operation, await session(), args));
      } catch (error) {
        return errorResult(error, log);
      }
    });
  }
  return server;
}
