/**
 * Errors as every adapter of this API reports them: a stable code, a message
 * for people, and the details that help fix the call. The HTTP server adds a
 * status; the MCP server returns them as tool errors. Messages never carry
 * values from the portal.
 */
import { z } from 'zod';
import { isPortalError, type PortalErrorCode } from '../core/index.js';

/** Errors any adapter can raise for itself, whatever the transport. */
export const COMMON_ERROR_CODES = {
  parametro_invalido: 'Um parâmetro está faltando, sobrando ou com o tipo errado.',
  erro_interno: 'Erro no servidor local. Veja o terminal onde ele está rodando.',
} as const;

export type CommonErrorCode = PortalErrorCode | keyof typeof COMMON_ERROR_CODES;

export interface ErrorBody<C extends string = string> {
  erro: C;
  mensagem: string;
  /** In `parametro_invalido`, one item per parameter with a problem. */
  detalhes?: { campo: string; mensagem: string }[];
  /** Messages the portal itself sent, when it sent any. */
  mensagensDoPortal?: { tipo: string | null; detalhe: string | null }[];
}

/**
 * An error an adapter raises with a code of its own, such as a missing token
 * or missing credentials. Each adapter documents its codes.
 */
export class LocalError<C extends string = string> extends Error {
  override readonly name = 'LocalError';
  readonly code: C;

  constructor(code: C, message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * Maps any thrown value to an error body. Portal errors keep their code and
 * message; input errors list the fields; anything else is an internal error,
 * whose details stay in the server's log. `LocalError`s are left to the
 * adapter that raised them.
 */
export function toErrorBody(error: unknown): { body: ErrorBody<CommonErrorCode>; internal: boolean } {
  if (isPortalError(error)) {
    const body: ErrorBody<CommonErrorCode> = { erro: error.code, mensagem: error.message };
    if (error.portalMessages.length > 0) {
      body.mensagensDoPortal = error.portalMessages.map((m) => ({ tipo: m.type ?? null, detalhe: m.detail ?? null }));
    }
    return { body, internal: false };
  }
  if (error instanceof z.ZodError) {
    const body: ErrorBody<CommonErrorCode> = { erro: 'parametro_invalido', mensagem: COMMON_ERROR_CODES.parametro_invalido };
    body.detalhes = error.issues.map((issue) => ({
      campo: issue.path.join('.') || (issue.code === 'unrecognized_keys' ? issue.keys.join(', ') : '(entrada)'),
      mensagem: issue.message,
    }));
    return { body, internal: false };
  }
  return { body: { erro: 'erro_interno', mensagem: COMMON_ERROR_CODES.erro_interno }, internal: true };
}
