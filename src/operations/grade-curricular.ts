import { z } from 'zod';
import { codeLike, optionalCode, optionalDecimal, optionalText } from '../core/schemas.js';
import { defineOperation } from './define.js';
import { periodoInput, periodoOutput } from './periodo.js';

/** `STATUSENUM`, as the page's tabs use it. `0` marks rows that are only text of the page (ENDPOINTS.md 4.5). */
const SITUACOES = { 1: 'em_curso', 2: 'pendente', 3: 'concluida' } as const;

/** `TIPOENUM`, with the names of the page's filters. */
const TIPOS: Record<number, string> = {
  1: 'Obrigatórias',
  2: 'Equivalentes',
  3: 'Eletivas/Optativas',
  4: 'Atividades curriculares',
  5: 'Extras',
};

/** The page's header row of a modality inside a curricular component: `CODDISC` `-1`, text `Modalidade: …`. */
const MODALIDADE = /^Modalidade:\s*(.+)$/;

/** `APRESENTACAOHISTORICO` rows. Numbers come as text with a decimal comma (`"375,0000"`). */
const rowSchema = z.looseObject({
  CODPERIODO: z.number().int(),
  CODGRUPO: z.string(),
  CODDISC: z.string(),
  DISCIPLINA: z.string(),
  STATUS: optionalText,
  PLETIVO: optionalCode,
  CONCEITO: optionalText,
  NOTA: z.string().nullish(),
  FALTAS: z.union([z.string().regex(/^\s*\d*\s*$/), z.number().int(), z.null()]).optional(),
  NUMCREDITOS: optionalDecimal,
  CH: optionalDecimal,
  CHINTEGRALIZADA: optionalDecimal,
  IDTURMADISC: z.number().int().nullish(),
  IDPERLET: z.number().int().nullish(),
  STATUSENUM: z.number().int(),
  TIPOENUM: z.number().int(),
});

const habilitacaoSchema = z.looseObject({
  CODSTATUS: codeLike,
  NOMESTATUS: optionalText,
  DTINGRESSO: z.string().regex(/^\d{4}-\d{2}-\d{2}/).nullish(),
  NOMETIPOINGRESSO: optionalText,
  NOMECURSO: z.string(),
  NOMEHABILITACAO: optionalText,
  NOMEGRADE: optionalText,
  NOMETURNO: optionalText,
  CODCURSO: codeLike,
  CR: optionalDecimal,
  MEDIAGLOBAL: optionalDecimal,
  TOTCHCURSO: optionalDecimal,
  TOTCHINTEGRALIZADA: optionalDecimal,
  TOTCHCONCLUIDA: optionalDecimal,
  CARGAHORARIAGRADE: optionalDecimal,
  POSSUIEXTENSAO: optionalText,
  QTDTOTALDISCOBR: optionalDecimal,
  QTDCONCDISCOBR: optionalDecimal,
  QTDPENDDISCOBR: optionalDecimal,
  // What the optional, elective and activity counts measure, as the page labels them (e.g. `Carga horária`).
  TIPOCONTDISCOPT: optionalText,
  QTDTOTALDISCOPT: optionalDecimal,
  QTDCONCDISCOPT: optionalDecimal,
  QTDPENDDISCOPT: optionalDecimal,
  TIPOCONTDISCELE: optionalText,
  QTDTOTALDISCELE: optionalDecimal,
  QTDCONCDISCELE: optionalDecimal,
  QTDPENDDISCELE: optionalDecimal,
  TIPOCONTATVCUR: optionalText,
  QTDTOTALATVCUR: optionalDecimal,
  QTDCONCATVCUR: optionalDecimal,
  QTDPENDATVCUR: optionalDecimal,
  QTDTOTALEXTENSAO: optionalDecimal,
  QTDCONCEXTENSAO: optionalDecimal,
  QTDPENDEXTENSAO: optionalDecimal,
});

/** `data` of `GradeCurricular/EnsinoSuperior` (ENDPOINTS.md 4.5). The TCC lists are left out: empty here, shapes not recorded. */
const upstreamSchema = z.looseObject({
  SHabilitacaoAluno: z.array(habilitacaoSchema).min(1),
  APRESENTACAOHISTORICO: z.array(rowSchema),
});

const contagemSchema = z
  .object({
    medida: z
      .string()
      .nullable()
      .describe('O que os números medem, como o portal escreve: `Número` de disciplinas, ou `Carga horária` em horas.'),
    total: z.number().nullable(),
    concluidas: z.number().nullable(),
    pendentes: z.number().nullable(),
  })
  .describe('Um quadro do resumo do portal; `null` nos números que o portal não informa.');

const disciplinaSchema = z.object({
  codigo: z.string().nullable().describe('Código da disciplina (`CODDISC`), ou `null` em atividades sem código.'),
  nome: z.string().describe('Nome da disciplina ou da atividade.'),
  situacao: z
    .enum(['em_curso', 'pendente', 'concluida'])
    .describe('A aba do portal em que ela aparece (`STATUSENUM`). Uma disciplina cancelada é `pendente`.'),
  status: z.string().nullable().describe('O texto do portal (ex.: `Aprovado`, `Matriculado`, `Cancelado`), ou `null` se ainda não foi cursada.'),
  periodo: z.string().nullable().describe('Período em que foi cursada (`PLETIVO`, ex.: `2025S1`), ou `null`.'),
  nota: z.number().nullable().describe('Nota final como número, ou `null` sem nota.'),
  conceito: z.string().nullable().describe('Conceito, quando a escola usa conceitos.'),
  faltas: z.number().int().nullable().describe('Total de faltas, ou `null`.'),
  creditos: z.number().nullable().describe('Créditos (`NUMCREDITOS`).'),
  cargaHoraria: z.number().nullable().describe('Carga horária da disciplina, em horas.'),
  cargaHorariaIntegralizada: z.number().nullable().describe('Carga horária já integralizada, em horas.'),
  modalidade: z.string().nullable().describe('Modalidade da atividade curricular (ex.: `1.1 Monitoria`); `null` nas disciplinas.'),
  idTurmaDisc: z.number().int().nullable().describe('ID da turma da disciplina em que foi cursada. Combina com `/disciplinas`.'),
  idPeriodo: z.number().int().nullable().describe('ID do período em que foi cursada. Combina com `/periodos`.'),
});

const grupoSchema = z.object({
  codigo: z.number().int().describe('`CODPERIODO` do portal: o semestre da grade (`1`, `2`…) ou um código de grupo (`97`, `98`, `100`).'),
  nome: z.string().describe('Nome do grupo, como o portal mostra (ex.: `1° Semestre`, `Eletivas/Optativas`).'),
  tipo: z.object({
    codigo: z.number().int().describe('`TIPOENUM`: 1 obrigatórias, 2 equivalentes, 3 eletivas/optativas, 4 atividades curriculares, 5 extras.'),
    descricao: z.string().nullable().describe('O nome do filtro do portal para o código.'),
  }),
  cargaHorariaIntegralizada: z.number().describe('Soma de `cargaHorariaIntegralizada` das disciplinas do grupo.'),
  disciplinas: z.array(disciplinaSchema),
});

type Grupo = z.output<typeof grupoSchema>;
type Row = z.output<typeof rowSchema>;

function toDisciplina(row: Row, modalidade: string | null): Grupo['disciplinas'][number] {
  const nota = optionalDecimal.safeParse(row.NOTA);
  const faltas = typeof row.FALTAS === 'string' ? row.FALTAS.trim() : row.FALTAS;
  return {
    codigo: row.CODDISC.trim() || null,
    nome: row.DISCIPLINA,
    situacao: SITUACOES[row.STATUSENUM as keyof typeof SITUACOES],
    status: row.STATUS,
    periodo: row.PLETIVO,
    nota: nota.success ? nota.data : null,
    conceito: row.CONCEITO,
    faltas: faltas === '' || faltas === null || faltas === undefined ? null : Number(faltas),
    creditos: row.NUMCREDITOS,
    cargaHoraria: row.CH,
    cargaHorariaIntegralizada: row.CHINTEGRALIZADA,
    modalidade,
    idTurmaDisc: row.IDTURMADISC ?? null,
    idPeriodo: row.IDPERLET ?? null,
  };
}

/** Groups the rows in the portal's order and keeps only disciplines and activities, as the page's tabs do. */
function toGrupos(rows: Row[]): Grupo[] {
  const grupos = new Map<number, Grupo>();
  let modalidade: string | null = null;
  for (const row of rows) {
    let grupo = grupos.get(row.CODPERIODO);
    if (!grupo) {
      // The page strips `&nbsp;` from group names (grade-curricular-list.controller.js).
      const nome = row.CODGRUPO.replace(/&nbsp;/g, '').trim();
      grupo = { codigo: row.CODPERIODO, nome, tipo: { codigo: row.TIPOENUM, descricao: TIPOS[row.TIPOENUM] ?? null }, cargaHorariaIntegralizada: 0, disciplinas: [] };
      grupos.set(row.CODPERIODO, grupo);
      modalidade = null;
    }
    const header = MODALIDADE.exec(row.DISCIPLINA);
    if (row.STATUSENUM === 0) {
      // Totals, "none" messages and modality headers: text of the page, not disciplines.
      if (header) modalidade = header[1]!.trim();
      continue;
    }
    if (!(row.STATUSENUM in SITUACOES)) continue;
    grupo.disciplinas.push(toDisciplina(row, row.TIPOENUM === 4 ? modalidade : null));
    grupo.cargaHorariaIntegralizada += row.CHINTEGRALIZADA ?? 0;
  }
  return [...grupos.values()];
}

export const obterGradeCurricular = defineOperation({
  id: 'obterGradeCurricular',
  method: 'get',
  path: '/grade-curricular',
  tag: 'Desempenho',
  summary: 'Grade curricular e histórico',
  description:
    'Retorna a grade curricular do curso com o histórico de cada disciplina: em que período foi cursada, ' +
    'nota, faltas, carga horária e situação (em curso, pendente ou concluída), agrupadas por semestre da grade, ' +
    'como a página "Grade curricular" do portal. Traz também o resumo do curso: carga horária integralizada, ' +
    'média global e as quantidades de disciplinas concluídas e pendentes.',
  callouts: [
    {
      kind: 'info',
      title: 'Situação e status',
      body:
        '`situacao` diz em que aba do portal a disciplina aparece: `em_curso`, `pendente` ou `concluida`. ' +
        '`status` é o texto do portal. Uma disciplina cancelada volta a ser `pendente`; uma ainda não cursada é `pendente` com `status` `null`.',
    },
    {
      kind: 'info',
      title: 'A grade é do curso',
      body:
        'A grade e o histórico são do curso, não de um semestre: na conta testada, todos os períodos trouxeram a mesma grade. ' +
        '`periodo` só muda a resposta quando escolhe uma matrícula de outro curso.',
    },
    {
      kind: 'info',
      title: 'Linhas que são só texto',
      body:
        'A resposta do portal mistura as disciplinas com linhas de texto da página, como totais e "não existem disciplinas". ' +
        'Elas ficam de fora; o total de cada grupo vem calculado em `cargaHorariaIntegralizada`.',
    },
    {
      kind: 'info',
      title: 'Números',
      body:
        'O portal manda cargas horárias, créditos e notas como texto com vírgula (`375,0000`). Aqui eles vêm como números. ' +
        'No `resumo`, `medida` diz o que cada quadro conta: as obrigatórias contam disciplinas; os outros quadros, na conta testada, horas.',
    },
  ],
  upstream: ['TOTVSEducacional/GradeCurricular/EnsinoSuperior'],
  input: z.object({
    situacao: z
      .enum(['em_curso', 'pendente', 'concluida'])
      .optional()
      .describe('Só as disciplinas nesta situação, como as abas do portal. Grupos que ficarem vazios saem.'),
    periodo: periodoInput,
  }),
  output: z.object({
    periodo: periodoOutput,
    curso: z.object({
      codigo: z.string().describe('Código do curso (`CODCURSO`).'),
      nome: z.string().describe('Nome do curso.'),
      habilitacao: z.string().nullable().describe('Habilitação (`NOMEHABILITACAO`).'),
      grade: z.string().nullable().describe('Nome da grade curricular (matriz).'),
      turno: z.string().nullable().describe('Turno.'),
    }),
    situacao: z.object({
      codigo: z.string().describe('`CODSTATUS` da matrícula no curso.'),
      descricao: z.string().nullable().describe('O texto do portal (ex.: `Matriculado`).'),
    }),
    ingresso: z.object({
      data: z.iso.date().nullable().describe('Data de ingresso no curso.'),
      forma: z.string().nullable().describe('Forma de ingresso, como o portal envia.'),
    }),
    cr: z.number().nullable().describe('Coeficiente de rendimento, quando a escola calcula.'),
    mediaGlobal: z.number().nullable().describe('Média global do curso.'),
    cargaHoraria: z.object({
      curso: z.number().nullable().describe('Carga horária total do curso, em horas.'),
      grade: z.number().nullable().describe('Carga horária da grade, em horas.'),
      integralizada: z.number().nullable().describe('Carga horária integralizada até agora.'),
      concluida: z.number().nullable().describe('Carga horária concluída até agora.'),
    }),
    resumo: z.object({
      obrigatorias: contagemSchema,
      optativas: contagemSchema,
      eletivas: contagemSchema,
      atividadesCurriculares: contagemSchema,
      extensao: contagemSchema.nullable().describe('Atividades de extensão, ou `null` quando o curso não tem.'),
    }),
    grupos: z.array(grupoSchema).describe('Os grupos da grade, na ordem do portal: semestres, depois equivalentes, eletivas e componentes.'),
  }),
  example: {
    periodo: '2026S2',
    curso: { codigo: 'DS', nome: 'Desenvolvimento de Sistemas', habilitacao: 'Técnico em Desenvolvimento de Sistemas', grade: 'Matriz 2023', turno: 'Noite' },
    situacao: { codigo: '20', descricao: 'Matriculado' },
    ingresso: { data: '2023-02-06', forma: 'Processo seletivo' },
    cr: null,
    mediaGlobal: 8.4,
    cargaHoraria: { curso: 1200, grade: 1200, integralizada: 640, concluida: 640 },
    resumo: {
      obrigatorias: { medida: 'Número', total: 20, concluidas: 11, pendentes: 9 },
      optativas: { medida: 'Carga horária', total: 0, concluidas: 0, pendentes: 0 },
      eletivas: { medida: 'Carga horária', total: 0, concluidas: 0, pendentes: 0 },
      atividadesCurriculares: { medida: 'Carga horária', total: 60, concluidas: 40, pendentes: 20 },
      extensao: null,
    },
    grupos: [
      {
        codigo: 1,
        nome: '1° Semestre',
        tipo: { codigo: 1, descricao: 'Obrigatórias' },
        cargaHorariaIntegralizada: 60,
        disciplinas: [
          {
            codigo: 'LP1',
            nome: 'Lógica de Programação',
            situacao: 'concluida',
            status: 'Aprovado',
            periodo: '2023S1',
            nota: 8.5,
            conceito: null,
            faltas: 4,
            creditos: 60,
            cargaHoraria: 60,
            cargaHorariaIntegralizada: 60,
            modalidade: null,
            idTurmaDisc: 40112,
            idPeriodo: 2351,
          },
        ],
      },
    ],
  },
  async handler(session, { situacao, periodo }) {
    const context = await session.contextFor(periodo);
    const data = await session.getData('TOTVSEducacional/GradeCurricular/EnsinoSuperior', {}, upstreamSchema, { periodo });
    const h = data.SHabilitacaoAluno[0]!;

    const grupos = toGrupos(data.APRESENTACAOHISTORICO)
      .map((grupo) => (situacao ? { ...grupo, disciplinas: grupo.disciplinas.filter((d) => d.situacao === situacao) } : grupo))
      .filter((grupo) => !situacao || grupo.disciplinas.length > 0);

    return {
      periodo: context.codPerLet,
      curso: { codigo: h.CODCURSO, nome: h.NOMECURSO, habilitacao: h.NOMEHABILITACAO, grade: h.NOMEGRADE, turno: h.NOMETURNO },
      situacao: { codigo: h.CODSTATUS, descricao: h.NOMESTATUS },
      ingresso: { data: h.DTINGRESSO?.slice(0, 10) ?? null, forma: h.NOMETIPOINGRESSO },
      cr: h.CR,
      mediaGlobal: h.MEDIAGLOBAL,
      cargaHoraria: { curso: h.TOTCHCURSO, grade: h.CARGAHORARIAGRADE, integralizada: h.TOTCHINTEGRALIZADA, concluida: h.TOTCHCONCLUIDA },
      resumo: {
        // The page labels the mandatory count `Número` and the others with their TIPOCONT* text.
        obrigatorias: { medida: 'Número', total: h.QTDTOTALDISCOBR, concluidas: h.QTDCONCDISCOBR, pendentes: h.QTDPENDDISCOBR },
        optativas: { medida: h.TIPOCONTDISCOPT, total: h.QTDTOTALDISCOPT, concluidas: h.QTDCONCDISCOPT, pendentes: h.QTDPENDDISCOPT },
        eletivas: { medida: h.TIPOCONTDISCELE, total: h.QTDTOTALDISCELE, concluidas: h.QTDCONCDISCELE, pendentes: h.QTDPENDDISCELE },
        atividadesCurriculares: { medida: h.TIPOCONTATVCUR, total: h.QTDTOTALATVCUR, concluidas: h.QTDCONCATVCUR, pendentes: h.QTDPENDATVCUR },
        extensao:
          h.POSSUIEXTENSAO === 'S'
            ? { medida: null, total: h.QTDTOTALEXTENSAO, concluidas: h.QTDCONCEXTENSAO, pendentes: h.QTDPENDEXTENSAO }
            : null,
      },
      grupos,
    };
  },
});
