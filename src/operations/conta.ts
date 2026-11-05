/**
 * Who is logged in: the profile and the photo the portal shows in its header
 * (ENDPOINTS.md 4.1, 4.2).
 */
import { z } from 'zod';
import { PortalError, type PortalSession } from '../core/index.js';
import { optionalCode, optionalText } from '../core/schemas.js';
import { defineFileOperation, defineOperation } from './define.js';

const dia = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}/)
  .nullish()
  .transform((value) => value?.slice(0, 10) ?? null);

/** The fields of `Contexto` records this operation shows. The opaque context ID is never read here. */
const matriculaRowSchema = z.looseObject({
  CODPERLET: z.string(),
  DTINICIO: dia,
  RA: optionalCode,
  EMAIL: optionalText,
  CODCURSO: optionalCode,
  NOMECURSO: optionalText,
  NOMEHABILITACAO: optionalText,
  NOMEMATRIZ: optionalText,
  NOMETURNO: optionalText,
  NOMEFILIAL: optionalText,
  NOMETIPOCURSO: optionalText,
  SITMATHABILITACAO: optionalText,
  SITMATPERLET: optionalText,
});

/** `InformacoesPessoaisBasicas`: the name and the photo, raw base64 (a PNG here). */
const informacoesSchema = z.array(z.looseObject({ NOME: optionalText, IMAGEM: z.string().nullish() }));

function lerInformacoes(session: PortalSession) {
  return session.getData('TOTVSEducacional/Aluno/InformacoesPessoaisBasicas', {}, informacoesSchema);
}

export const obterPerfil = defineOperation({
  id: 'obterPerfil',
  method: 'get',
  path: '/eu',
  tag: 'Conta',
  summary: 'Seu perfil',
  description:
    'Retorna quem está logado: nome, login, e-mail e RA, a matrícula que a sessão está usando (curso, habilitação, turno, unidade e situação) ' +
    'e todas as matrículas da conta. A foto fica em `/eu/foto`.',
  callouts: [
    {
      kind: 'info',
      title: 'Dados pessoais',
      body:
        'Estes são os seus dados, como o portal os mostra para você. O servidor local não os guarda nem os registra no terminal; ' +
        'cuidado ao copiar a resposta para outro lugar.',
    },
  ],
  upstream: ['TOTVSEducacional/Contexto', 'TOTVSEducacional/Aluno/InformacoesPessoaisBasicas'],
  input: z.object({}),
  output: z.object({
    nome: z.string().describe('Seu nome, como o portal mostra no topo da página.'),
    login: z.string().describe('O usuário com que você entra no portal.'),
    email: z.string().nullable().describe('O e-mail da matrícula da sessão.'),
    ra: z.string().nullable().describe('Seu RA.'),
    temFoto: z.boolean().describe('Se o portal tem uma foto sua (veja `/eu/foto`).'),
    matricula: z
      .object({
        periodo: z.string().describe('Código do período (ex.: `2026S2`).'),
        inicio: z.iso.date().nullable().describe('Início do período.'),
        curso: z.object({
          codigo: z.string().nullable().describe('`CODCURSO`.'),
          nome: z.string().nullable(),
          habilitacao: z.string().nullable(),
          matriz: z.string().nullable().describe('A matriz (grade) curricular.'),
          tipo: z.string().nullable().describe('Tipo do curso, como o portal escreve.'),
        }),
        turno: z.string().nullable(),
        unidade: z.string().nullable().describe('A unidade (filial) da matrícula.'),
        situacao: z.object({
          curso: z.string().nullable().describe('Situação no curso (`SITMATHABILITACAO`, ex.: `Matriculado`).'),
          periodo: z.string().nullable().describe('Situação no período (`SITMATPERLET`).'),
        }),
      })
      .describe('A matrícula que a sessão está usando.'),
    matriculas: z
      .array(
        z.object({
          periodo: z.string().describe('Código do período. Serve como `periodo` nos outros endpoints.'),
          inicio: z.iso.date().nullable(),
          curso: z.string().nullable(),
          situacao: z.string().nullable().describe('Situação no período.'),
          selecionada: z.boolean().describe('Se é a matrícula da sessão.'),
        }),
      )
      .describe('Todas as matrículas da conta, na ordem do portal.'),
  }),
  example: {
    nome: 'Aluno Exemplo da Silva',
    login: 'aluno.exemplo',
    email: 'aluno.exemplo@example.test',
    ra: '0000000000',
    temFoto: true,
    matricula: {
      periodo: '2026S2',
      inicio: '2026-07-27',
      curso: {
        codigo: 'DS',
        nome: 'Desenvolvimento de Sistemas',
        habilitacao: 'Técnico em Desenvolvimento de Sistemas',
        matriz: 'Matriz 2023',
        tipo: 'Educação Profissional',
      },
      turno: 'Noite',
      unidade: 'Unidade Exemplo',
      situacao: { curso: 'Matriculado', periodo: 'Matriculado' },
    },
    matriculas: [
      { periodo: '2026S2', inicio: '2026-07-27', curso: 'Desenvolvimento de Sistemas', situacao: 'Matriculado', selecionada: true },
      { periodo: '2026S1', inicio: '2026-02-02', curso: 'Desenvolvimento de Sistemas', situacao: 'Matriculado', selecionada: false },
    ],
  },
  async handler(session) {
    const { user, context } = await session.ensureSession();
    const matriculas = await session.getData('TOTVSEducacional/Contexto', {}, z.array(matriculaRowSchema));
    const [info] = await lerInformacoes(session);
    const atual = matriculas.find((m) => m.CODPERLET === context.codPerLet);
    if (!atual) throw new PortalError('sem_contexto', 'Contexto não trouxe a matrícula que a sessão está usando.');

    return {
      nome: info?.NOME ?? user.username,
      login: user.login,
      email: atual.EMAIL,
      ra: atual.RA,
      temFoto: Boolean(info?.IMAGEM?.trim()),
      matricula: {
        periodo: atual.CODPERLET,
        inicio: atual.DTINICIO,
        curso: {
          codigo: atual.CODCURSO,
          nome: atual.NOMECURSO,
          habilitacao: atual.NOMEHABILITACAO,
          matriz: atual.NOMEMATRIZ,
          tipo: atual.NOMETIPOCURSO,
        },
        turno: atual.NOMETURNO,
        unidade: atual.NOMEFILIAL,
        situacao: { curso: atual.SITMATHABILITACAO, periodo: atual.SITMATPERLET },
      },
      matriculas: matriculas.map((m) => ({
        periodo: m.CODPERLET,
        inicio: m.DTINICIO,
        curso: m.NOMECURSO,
        situacao: m.SITMATPERLET,
        selecionada: m.CODPERLET === context.codPerLet,
      })),
    };
  },
});

/** Image formats by their first bytes. */
const ASSINATURAS: { tipo: string; extensao: string; confere: (b: Uint8Array) => boolean }[] = [
  { tipo: 'image/png', extensao: 'png', confere: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { tipo: 'image/jpeg', extensao: 'jpg', confere: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { tipo: 'image/gif', extensao: 'gif', confere: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 },
  {
    tipo: 'image/webp',
    extensao: 'webp',
    confere: (b) => String.fromCharCode(...b.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...b.subarray(8, 12)) === 'WEBP',
  },
  { tipo: 'image/bmp', extensao: 'bmp', confere: (b) => b[0] === 0x42 && b[1] === 0x4d },
];

const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

/** The photo's bytes. `IMAGEM` was raw base64; a `data:` prefix is accepted too. */
function decodificarFoto(imagem: string): Uint8Array<ArrayBuffer> {
  const base64 = imagem.replace(/^data:[^,]*,/, '').replace(/\s+/g, '');
  if (!BASE64.test(base64) || base64.length % 4 === 1) {
    throw new PortalError('resposta_inesperada', 'A foto em InformacoesPessoaisBasicas não está em base64.');
  }
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

export const baixarFoto = defineFileOperation({
  id: 'baixarFoto',
  method: 'get',
  path: '/eu/foto',
  tag: 'Conta',
  summary: 'Sua foto',
  description: 'Devolve a foto do seu cadastro, a mesma que o portal mostra no topo da página, como uma imagem.',
  callouts: [
    {
      kind: 'info',
      title: 'Sem foto',
      body: 'Quando o portal não tem foto sua, a resposta é 404 `item_inexistente`. `temFoto` em `/eu` diz antes se há uma.',
    },
  ],
  upstream: ['TOTVSEducacional/Aluno/InformacoesPessoaisBasicas'],
  input: z.object({}),
  file: {
    mediaTypes: [...ASSINATURAS.map((a) => a.tipo), 'application/octet-stream'],
    description: 'A imagem. O tipo vem dos primeiros bytes dela: na conta testada, PNG.',
  },
  async handler(session) {
    const [info] = await lerInformacoes(session);
    if (!info?.IMAGEM?.trim()) throw new PortalError('item_inexistente', 'O portal não tem uma foto sua.');
    const conteudo = decodificarFoto(info.IMAGEM);
    const formato = ASSINATURAS.find((a) => a.confere(conteudo));
    return { nome: `foto.${formato?.extensao ?? 'bin'}`, tipo: formato?.tipo ?? 'application/octet-stream', conteudo };
  },
});

