/**
 * Which subclass each timetable slot of a class belongs to. `v1/planoaulas/aulas`
 * lists the lessons of every subclass of a class, with a blank `CODSUBTURMA`
 * (ENDPOINTS.md 4.8); the slot IDs tell them apart. They come from
 * `MatriculaDisciplinaPorHabilitacaoFilialTurmaDisc`, which the class page calls
 * (ENDPOINTS.md 4.7).
 */
import { z } from 'zod';
import type { PortalSession } from '../core/index.js';
import { optionalCode } from '../core/schemas.js';

const infoSchema = z.looseObject({
  HorariosTurmaDiscInfo: z.array(z.looseObject({ IDHORARIOTURMA: z.number().int(), CODSUBTURMA: optionalCode })),
});

/** `IDHORARIOTURMA` → `CODSUBTURMA` for every slot of the class, of every subclass. */
export async function subturmasPorHorario(session: PortalSession, idTurmaDisc: number, periodo?: string): Promise<Map<number, string | null>> {
  const info = await session.getData(
    'TOTVSEducacional/MatriculaDisciplinaPorHabilitacaoFilialTurmaDisc',
    { idTurmaDisc },
    infoSchema,
    { periodo },
  );
  return new Map(info.HorariosTurmaDiscInfo.map((h) => [h.IDHORARIOTURMA, h.CODSUBTURMA]));
}
