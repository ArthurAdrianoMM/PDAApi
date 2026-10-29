import { z } from 'zod';
import { PORTAL_ERROR_CODES, isPortalError, type PortalErrorCode } from '../core/index.js';

/** Errors raised by the local server itself, not by the portal. */
export const LOCAL_ERROR_CODES = {
  parametro_invalido: 'Um parâmetro está faltando, sobrando ou com o tipo errado.',
  token_invalido: 'O token local está ausente ou errado. Use o link ou o token que o terminal mostrou.',
  host_invalido: 'O cabeçalho Host não é o endereço local deste servidor.',
  nao_encontrado: 'Esta rota não existe.',
  erro_interno: 'Erro no servidor local. Veja o terminal onde ele está rodando.',
} as const;

export type ApiErrorCode = PortalErrorCode | keyof typeof LOCAL_ERROR_CODES;

export const ERROR_DESCRIPTIONS: Record<ApiErrorCode, string> = { ...PORTAL_ERROR_CODES, ...LOCAL_ERROR_CODES };

export const ERROR_STATUS = {
  parametro_invalido: 400,
  token_invalido: 401,
  login_falhou: 401,
  sessao_expirada: 401,
  portal_recusou: 403,
  host_invalido: 403,
  nao_encontrado: 404,
  configuracao_invalida: 500,
  erro_interno: 500,
  sem_contexto: 502,
  erro_do_portal: 502,
  resposta_inesperada: 502,
  portal_indisponivel: 503,
} as const satisfies Record<ApiErrorCode, number>;

export type ErrorStatus = (typeof ERROR_STATUS)[ApiErrorCode];

const errorCodes = Object.keys(ERROR_DESCRIPTIONS) as [ApiErrorCode, ...ApiErrorCode[]];

export const apiErrorSchema = z.object({
  erro: z.enum(errorCodes).describe('Código estável do erro.'),
  mensagem: z.string().describe('Explicação para pessoas.'),
  detalhes: z
    .array(z.object({ campo: z.string(), mensagem: z.string() }))
    .optional()
    .describe('Em `parametro_invalido`, um item por parâmetro com problema.'),
  mensagensDoPortal: z
    .array(z.object({ tipo: z.string().nullable(), detalhe: z.string().nullable() }))
    .optional()
    .describe('Mensagens que o próprio portal enviou, quando enviou.'),
});

export type ApiError = z.output<typeof apiErrorSchema>;

export function apiError(code: ApiErrorCode, mensagem: string = ERROR_DESCRIPTIONS[code]): ApiError {
  return { erro: code, mensagem };
}

/**
 * Maps any thrown value to a status and body. Portal errors keep their code and
 * message; input errors list the fields; anything else is an internal error,
 * whose details stay in the terminal.
 */
export function toApiError(error: unknown): { status: ErrorStatus; body: ApiError; internal: boolean } {
  if (isPortalError(error)) {
    const body = apiError(error.code, error.message);
    if (error.portalMessages.length > 0) {
      body.mensagensDoPortal = error.portalMessages.map((m) => ({ tipo: m.type ?? null, detalhe: m.detail ?? null }));
    }
    return { status: ERROR_STATUS[error.code], body, internal: false };
  }
  if (error instanceof z.ZodError) {
    const body = apiError('parametro_invalido');
    body.detalhes = error.issues.map((issue) => ({
      campo: issue.path.join('.') || (issue.code === 'unrecognized_keys' ? issue.keys.join(', ') : '(entrada)'),
      mensagem: issue.message,
    }));
    return { status: ERROR_STATUS.parametro_invalido, body, internal: false };
  }
  return { status: ERROR_STATUS.erro_interno, body: apiError('erro_interno'), internal: true };
}
