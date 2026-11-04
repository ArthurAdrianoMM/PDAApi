import { z } from 'zod';
import { codeLike, optionalCode, optionalText } from '../core/schemas.js';
import { defineOperation } from './define.js';

/** `data.Avaliacao[]` (ENDPOINTS.md 4.4). Types as recorded on 2026-11-03. */
const upstreamSchema = z.looseObject({
  Avaliacao: z.array(
    z.looseObject({
      ID: z.number().int(),
      CODPROVA: codeLike,
      IDEXECPROVA: codeLike,
      OBJETOAVALIADO: optionalText,
      DESCRICAO: optionalText,
      NOMECURSO: optionalText,
      NOMEDISCIPLINA: optionalText,
      NOMEPROFESSOR: optionalText,
      CODCURSO: optionalCode,
      CODTURMA: optionalCode,
    }),
  ),
});

const avaliacaoSchema = z.object({
  id: z.number().int().describe('`ID` da avaliação na lista do portal.'),
  questionario: z.string().describe('Código do questionário (`CODPROVA`).'),
  aplicacao: z.string().describe('Código da aplicação do questionário (`IDEXECPROVA`), o que o portal usa para abri-lo.'),
  objeto: z.string().nullable().describe('O que se avalia, como o portal escreve (ex.: `Professor`, `Curso`).'),
  avaliado: z.string().nullable().describe('Quem ou o que se avalia: o nome do professor ou do curso (`DESCRICAO`).'),
  professor: z.string().nullable().describe('O professor, nas avaliações de professor.'),
  disciplina: z.string().nullable().describe('A disciplina, nas avaliações de professor.'),
  turma: z.string().nullable().describe('A turma (`CODTURMA`), nas avaliações de professor.'),
  curso: z.object({
    codigo: z.string().nullable().describe('`CODCURSO`, nas avaliações de curso.'),
    nome: z.string().nullable(),
  }),
});

export const listarAvaliacoesInstitucionais = defineOperation({
  id: 'listarAvaliacoesInstitucionais',
  method: 'get',
  path: '/avaliacoes-institucionais',
  tag: 'Institucional',
  summary: 'Avaliações institucionais',
  description:
    'Lista as avaliações institucionais disponíveis para você responder: dos professores de cada disciplina e do curso, ' +
    'como a página "Avaliação Institucional" do portal.',
  callouts: [
    {
      kind: 'info',
      title: 'Responder é no portal',
      body:
        'O portal abre cada questionário num outro sistema, com um login próprio, e grava as respostas. ' +
        'Esta API só lê, então responda pela página do portal.',
    },
    {
      kind: 'info',
      title: 'Só o seu curso',
      body:
        'Como a página, a lista deixa de fora as avaliações de outro curso: fica uma avaliação sem curso, ou do curso da matrícula da sessão. ' +
        'Na conta testada, a resposta do portal foi a mesma em todos os períodos.',
    },
  ],
  upstream: ['TOTVSEducacional/AvaliacoesInstitucionais'],
  input: z.object({
    objeto: z.string().trim().min(1).optional().describe('Só as avaliações deste objeto (ex.: `Professor`), como o filtro da página.'),
  }),
  output: z.object({ avaliacoes: z.array(avaliacaoSchema) }),
  example: {
    avaliacoes: [
      {
        id: 1,
        questionario: 'F149IES_2026.2',
        aplicacao: '73F1',
        objeto: 'Professor',
        avaliado: 'Professora Exemplo',
        professor: 'Professora Exemplo',
        disciplina: 'Programação Web II',
        turma: 'DS-2026-A',
        curso: { codigo: null, nome: null },
      },
      {
        id: 2,
        questionario: 'F014IES_2026',
        aplicacao: '73F9',
        objeto: 'Curso',
        avaliado: 'Desenvolvimento de Sistemas',
        professor: null,
        disciplina: null,
        turma: null,
        curso: { codigo: 'DS', nome: 'Desenvolvimento de Sistemas' },
      },
    ],
  },
  async handler(session, { objeto }) {
    const { context } = await session.ensureSession();
    const { Avaliacao } = await session.getData('TOTVSEducacional/AvaliacoesInstitucionais', {}, upstreamSchema);

    const avaliacoes = Avaliacao
      // The page keeps an evaluation without a course, or of the course of the current context (avaliacoes-institucionais-list.controller.js).
      .filter((a) => !a.CODCURSO || a.CODCURSO === context.codCurso)
      .filter((a) => objeto === undefined || a.OBJETOAVALIADO === objeto)
      .map((a) => ({
        id: a.ID,
        questionario: a.CODPROVA,
        aplicacao: a.IDEXECPROVA,
        objeto: a.OBJETOAVALIADO,
        avaliado: a.DESCRICAO,
        professor: a.NOMEPROFESSOR,
        disciplina: a.NOMEDISCIPLINA,
        turma: a.CODTURMA,
        curso: { codigo: a.CODCURSO, nome: a.NOMECURSO },
      }));

    return { avaliacoes };
  },
});
