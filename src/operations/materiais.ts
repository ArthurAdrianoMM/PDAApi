/**
 * The "Arquivos" page (`#/arquivos`): the school's materials, the student's own
 * and each class's, and their download (ENDPOINTS.md 4.9).
 */
import { z } from 'zod';
import { PortalError, type PortalSession } from '../core/index.js';
import { codeLike, integerLike, optionalCode, optionalText } from '../core/schemas.js';
import { defineFileOperation, defineOperation } from './define.js';
import { buscarDisciplina } from './disciplinas.js';
import { periodoInput, periodoOutput } from './periodo.js';

/**
 * Types for the extensions schools usually publish. The portal sends every
 * download as `application/octet-stream`; with the real type a browser can
 * open the file. HTML and scripts are never given a type that runs.
 */
const TIPOS_POR_EXTENSAO: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odp: 'application/vnd.oasis.opendocument.presentation',
  txt: 'text/plain; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  zip: 'application/zip',
};

const OCTET_STREAM = 'application/octet-stream';

function tipoDoArquivo(nome: string | null, tipoDoPortal: string): string {
  if (tipoDoPortal !== OCTET_STREAM) return tipoDoPortal;
  const extensao = nome?.split('.').pop()?.toLowerCase() ?? '';
  return TIPOS_POR_EXTENSAO[extensao] ?? OCTET_STREAM;
}

const dia = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}/)
  .nullish()
  .transform((value) => value?.slice(0, 10) ?? null);

/**
 * A material row. `Material/Institucional` types as recorded on 2026-11-03;
 * `Material` and `MateriaisTurmaDisciplina` were always empty, and the page
 * reads the same fields from them, so everything but the ID and the path is
 * optional here.
 */
const materialRowSchema = z.looseObject({
  IDMATERIALSEC: z.number().int(),
  DESCRICAO: optionalText,
  IDTIPOMATERIAL: integerLike.nullish(),
  DESCRICAOTIPOMATERIAL: optionalText,
  DATAINCLUSAO: dia,
  DATAEXPIRACAO: dia,
  DATA: dia,
  TAMANHO: integerLike.nullish(),
  ARQUIVO: optionalText,
  PATHARQUIVO: z.string().min(1),
  CODUSRAUTOR: optionalCode,
});

type MaterialRow = z.output<typeof materialRowSchema>;
type Origem = 'instituicao' | 'aluno' | 'disciplina';

const materialSchema = z.object({
  idMaterial: z.number().int().describe('ID do material (`IDMATERIALSEC`). Baixe em `/materiais/{idMaterial}/arquivo`.'),
  origem: z
    .enum(['instituicao', 'aluno', 'disciplina'])
    .describe('De onde vem: material da instituição, material só seu, ou material de uma disciplina.'),
  descricao: z.string().nullable().describe('Título do material, como o portal mostra.'),
  tipo: z.object({
    codigo: z.number().int().nullable().describe('`IDTIPOMATERIAL`.'),
    descricao: z.string().nullable().describe('O texto do portal (ex.: `Material P/ Aluno`, `Estágio`).'),
  }),
  arquivo: z.string().nullable().describe('Nome do arquivo.'),
  tamanhoKb: z.number().int().nullable().describe('Tamanho em KB (`TAMANHO`).'),
  incluidoEm: z.iso.date().nullable().describe('Dia em que foi publicado (`DATAINCLUSAO`).'),
  data: z.iso.date().nullable().describe('A data que o portal mostra com o material (`DATA`), quando há.'),
  expiraEm: z.iso.date().nullable().describe('Dia em que deixa de valer (`DATAEXPIRACAO`), ou `null`.'),
});

type Material = z.output<typeof materialSchema>;

function toMaterial(row: MaterialRow, origem: Origem): Material {
  return {
    idMaterial: row.IDMATERIALSEC,
    origem,
    descricao: row.DESCRICAO,
    tipo: { codigo: row.IDTIPOMATERIAL ?? null, descricao: row.DESCRICAOTIPOMATERIAL },
    arquivo: row.ARQUIVO,
    tamanhoKb: row.TAMANHO ?? null,
    incluidoEm: row.DATAINCLUSAO,
    data: row.DATA,
    expiraEm: row.DATAEXPIRACAO,
  };
}

const porData = (a: Material, b: Material) => (b.incluidoEm ?? '').localeCompare(a.incluidoEm ?? '') || b.idMaterial - a.idMaterial;

/** The materials the student can see without a class: the school's and their own. */
async function lerMateriaisGerais(session: PortalSession): Promise<{ row: MaterialRow; origem: Origem }[]> {
  const institucionais = await session.getData('TOTVSEducacional/Material/Institucional', {}, z.array(materialRowSchema));
  const proprios = await session.getData('TOTVSEducacional/Material', {}, z.array(materialRowSchema));
  return [
    ...institucionais.map((row) => ({ row, origem: 'instituicao' as const })),
    ...proprios.map((row) => ({ row, origem: 'aluno' as const })),
  ];
}

function lerMateriaisDaDisciplina(session: PortalSession, idTurmaDisc: number, periodo: string | undefined) {
  return session.getData('TOTVSEducacional/MateriaisTurmaDisciplina', { idTurmaDisc }, z.array(materialRowSchema), { periodo });
}

const exemplo: Material = {
  idMaterial: 3150,
  origem: 'instituicao',
  descricao: 'Calendário acadêmico 2026',
  tipo: { codigo: 2, descricao: 'Material P/ Aluno' },
  arquivo: 'Calendario academico 2026.pdf',
  tamanhoKb: 210,
  incluidoEm: '2026-02-02',
  data: null,
  expiraEm: '2026-12-31',
};

export const listarMateriais = defineOperation({
  id: 'listarMateriais',
  method: 'get',
  path: '/materiais',
  tag: 'Arquivos',
  summary: 'Materiais',
  description:
    'Lista os materiais publicados para você: os da instituição (regulamentos, calendários, manuais) e os enviados só para você, ' +
    'como a página "Arquivos" do portal. Os mais recentes vêm primeiro. Para os materiais de uma disciplina, use `/disciplinas/{idTurmaDisc}/materiais`.',
  callouts: [
    {
      kind: 'info',
      title: 'Baixar um material',
      body: '`/materiais/{idMaterial}/arquivo` devolve o arquivo. O `idMaterial` vem desta lista.',
    },
  ],
  upstream: ['TOTVSEducacional/Material/Institucional', 'TOTVSEducacional/Material'],
  input: z.object({}),
  output: z.object({ materiais: z.array(materialSchema) }),
  example: { materiais: [exemplo] },
  async handler(session) {
    const materiais = (await lerMateriaisGerais(session)).map(({ row, origem }) => toMaterial(row, origem));
    return { materiais: materiais.sort(porData) };
  },
});

const idTurmaDiscInput = z.number().int().positive().describe('ID da turma da disciplina, como em `/disciplinas`.');

export const listarMateriaisDaDisciplina = defineOperation({
  id: 'listarMateriaisDaDisciplina',
  method: 'get',
  path: '/disciplinas/{idTurmaDisc}/materiais',
  tag: 'Arquivos',
  summary: 'Materiais de uma disciplina',
  description: 'Lista os materiais que os professores publicaram numa disciplina. Os mais recentes vêm primeiro.',
  callouts: [
    {
      kind: 'warning',
      title: 'Formato ainda não visto',
      body:
        'Na conta testada, nenhuma disciplina tinha materiais, então o formato desta resposta do portal não foi registrado. ' +
        'A API lê os campos que a página do portal mostra.',
    },
    {
      kind: 'info',
      title: 'Baixar um material',
      body: '`/materiais/{idMaterial}/arquivo?idTurmaDisc={idTurmaDisc}` devolve o arquivo.',
    },
  ],
  upstream: ['TOTVSEducacional/DisciplinasAlunoPeriodoLetivo', 'TOTVSEducacional/MateriaisTurmaDisciplina'],
  input: z.object({ idTurmaDisc: idTurmaDiscInput, periodo: periodoInput }),
  output: z.object({
    periodo: periodoOutput,
    idTurmaDisc: z.number().int().describe('A disciplina pedida.'),
    materiais: z.array(materialSchema),
  }),
  example: {
    periodo: '2026S2',
    idTurmaDisc: 48213,
    materiais: [{ ...exemplo, idMaterial: 3311, origem: 'disciplina', descricao: 'Slides da aula 21', tipo: { codigo: 1, descricao: 'Material de aula' }, arquivo: 'aula21.pdf', expiraEm: null }],
  },
  async handler(session, { idTurmaDisc, periodo }) {
    const context = await session.contextFor(periodo);
    const disciplina = await buscarDisciplina(session, idTurmaDisc, periodo);
    const rows = await lerMateriaisDaDisciplina(session, disciplina.IDTURMADISC, periodo);
    return {
      periodo: context.codPerLet,
      idTurmaDisc: disciplina.IDTURMADISC,
      materiais: rows.map((row) => toMaterial(row, 'disciplina')).sort(porData),
    };
  },
});

export const baixarMaterial = defineFileOperation({
  id: 'baixarMaterial',
  method: 'get',
  path: '/materiais/{idMaterial}/arquivo',
  tag: 'Arquivos',
  summary: 'Baixar um material',
  description:
    'Devolve o arquivo de um material, como o botão de download da página "Arquivos". ' +
    'Com `idTurmaDisc`, procura também entre os materiais daquela disciplina.',
  callouts: [
    {
      kind: 'info',
      title: 'Só materiais das listas',
      body:
        'A API procura o material em `/materiais` (e na disciplina, com `idTurmaDisc`) para saber o caminho do arquivo, ' +
        'como a página faz. Um ID que não está nas listas responde 404 `item_inexistente`, sem chamar o download.',
    },
    {
      kind: 'info',
      title: 'Tipo do arquivo',
      body:
        'O portal manda todo arquivo como `application/octet-stream`. A API usa o tipo da extensão do nome (`.pdf`, `.docx`…) ' +
        'para que o navegador saiba abri-lo. O arquivo sempre vem como download.',
    },
  ],
  upstream: [
    'TOTVSEducacional/Material/Institucional',
    'TOTVSEducacional/Material',
    'TOTVSEducacional/MateriaisTurmaDisciplina',
    'TOTVSEducacional/Material/Download',
  ],
  input: z.object({
    idMaterial: z.number().int().positive().describe('ID do material, como em `/materiais`.'),
    idTurmaDisc: z.number().int().positive().optional().describe('A disciplina do material, para um material de disciplina.'),
    periodo: periodoInput,
  }),
  file: {
    mediaTypes: [...new Set([OCTET_STREAM, ...Object.values(TIPOS_POR_EXTENSAO).map((type) => type.split(';')[0]!)])],
    description: 'O arquivo, com o nome dele em `Content-Disposition`.',
  },
  async handler(session, { idMaterial, idTurmaDisc, periodo }) {
    const candidatos = (await lerMateriaisGerais(session)).map(({ row }) => row);
    if (idTurmaDisc !== undefined) {
      const disciplina = await buscarDisciplina(session, idTurmaDisc, periodo);
      candidatos.push(...(await lerMateriaisDaDisciplina(session, disciplina.IDTURMADISC, periodo)));
    }
    const material = candidatos.find((row) => row.IDMATERIALSEC === idMaterial);
    if (!material) {
      throw new PortalError('item_inexistente', `O material ${idMaterial} não está em /materiais${idTurmaDisc ? ' nem na disciplina' : ''}.`);
    }

    // The page builds the link from these two fields (arquivo.factory.js, ENDPOINTS.md 4.9).
    const file = await session.getFile(
      'TOTVSEducacional/Material/Download',
      { idMaterialSec: material.IDMATERIALSEC, pathArquivo: material.PATHARQUIVO },
      { periodo },
    );
    const nome = material.ARQUIVO ?? file.filename;
    return { nome, tipo: tipoDoArquivo(nome, file.contentType), conteudo: file.bytes };
  },
});
