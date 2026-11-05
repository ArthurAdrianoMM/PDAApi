import { z } from 'zod';
import { PORTAL_ERROR_CODES } from '../core/index.js';
import { COMMON_ERROR_CODES, toErrorBody, type CommonErrorCode } from '../api/errors.js';

/** Errors only the local HTTP server raises. */
export const LOCAL_ERROR_CODES = {
  token_invalido: 'O token local está ausente ou errado. Entre de novo pela documentação (/docs/) para receber um novo.',
  host_invalido: 'O cabeçalho Host não é o endereço local deste servidor.',
  origem_invalida: 'O login só é aceito a partir da documentação servida por este servidor.',
  nao_encontrado: 'Esta rota não existe.',
} as const;

export type ApiErrorCode = CommonErrorCode | keyof typeof LOCAL_ERROR_CODES;

export const ERROR_DESCRIPTIONS: Record<ApiErrorCode, string> = {
  ...PORTAL_ERROR_CODES,
  parametro_invalido: COMMON_ERROR_CODES.parametro_invalido,
  ...LOCAL_ERROR_CODES,
  erro_interno: COMMON_ERROR_CODES.erro_interno,
};

export const ERROR_STATUS = {
  parametro_invalido: 400,
  token_invalido: 401,
  login_falhou: 401,
  sessao_expirada: 401,
  portal_recusou: 403,
  host_invalido: 403,
  origem_invalida: 403,
  nao_encontrado: 404,
  periodo_inexistente: 404,
  item_inexistente: 404,
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

/** Maps any thrown value to a status and body (see `toErrorBody`). */
export function toApiError(error: unknown): { status: ErrorStatus; body: ApiError; internal: boolean } {
  const { body, internal } = toErrorBody(error);
  return { status: ERROR_STATUS[body.erro], body, internal };
}
