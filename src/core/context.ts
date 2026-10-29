/**
 * The student's enrollment context (ENDPOINTS.md 2.4 and 4.1). `Contexto`
 * returns one record per enrollment period; the session picks one and sends its
 * `IDCONTEXTOALUNO` in the context cookie.
 */
import { z } from 'zod';
import type { PortalConfig } from './config.js';
import { PortalError } from './errors.js';
import type { PortalHttp } from './http.js';
import { assertOk, parseJson, readEnvelope } from './response.js';
import { integerLike } from './schemas.js';
import { apiUrl } from './url.js';

const contextRecordSchema = z.looseObject({
  // Opaque; the portal's JS copies it into a cookie, so it is kept as text.
  IDCONTEXTOALUNO: z.union([z.string().min(1), z.number()]).transform(String),
  CODPERLET: z.string(),
  IDPERLET: integerLike,
  DTINICIO: z.string().nullish(),
  NOMECURSO: z.string().nullish(),
});

export type ContextRecord = z.output<typeof contextRecordSchema>;

/** What the rest of the code may know about the selected enrollment. The opaque ID stays in the session. */
export interface ActiveContext {
  /** Period code, e.g. `2026S2`. */
  codPerLet: string;
  idPerLet: number;
  curso: string | null;
}

export async function listContexts(http: PortalHttp, config: PortalConfig): Promise<ContextRecord[]> {
  const label = 'Contexto';
  const res = await http.request({ method: 'GET', url: apiUrl(config.baseUrl, 'TOTVSEducacional/Contexto') });
  assertOk(res, label);
  return readEnvelope(parseJson(res, label), z.array(contextRecordSchema), label);
}

/**
 * Picks the record for `codPerLet` when given. Otherwise picks the latest
 * `DTINICIO` (the choice verified from curl in ENDPOINTS.md 2.4); records
 * without a parseable date come last, and ties keep the portal's order.
 */
export function pickContext(records: ContextRecord[], codPerLet?: string): ContextRecord {
  if (codPerLet !== undefined) {
    const match = records.find((r) => r.CODPERLET === codPerLet);
    if (!match) {
      const available = records.map((r) => r.CODPERLET).join(', ') || 'nenhum';
      throw new PortalError('configuracao_invalida', `Nenhuma matrícula no período ${codPerLet}. Disponíveis: ${available}.`);
    }
    return match;
  }

  let best: ContextRecord | undefined;
  let bestTime = Number.NEGATIVE_INFINITY;
  for (const record of records) {
    const time = record.DTINICIO ? Date.parse(record.DTINICIO) : Number.NaN;
    const comparable = Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
    if (best === undefined || comparable > bestTime) {
      best = record;
      bestTime = comparable;
    }
  }
  if (!best) throw new PortalError('sem_contexto', 'Contexto não retornou nenhuma matrícula para esta conta.');
  return best;
}

export function toActiveContext(record: ContextRecord): ActiveContext {
  return { codPerLet: record.CODPERLET, idPerLet: record.IDPERLET, curso: record.NOMECURSO ?? null };
}
