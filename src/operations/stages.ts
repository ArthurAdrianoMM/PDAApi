import { z } from 'zod';

/**
 * `NotaEtapa` and `FaltaEtapa` send one column per stage, named like
 * `1 - AV 1 / AV QT 1` or `0 - Faltas` (ENDPOINTS.md 4.3). Every column with
 * this shape is a stage.
 */
const STAGE_COLUMN = /^(\d+)\s*-\s*(.+)$/;
const NUMERIC_VALUE = /^-?\d+(?:[.,]\d+)?$/;
const stageValue = z.union([z.string(), z.number(), z.null()]);

export interface StageColumn {
  etapa: number;
  nome: string;
  /** The value as text, or `null` when empty. */
  valor: string | null;
  /** `valor` as a number when it is numeric (comma or point), else `null`. */
  numero: number | null;
}

/**
 * Reads the stage columns of one row, in stage order. A value that is not a
 * string, number or null is reported on `ctx` under its column name.
 */
export function readStageColumns(row: Record<string, unknown>, ctx: z.RefinementCtx): StageColumn[] {
  const columns: StageColumn[] = [];
  for (const [column, value] of Object.entries(row)) {
    const match = STAGE_COLUMN.exec(column);
    if (!match) continue;
    const parsed = stageValue.safeParse(value);
    if (!parsed.success) {
      ctx.addIssue({ code: 'custom', path: [column], message: 'Expected a string, a number or null.', input: value });
      continue;
    }
    columns.push(toStageColumn(Number(match[1]), match[2]!.trim(), parsed.data));
  }
  return columns.sort((a, b) => a.etapa - b.etapa);
}

function toStageColumn(etapa: number, nome: string, raw: string | number | null): StageColumn {
  if (typeof raw === 'number') return { etapa, nome, valor: String(raw), numero: raw };
  const valor = raw?.trim() || null;
  const numero = valor !== null && NUMERIC_VALUE.test(valor) ? Number(valor.replace(',', '.')) : null;
  return { etapa, nome, valor, numero };
}
