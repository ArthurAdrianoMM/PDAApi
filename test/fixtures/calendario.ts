/**
 * A made-up `Aluno/CalendarioAluno` answer. The lessons have the shape recorded
 * on 2026-11-03 (ENDPOINTS.md 4.6): a weekly rule that ends at the lesson
 * itself. The other types, and a rule that really repeats, were not seen; they
 * follow the page's code. Shared by the operation tests and the fake server.
 */
const evento = (id: number, label: string, inicio: string, fim: string, extra: Record<string, unknown> = {}) => ({
  ID: id,
  EVENTTYPE: 1,
  RECURRENCEINFO: ` FREQ = WEEKLY ; WKST = TU; UNTIL = ${fim.replace(/-0(\d)-/, '-$1-').replace(/:0(\d)$/, ':$1')}`,
  STARTTIME: inicio,
  ENDTIME: fim,
  SUBJECT: 'Aula: Programação Web II (DS-2026-A)',
  DESCRIPTION: 'Prédio: PRD1 - Prédio 1 Bloco: 1 - Bloco A Sala: LAB3 - Laboratório 3',
  ALLDAY: false,
  LABEL: label,
  IDTURMADISC: 48213,
  IDPLANOAULA: 7310000 + id,
  CODETAPA: null,
  CODPROVA: null,
  IDOFERTA: null,
  ...extra,
});

export const CALENDARIO = {
  APPOINTMENTS: [
    evento(2, '5', '2026-11-10T18:30:00', '2026-11-10T19:20:00'),
    evento(0, '5', '2026-11-03T18:30:00', '2026-11-03T19:20:00'),
    evento(1, '5', '2026-11-03T19:20:00', '2026-11-03T20:10:00', { IDTURMADISC: 48230, IDPLANOAULA: 7311807, SUBJECT: 'Aula: Banco de Dados I (DS-2026-A)', DESCRIPTION: '' }),
    evento(3, '3', '2026-11-12T00:00:00', '2026-11-12T23:59:00', { SUBJECT: 'Prova: AV 2', DESCRIPTION: '', ALLDAY: true, IDPLANOAULA: null, CODETAPA: 2, CODPROVA: 1, RECURRENCEINFO: '' }),
    evento(4, '9', '2026-12-01T08:00:00', '2026-12-01T09:00:00', { SUBJECT: 'Evento', IDTURMADISC: null, IDPLANOAULA: null, RECURRENCEINFO: null }),
    // A rule that repeats past the event: kept while the repetition touches the window.
    evento(5, '7', '2026-10-01T08:00:00', '2026-10-01T09:00:00', { SUBJECT: 'Lição de casa', RECURRENCEINFO: ' FREQ = WEEKLY ; WKST = TH; UNTIL = 2026-11-26T09:00:0', IDPLANOAULA: null }),
  ],
};
