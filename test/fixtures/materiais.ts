/**
 * Made-up material lists and a download, in the shapes recorded on 2026-11-03
 * (ENDPOINTS.md 4.9). Shared by the operation tests and the fake server.
 */
const material = (id: number, extra: Record<string, unknown> = {}) => ({
  DESCRICAO: 'Calendário acadêmico 2026',
  DESCRICAOTIPOMATERIAL: 'Material P/ Aluno',
  IDMATERIALSEC: id,
  IDTIPOMATERIAL: 2,
  TIPOUSUARIO: 3,
  DATAEXPIRACAO: '2026-12-31T00:00:00',
  DATAINCLUSAO: '2026-02-02T10:15:00',
  CODUSRAUTOR: 'secretaria',
  TIPOUSUARIOORIGEM: 'S',
  TAMANHO: 45,
  ARQUIVO: 'Calendário acadêmico 2026 (versão 2).pdf',
  PATHARQUIVO: 'Calendário acadêmico 2026 (versão 2).pdf',
  ...extra,
});

/** `Material/Institucional`. */
export const MATERIAIS_INSTITUCIONAIS = [
  material(3150),
  material(3201, { DESCRICAO: 'Regulamento de estágio', DESCRICAOTIPOMATERIAL: 'Estágio', IDTIPOMATERIAL: 4, DATAEXPIRACAO: null, DATAINCLUSAO: '2026-03-10T08:00:00', TAMANHO: 120, ARQUIVO: 'Regulamento.docx', PATHARQUIVO: 'Regulamento.docx' }),
];

/** `MateriaisTurmaDisciplina` for class 48213. Never seen with items: fields from the page's view. */
export const MATERIAIS_DISCIPLINA = [
  { IDMATERIALSEC: 3311, DESCRICAO: 'Slides da aula 21', DESCRICAOTIPOMATERIAL: 'Material de aula', DATAINCLUSAO: '2026-11-03T21:00:00', DATA: '2026-11-03T00:00:00', ARQUIVO: 'aula21.pdf', PATHARQUIVO: 'aula21.pdf', TAMANHO: 900 },
];

/** The first bytes of a PDF, standing in for a download. */
export const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x35]);

/** `Material/Download`: the file, as `application/octet-stream`, its name as an RFC 2047 word. */
export function downloadResponse(): Response {
  return new Response(PDF, {
    headers: {
      'content-type': 'application/octet-stream',
      'content-disposition': 'attachment; filename="=?utf-8?B?Q2FsZW5kw6FyaW8gYWNhZMOqbWljbyAyMDI2ICh2ZXJzw6NvIDIpLnBkZg==?="',
    },
  });
}
