/**
 * What a tool call answers: JSON, a file, or an error. Pure: no session, no transport.
 */
import type { CallToolResult } from '@modelcontextprotocol/server';
import { LocalError, toErrorBody, type ErrorBody } from '../api/errors.js';
import type { FileResult } from '../operations/index.js';

/**
 * Largest file a tool answers with. Base64 adds a third, and clients limit how
 * big a tool result may be.
 */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

const INTERNAL_MESSAGE = 'Erro no servidor local. Os detalhes estão no log do servidor MCP, no cliente.';

/**
 * The object in `structuredContent`, and the same object as JSON text for
 * clients that only read `content`. Every JSON operation answers with an object
 * (checked by test/mcp.test.ts).
 */
export function jsonResult(data: unknown): CallToolResult {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) throw new Error('A JSON tool must answer with an object.');
  return { content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data as Record<string, unknown> };
}

const megabytes = (bytes: number) => (bytes / 1024 / 1024).toFixed(1).replace('.', ',');

/**
 * A file from the portal. Images go as images, text as text, anything else as
 * an embedded binary resource. A short JSON text says what the file is, for
 * clients that can't show it.
 */
export function fileResult(file: FileResult, uri: string): CallToolResult {
  const bytes = file.conteudo.byteLength;
  if (bytes > MAX_FILE_BYTES) {
    throw new LocalError(
      'arquivo_grande',
      `O arquivo tem ${megabytes(bytes)} MB, e as ferramentas entregam até 5 MB. ` +
        'Baixe-o pelo portal ou pela API local (portal-2 serve).',
    );
  }
  const mimeType = file.tipo.split(';')[0]!.trim();
  const about = { type: 'text' as const, text: JSON.stringify({ nome: file.nome, tipo: file.tipo, bytes }) };
  const base64 = Buffer.from(file.conteudo).toString('base64');

  if (mimeType.startsWith('image/')) return { content: [about, { type: 'image', data: base64, mimeType }] };
  if (mimeType.startsWith('text/')) {
    return { content: [about, { type: 'resource', resource: { uri, mimeType, text: new TextDecoder().decode(file.conteudo) } }] };
  }
  return { content: [about, { type: 'resource', resource: { uri, mimeType, blob: base64 } }] };
}

/** `[codigo] mensagem`, then the details, one per line. */
function errorText(body: ErrorBody): string {
  const lines = [`[${body.erro}] ${body.mensagem}`];
  for (const { campo, mensagem } of body.detalhes ?? []) lines.push(`- ${campo}: ${mensagem}`);
  if (body.mensagensDoPortal?.length) {
    lines.push('Mensagens do portal:');
    for (const { tipo, detalhe } of body.mensagensDoPortal) lines.push(`- ${[tipo, detalhe].filter(Boolean).join(': ')}`);
  }
  return lines.join('\n');
}

/**
 * Any thrown value as a tool error the model can read and act on. Codes and
 * messages are the HTTP API's; an unexpected error is logged with its stack,
 * and the model sees only `erro_interno`.
 */
export function errorResult(error: unknown, log: (line: string) => void): CallToolResult {
  let body: ErrorBody;
  if (error instanceof LocalError) {
    body = { erro: error.code, mensagem: error.message };
  } else {
    const mapped = toErrorBody(error);
    body = mapped.internal ? { erro: 'erro_interno', mensagem: INTERNAL_MESSAGE } : mapped.body;
    if (mapped.internal) log(`erro interno: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
  }
  return { isError: true, content: [{ type: 'text', text: errorText(body) }] };
}

/** A URI for a file of this API, such as `portal-2:///materiais/3150/arquivo`. */
export function fileUri(path: string, args: Record<string, unknown>): string {
  return `portal-2://${path.replace(/\{(\w+)\}/g, (_, name: string) => encodeURIComponent(String(args[name] ?? '')))}`;
}
