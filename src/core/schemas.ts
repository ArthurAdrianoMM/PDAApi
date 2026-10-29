/**
 * Field schemas for portal responses. ENDPOINTS.md records the type of some
 * fields only; where it does not, these accept the plausible JSON forms and
 * normalize them, instead of assuming one.
 */
import { z } from 'zod';

/** A number, or a string of digits, as a number. */
export const integerLike = z.union([z.number().int(), z.string().regex(/^-?\d+$/).transform(Number)]);

/** A code sent as a string or a number, as a string. */
export const codeLike = z.union([z.string(), z.number()]).transform(String);

/** An optional code: `null`, missing or blank becomes `null`. */
export const optionalCode = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((value) => (value === null || value === undefined || String(value).trim() === '' ? null : String(value)));
