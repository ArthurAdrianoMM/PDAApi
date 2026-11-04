/**
 * Calendar days as the API uses them: `AAAA-MM-DD` text in this machine's
 * time zone, which is the student's. The portal reads the instants it gets
 * as dates in its own (Brazilian) time zone (ENDPOINTS.md 4.3, 4.8).
 */

/** `DIASEMANA` as the portal's pages read it: `1` is Sunday, `7` Saturday (ENDPOINTS.md 4.3). */
export const DIAS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'] as const;

export type Dia = (typeof DIAS)[number];

/** The weekday name of a portal `DIASEMANA` (1 to 7). */
export const diaDaSemana = (diaSemana: number): Dia => DIAS[diaSemana - 1]!;

const pad = (n: number) => String(n).padStart(2, '0');

export const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Today in this machine's time zone. */
export const hoje = () => localDate(new Date());

/** `AAAA-MM-DD` as a local `Date` at the given time. */
export function at(date: string, hours: number, minutes = 0, seconds = 0, ms = 0): Date {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  return new Date(year, month - 1, day, hours, minutes, seconds, ms);
}

/** The day `dias` days after `date` (before, when negative). */
export function somarDias(date: string, dias: number): string {
  const d = at(date, 12);
  d.setDate(d.getDate() + dias);
  return localDate(d);
}

/** Days from `de` to `ate`, both counted: the same day is 1. */
export function diasEntre(de: string, ate: string): number {
  return Math.round((at(ate, 12).getTime() - at(de, 12).getTime()) / 86_400_000) + 1;
}
