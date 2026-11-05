import { z } from 'zod';

/**
 * The `periodo` input of the operations that answer for one enrollment. The
 * session sends that enrollment's context cookie with the request, which is
 * how the portal tells enrollments apart (ENDPOINTS.md 2.4).
 */
export const periodoInput = z
  .string()
  .trim()
  .min(1)
  .optional()
  .describe('Código do período, como em `/periodos` (ex.: `2026S1`). Padrão: o período da matrícula da sessão.');

export const periodoOutput = z.string().describe('Código do período respondido (ex.: `2026S2`).');
