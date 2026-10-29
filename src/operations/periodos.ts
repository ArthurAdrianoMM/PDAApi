import { z } from 'zod';
import { defineOperation } from './define.js';

/** `TOTVSEducacional/Periodos`: `data[]` of `{ CODPERLET: string, IDPERLET: number }` (ENDPOINTS.md 4.3). */
const upstreamSchema = z.array(
  z.looseObject({
    CODPERLET: z.string(),
    IDPERLET: z.number().int(),
  }),
);

const periodoSchema = z.object({
  codigo: z.string().describe('Código do período, como no portal (ex.: `2026S2`).'),
  id: z.number().int().describe('ID do período no portal (`IDPERLET`).'),
  selecionado: z.boolean().describe('Se é o período da matrícula que a sessão está usando.'),
});

export const listarPeriodos = defineOperation({
  id: 'listarPeriodos',
  method: 'get',
  path: '/periodos',
  tag: 'Período',
  summary: 'Períodos',
  description:
    'Lista os períodos letivos da sua conta, na ordem em que o portal envia. ' +
    'O campo `selecionado` marca o período da matrícula que a sessão está usando.',
  callouts: [
    {
      kind: 'info',
      title: 'Qual período a sessão usa',
      body:
        'Ao entrar, a sessão escolhe a matrícula com a data de início mais recente. ' +
        'Endpoints como `/notas` respondem sobre essa matrícula.',
    },
  ],
  upstream: ['TOTVSEducacional/Periodos'],
  input: z.object({}),
  output: z.object({ periodos: z.array(periodoSchema) }),
  example: {
    periodos: [
      { codigo: '2026S2', id: 1042, selecionado: true },
      { codigo: '2026S1', id: 1017, selecionado: false },
      { codigo: '2025S2', id: 988, selecionado: false },
    ],
  },
  async handler(session) {
    const { context } = await session.ensureSession();
    const rows = await session.getData('TOTVSEducacional/Periodos', {}, upstreamSchema);
    return {
      periodos: rows.map((row) => ({
        codigo: row.CODPERLET,
        id: row.IDPERLET,
        selecionado: row.CODPERLET === context.codPerLet,
      })),
    };
  },
});
