/**
 * Errors the core raises, with the description shown in the docs. The codes are
 * part of the public API: the HTTP and MCP adapters pass them through unchanged.
 * Messages are in Portuguese, the language of the API's users.
 */
export const PORTAL_ERROR_CODES = {
  configuracao_invalida: 'A configuração não combina com o que o portal retornou (alias ou período).',
  login_falhou: 'O portal não completou o login. Confira o usuário e a senha.',
  sessao_expirada: 'O portal recusou a sessão, e um novo login não resolveu.',
  portal_recusou: 'O portal negou o acesso (HTTP 403). A API repassa a recusa e não tenta outro caminho.',
  sem_contexto: 'O portal pediu um contexto de matrícula que a sessão não tem.',
  erro_do_portal: 'O portal retornou um erro dentro da resposta.',
  resposta_inesperada: 'A resposta do portal não tem o formato documentado.',
  portal_indisponivel: 'Não foi possível falar com o portal: sem conexão, tempo esgotado ou erro 5xx.',
} as const;

export type PortalErrorCode = keyof typeof PORTAL_ERROR_CODES;

/** A message from the portal's response envelope (`messages[]`). */
export interface PortalMessage {
  type?: string | undefined;
  detail?: string | undefined;
}

export interface PortalErrorDetails {
  /** HTTP status of the portal response, when there was one. */
  status?: number;
  /** Messages from the portal envelope, when there were any. */
  portalMessages?: PortalMessage[];
  cause?: unknown;
}

export class PortalError extends Error {
  override readonly name = 'PortalError';
  readonly code: PortalErrorCode;
  readonly status: number | undefined;
  readonly portalMessages: PortalMessage[];

  constructor(code: PortalErrorCode, message: string, details: PortalErrorDetails = {}) {
    super(message, details.cause === undefined ? undefined : { cause: details.cause });
    this.code = code;
    this.status = details.status;
    this.portalMessages = details.portalMessages ?? [];
  }
}

export function isPortalError(error: unknown, code?: PortalErrorCode): error is PortalError {
  return error instanceof PortalError && (code === undefined || error.code === code);
}
