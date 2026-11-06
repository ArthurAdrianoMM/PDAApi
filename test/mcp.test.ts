import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { LocalError } from '../src/api/errors.js';
import { PortalError, type PortalSession } from '../src/core/index.js';
import { PASSWORD_VAR, USER_VAR } from '../src/env.js';
import { envSession } from '../src/mcp/env-session.js';
import { MAX_FILE_BYTES, errorResult, fileResult } from '../src/mcp/results.js';
import { createMcpServer, type McpDeps } from '../src/mcp/server.js';
import { pathsToTools } from '../src/mcp/tools.js';
import { defineOperation, isFileOperation, operations } from '../src/operations/index.js';
import { createDemoPortal } from '../scripts/demo-portal.js';
import { PASSWORD, USER, fakeSession, type FakePortal } from './support/fake-portal.js';

type Era = 'legacy' | 'modern';

/**
 * A client connected through `serveStdio`, the stdio server's own entry, over
 * an in-memory pipe. `legacy` speaks the 2025 handshake; `modern` is pinned to
 * 2026-07-28. The client checks `structuredContent` against each tool's `outputSchema`.
 */
async function connect(deps: McpDeps, era: Era = 'legacy') {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  serveStdio(() => createMcpServer({ log: () => {}, ...deps }), { transport: serverSide });
  const client = new Client(
    { name: 'teste', version: '0' },
    era === 'modern' ? { versionNegotiation: { mode: { pin: '2026-07-28' } } } : {},
  );
  await client.connect(clientSide);
  return client;
}

/** The demo portal (made-up data for every operation) and a stdio-style session resolver for it. */
function demo(password = PASSWORD) {
  const portal = createDemoPortal();
  const session = envSession({
    env: { [USER_VAR]: USER, [PASSWORD_VAR]: password },
    open: (credentials) => fakeSession(portal, credentials),
  });
  return { portal, session };
}

const loginAttempts = (portal: FakePortal) => portal.paths().filter((p) => p === 'POST TOTVSEducacional/Login').length;

const textOf = (result: Awaited<ReturnType<Client['callTool']>>) =>
  (result.content as { type: string; text?: string }[]).find((block) => block.type === 'text')?.text ?? '';

/** Arguments for the tools whose inputs are required, with IDs the demo portal knows. */
const ARGS: Record<string, Record<string, unknown>> = {
  listarEtapasDaDisciplina: { idTurmaDisc: 48213 },
  listarAulasDaDisciplina: { idTurmaDisc: 48213, de: '2026-11-02', ate: '2026-11-08' },
  obterAula: { idTurmaDisc: 48213, idPlanoAula: 7310021 },
  listarMateriaisDaDisciplina: { idTurmaDisc: 48213 },
  baixarMaterial: { idMaterial: 3150 },
};

describe('tools', () => {
  it('has one tool per operation, named by its id, read-only', async () => {
    const client = await connect(demo());
    const { tools } = await client.listTools();

    expect(tools.map((tool) => tool.name)).toEqual(operations.map((operation) => operation.id));
    for (const tool of tools) {
      expect(tool.title).toBeTruthy();
      expect(tool.annotations).toEqual({ readOnlyHint: true, idempotentHint: true, openWorldHint: true });
      expect(tool.inputSchema.type).toBe('object');
    }
  });

  it('gives every JSON tool an object outputSchema, and file tools none', async () => {
    const client = await connect(demo());
    const { tools } = await client.listTools();

    for (const operation of operations) {
      const tool = tools.find((t) => t.name === operation.id)!;
      if (isFileOperation(operation)) expect(tool.outputSchema).toBeUndefined();
      else expect(tool.outputSchema?.type).toBe('object');
    }
  });

  it('puts the callouts in the description, so the model sees the pitfalls', async () => {
    const client = await connect(demo());
    const { tools } = await client.listTools();
    const notas = tools.find((tool) => tool.name === 'obterNotas')!;

    expect(notas.description).toContain('**Avaliações mudam de nome:**');
    expect(notas.description).toContain('Leia pelo `etapa`, nunca pela posição.');
  });

  it('names tools instead of API paths, in descriptions and schemas', async () => {
    const client = await connect(demo());
    const published = JSON.stringify((await client.listTools()).tools);

    for (const operation of operations) expect(published).not.toContain(`\`${operation.path}\``);
    expect(published).toContain('Combina com `listarDisciplinas`.');
  });

  it('rewrites only paths that belong to an operation', () => {
    const rewrite = pathsToTools(operations);
    expect(rewrite('Veja `/periodos` e `/materiais/{idMaterial}/arquivo?idTurmaDisc={idTurmaDisc}`.')).toBe(
      'Veja `listarPeriodos` e `baixarMaterial`.',
    );
    expect(rewrite('Não é rota: `/outra`, nem /periodos sem crases.')).toBe('Não é rota: `/outra`, nem /periodos sem crases.');
  });

  it('tells the model where IDs come from', async () => {
    const client = await connect(demo());
    expect(client.getInstructions()).toContain('Nunca tente números em sequência.');
  });
});

describe('calls', () => {
  it('answers every JSON tool with structured content that its outputSchema accepts, and the same JSON as text', async () => {
    const client = await connect(demo());

    for (const operation of operations.filter((o) => !isFileOperation(o))) {
      const result = await client.callTool({ name: operation.id, arguments: ARGS[operation.id] ?? {} });
      expect(result.isError, `${operation.id}: ${textOf(result)}`).toBeFalsy();
      expect(result.structuredContent).toBeTypeOf('object');
      expect(JSON.parse(textOf(result))).toEqual(result.structuredContent);
    }
  });

  it('works the same for a 2026-07-28 client', async () => {
    const client = await connect(demo(), 'modern');
    const result = await client.callTool({ name: 'obterNotas', arguments: { periodo: '2026S1' } });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({ periodo: '2026S1' });
  });

  it('answers the photo as an image', async () => {
    const client = await connect(demo());
    const result = await client.callTool({ name: 'baixarFoto', arguments: {} });

    expect(result.content).toEqual([
      { type: 'text', text: expect.stringContaining('"tipo":"image/png"') },
      { type: 'image', mimeType: 'image/png', data: expect.any(String) },
    ]);
  });

  it('answers a material as an embedded file, with what it is as text', async () => {
    const client = await connect(demo());
    const result = await client.callTool({ name: 'baixarMaterial', arguments: { idMaterial: 3150 } });

    expect(JSON.parse(textOf(result))).toMatchObject({ tipo: 'application/pdf' });
    expect(result.content).toContainEqual({
      type: 'resource',
      resource: { uri: 'portal-aluno:///materiais/3150/arquivo', mimeType: 'application/pdf', blob: expect.any(String) },
    });
  });
});

describe('files', () => {
  const file = (tipo: string, bytes: number | string) => ({
    nome: 'arquivo',
    tipo,
    conteudo: typeof bytes === 'string' ? new TextEncoder().encode(bytes) : new Uint8Array(bytes),
  });

  it('sends text files as text', () => {
    const result = fileResult(file('text/csv; charset=utf-8', 'a;b\n1;2'), 'portal-aluno:///x');
    expect(result.content[1]).toEqual({ type: 'resource', resource: { uri: 'portal-aluno:///x', mimeType: 'text/csv', text: 'a;b\n1;2' } });
  });

  it('refuses files over the limit, saying how big they are', () => {
    const tooBig = () => fileResult(file('application/pdf', MAX_FILE_BYTES + 1), 'portal-aluno:///x');
    expect(tooBig).toThrow(LocalError);
    expect(tooBig).toThrow('5,0 MB');
    expect(fileResult(file('application/pdf', MAX_FILE_BYTES), 'portal-aluno:///x').isError).toBeUndefined();
  });
});

describe('errors', () => {
  it('passes portal errors on with their code and message', async () => {
    const client = await connect(demo());
    const result = await client.callTool({ name: 'obterNotas', arguments: { periodo: '1999S1' } });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe('[periodo_inexistente] Não há matrícula no período 1999S1. Períodos desta conta: 2026S1, 2026S2, 2025S2.');
  });

  it('rejects bad input before contacting the portal', async () => {
    const { portal, session } = demo();
    const client = await connect({ session });
    const result = await client.callTool({ name: 'listarAulas', arguments: { de: 'ontem' } });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('de');
    expect(portal.requests).toHaveLength(0);
  });

  it('lists the fields of an input error, and the portal messages', () => {
    const zod = z.object({ de: z.iso.date() }).safeParse({ de: 'ontem' }).error;
    expect(errorResult(zod, () => {}).content).toEqual([{ type: 'text', text: expect.stringMatching(/^\[parametro_invalido\] .*\n- de: /) }]);

    const portal = new PortalError('erro_do_portal', 'O portal retornou um erro.', { portalMessages: [{ type: 'Error', detail: 'Falhou' }] });
    expect(errorResult(portal, () => {}).content).toEqual([
      { type: 'text', text: '[erro_do_portal] O portal retornou um erro.\nMensagens do portal:\n- Error: Falhou' },
    ]);
  });

  it('hides unexpected errors from the model and logs them', async () => {
    const quebrada = defineOperation({
      id: 'quebrada',
      method: 'get',
      path: '/quebrada',
      tag: 'Conta',
      summary: 'Quebrada',
      description: 'Sempre falha.',
      callouts: [],
      upstream: [],
      input: z.object({}),
      output: z.object({}),
      example: {},
      handler: async () => {
        throw new Error('detalhe interno');
      },
    });
    const logs: string[] = [];
    const client = await connect({ session: demo().session, operations: [quebrada], log: (line) => logs.push(line) });
    const result = await client.callTool({ name: 'quebrada', arguments: {} });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/^\[erro_interno\] /);
    expect(textOf(result)).not.toContain('detalhe interno');
    expect(logs.join('\n')).toContain('detalhe interno');
  });
});

describe('session from the environment', () => {
  it('does not contact the portal to start, list tools or describe itself', async () => {
    const { portal, session } = demo();
    const client = await connect({ session });
    await client.listTools();

    expect(portal.requests).toHaveLength(0);
  });

  it('logs in on the first tool call, once for many calls', async () => {
    const { portal, session } = demo();
    const client = await connect({ session });
    await client.callTool({ name: 'obterNotas', arguments: {} });
    await client.callTool({ name: 'obterFaltas', arguments: {} });

    expect(portal.logins).toBe(1);
  });

  it('names the missing variables, without contacting the portal', async () => {
    const portal = createDemoPortal();
    const session = envSession({ env: { [USER_VAR]: USER }, open: (credentials) => fakeSession(portal, credentials) });
    const client = await connect({ session });
    const result = await client.callTool({ name: 'obterNotas', arguments: {} });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/^\[sem_credenciais\] Defina PORTAL_ALUNO_PASSWORD na configuração/);
    expect(portal.requests).toHaveLength(0);
  });

  it('reports a wrong password, then stops sending it to the portal', async () => {
    const { portal, session } = demo('senha-errada');
    const client = await connect({ session });

    const first = await client.callTool({ name: 'obterNotas', arguments: {} });
    expect(textOf(first)).toMatch(/^\[login_falhou\] .*Confira o usuário e a senha\./);

    const again = await client.callTool({ name: 'obterFaltas', arguments: {} });
    expect(textOf(again)).toMatch(/^\[login_recusado\] .*reinicie-o\.$/);
    expect(loginAttempts(portal)).toBe(1);
  });

  it('keeps retrying when the portal is down, since that is not about the password', async () => {
    let calls = 0;
    const session = envSession({
      env: { [USER_VAR]: USER, [PASSWORD_VAR]: PASSWORD },
      open: () =>
        ({
          ensureSession: async () => {
            calls += 1;
            throw new PortalError('portal_indisponivel', 'O portal falhou.');
          },
        }) as unknown as PortalSession,
    });

    await expect(session()).rejects.toThrow('O portal falhou.');
    await expect(session()).rejects.toThrow('O portal falhou.');
    expect(calls).toBe(2);
  });
});
