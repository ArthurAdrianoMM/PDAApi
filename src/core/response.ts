import { z } from 'zod';
import { PortalError, type PortalMessage } from './errors.js';
import type { PortalResponse } from './http.js';

/** Key the portal puts in `data` when the call failed on its side (ENDPOINTS.md 2.4, 4.5). */
const RM_EXCEPTION_KEY = 'RMException:Message';

/** Warning text that means the context cookie is missing or wrong (ENDPOINTS.md 2.4). */
const MISSING_CONTEXT_TEXT = 'sem permissão para acessar os dados acadêmicos';

const messageSchema = z.looseObject({
  type: z.string().optional(),
  detail: z.string().optional(),
});

const envelopeSchema = z.looseObject({
  data: z.unknown(),
  messages: z.array(messageSchema).optional(),
});

/**
 * Throws for any non-2xx response. A redirect or 401 on an API call is read as
 * a rejected session: the portal sends expired sessions to its login page
 * (ENDPOINTS.md 3). The caller decides whether to log in again.
 */
export function assertOk(res: PortalResponse, label: string): void {
  const { status } = res;
  if (status >= 200 && status < 300) return;
  if ((status >= 300 && status < 400) || status === 401) {
    throw new PortalError('sessao_expirada', `O portal recusou a sessão (${label}, HTTP ${status}).`, { status });
  }
  if (status === 403) {
    throw new PortalError('portal_recusou', `O portal negou o acesso (${label}, HTTP 403).`, { status });
  }
  if (status >= 500) {
    throw new PortalError('portal_indisponivel', `O portal falhou (${label}, HTTP ${status}).`, { status });
  }
  throw new PortalError('resposta_inesperada', `Resposta HTTP ${status} inesperada em ${label}.`, { status });
}

export function parseJson(res: PortalResponse, label: string): unknown {
  try {
    return JSON.parse(res.body);
  } catch (cause) {
    throw new PortalError('resposta_inesperada', `${label} não respondeu em JSON.`, { status: res.status, cause });
  }
}

/**
 * Validates a value against a schema. Error messages carry field paths and
 * expected types only, never the received values, which may be personal data.
 */
export function validate<S extends z.ZodType>(schema: S, value: unknown, label: string): z.output<S> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const issues = result.error.issues
    .slice(0, 5)
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
  throw new PortalError('resposta_inesperada', `A resposta de ${label} não tem o formato documentado. ${issues}`, {
    cause: result.error,
  });
}

/** Unwraps `{ data, messages, length, HttpStatusCode }` and validates `data`. */
export function readEnvelope<S extends z.ZodType>(json: unknown, dataSchema: S, label: string): z.output<S> {
  const envelope = validate(envelopeSchema, json, label);
  const messages: PortalMessage[] = envelope.messages ?? [];
  const { data } = envelope;

  if (typeof data === 'object' && data !== null && RM_EXCEPTION_KEY in data) {
    const missingContext = messages.some((m) => m.detail?.toLowerCase().includes(MISSING_CONTEXT_TEXT));
    if (missingContext) {
      throw new PortalError('sem_contexto', `${label}: o portal diz que esta sessão não tem contexto acadêmico.`, {
        portalMessages: messages,
      });
    }
    throw new PortalError('erro_do_portal', `${label}: o portal retornou um erro.`, { portalMessages: messages });
  }

  return validate(dataSchema, data, label);
}
