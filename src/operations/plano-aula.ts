/**
 * A lesson of the lesson plan (`SPlanoAula` rows), as `v1/planoaulas/aulas`
 * and `PlanoAula/Aula` send it (ENDPOINTS.md 4.7, 4.8). Shared by the lesson
 * operations so that a lesson reads the same everywhere.
 */
import { z } from 'zod';
import { codeLike, integerLike, optionalCode, optionalText } from '../core/schemas.js';
import { diaDaSemana, DIAS } from './dates.js';

/** `TIPOAULA` codes, with the texts of the `#/plano-aula` page. Blank or null means not informed. */
const TIPOS_AULA: Record<string, string> = {
  T: 'Aula teórica',
  P: 'Aula prática',
  L: 'Laboratório',
  E: 'Estágio',
  X: 'Extensão',
};

const hora = z.string().regex(/^\d{2}:\d{2}$/);

/** `YYYY-MM-DDTHH:mm:ss` without a zone, as the day it names. */
const dia = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T/)
  .transform((value) => value.slice(0, 10));

/** Types as recorded on 2026-11-03 for `v1/planoaulas/aulas`. Texts are plain text, sometimes with line breaks. */
export const planoAulaRowSchema = z.looseObject({
  IDPLANOAULA: z.number().int(),
  IDTURMADISC: z.number().int(),
  IDHORARIOTURMA: z.number().int().nullish(),
  CODDISC: codeLike,
  NOMEDISC: z.string(),
  CODTURMA: codeLike,
  CODSUBTURMA: optionalCode,
  DATA: dia,
  DIASEMANA: integerLike.pipe(z.number().min(1).max(7)),
  AULA: integerLike.nullish(),
  HORAINICIAL: hora,
  HORAFINAL: hora,
  TIPOAULA: optionalText,
  CONTEUDO: optionalText,
  CONTEUDOEFETIVO: optionalText,
  LICAOCASA: optionalText,
  OBSERVACAO: optionalText,
  CONFIRMADO: optionalText,
  PREDIO: optionalText,
  BLOCO: optionalText,
  SALA: optionalText,
  URLAULAONLINE: optionalText,
});

export type PlanoAulaRow = z.output<typeof planoAulaRowSchema>;

/**
 * `SPLANOAULAARQUIVO` / `SPlanoAulaArquivo` items. Always empty so far, so the
 * types are not recorded; these are the fields the page reads, all optional.
 */
export const arquivoRowSchema = z.looseObject({
  IDPLANOAULA: integerLike.nullish(),
  IDMATERIALSEC: integerLike.nullish(),
  ARQUIVO: optionalText,
  TAMANHO: z.union([z.number(), z.string().regex(/^\d+(?:[.,]\d+)?$/).transform((v) => Number(v.replace(',', '.')))]).nullish(),
});

export type ArquivoRow = z.output<typeof arquivoRowSchema>;

const arquivoSchema = z.object({
  idMaterial: z.number().int().nullable().describe('ID do material (`IDMATERIALSEC`).'),
  nome: z.string().nullable().describe('Nome do arquivo.'),
  tamanhoKb: z.number().nullable().describe('Tamanho em KB, como a página do portal mostra.'),
});

export const aulaSchema = z.object({
  idPlanoAula: z.number().int().describe('ID da aula no plano de aulas. Combina com `idPlanoAula` de `/faltas/aulas`.'),
  idTurmaDisc: z.number().int().describe('ID da turma da disciplina. Combina com `/disciplinas`.'),
  idHorarioTurma: z.number().int().nullable().describe('ID do horário na turma. Combina com `/horario`.'),
  codigo: z.string().describe('Código da disciplina (`CODDISC`).'),
  disciplina: z.string().describe('Nome da disciplina.'),
  turma: z.string().describe('Código da turma (`CODTURMA`).'),
  subturma: z.string().nullable().describe('Código da subturma, ou `null` quando não há.'),
  data: z.iso.date().describe('Dia da aula (AAAA-MM-DD).'),
  diaSemana: z.number().int().min(1).max(7).describe('Dia da semana na numeração do portal: `1` é domingo… `7` sábado.'),
  dia: z.enum(DIAS).describe('O mesmo dia por extenso, sem acento.'),
  aula: z.number().int().nullable().describe('Número da aula na disciplina (`AULA`).'),
  inicio: z.string().describe('Hora de início, `HH:mm`.'),
  fim: z.string().describe('Hora de fim, `HH:mm`.'),
  tipo: z
    .object({
      codigo: z.string().describe('`TIPOAULA` do portal: `T`, `P`, `L`, `E` ou `X`.'),
      descricao: z.string().nullable().describe('O texto da página do portal para o código, ou `null` se o código for outro.'),
    })
    .nullable()
    .describe('Tipo da aula, ou `null` quando o portal não informa.'),
  conteudoPrevisto: z.string().nullable().describe('"Conteúdo previsto" no portal (`CONTEUDO`). Texto puro.'),
  conteudoEfetivo: z.string().nullable().describe('"Conteúdo efetivo", o que foi dado (`CONTEUDOEFETIVO`). Texto puro.'),
  licaoDeCasa: z.string().nullable().describe('"Lição de casa" (`LICAOCASA`).'),
  observacao: z.string().nullable().describe('Observação do professor (`OBSERVACAO`).'),
  confirmada: z.boolean().nullable().describe('`CONFIRMADO` do portal: `S` é `true`, `N` é `false`; outro valor, `null`.'),
  local: z.object({
    predio: z.string().nullable().describe('Prédio, como o portal envia.'),
    bloco: z.string().nullable().describe('Bloco, como o portal envia.'),
    sala: z.string().nullable().describe('Sala, como o portal envia.'),
  }),
  urlAulaOnline: z.string().nullable().describe('Link da aula online, quando há.'),
  arquivos: z.array(arquivoSchema).describe('Arquivos que o professor anexou à aula.'),
});

export type Aula = z.output<typeof aulaSchema>;

export function toAula(row: PlanoAulaRow, arquivos: ArquivoRow[]): Aula {
  return {
    idPlanoAula: row.IDPLANOAULA,
    idTurmaDisc: row.IDTURMADISC,
    idHorarioTurma: row.IDHORARIOTURMA ?? null,
    codigo: row.CODDISC,
    disciplina: row.NOMEDISC,
    turma: row.CODTURMA,
    subturma: row.CODSUBTURMA,
    data: row.DATA,
    diaSemana: row.DIASEMANA,
    dia: diaDaSemana(row.DIASEMANA),
    aula: row.AULA ?? null,
    inicio: row.HORAINICIAL,
    fim: row.HORAFINAL,
    tipo: row.TIPOAULA ? { codigo: row.TIPOAULA, descricao: TIPOS_AULA[row.TIPOAULA] ?? null } : null,
    conteudoPrevisto: row.CONTEUDO,
    conteudoEfetivo: row.CONTEUDOEFETIVO,
    licaoDeCasa: row.LICAOCASA,
    observacao: row.OBSERVACAO,
    confirmada: row.CONFIRMADO === 'S' ? true : row.CONFIRMADO === 'N' ? false : null,
    local: { predio: row.PREDIO, bloco: row.BLOCO, sala: row.SALA },
    urlAulaOnline: row.URLAULAONLINE,
    arquivos: arquivos
      .filter((arquivo) => arquivo.IDPLANOAULA === row.IDPLANOAULA)
      .map((arquivo) => ({ idMaterial: arquivo.IDMATERIALSEC ?? null, nome: arquivo.ARQUIVO, tamanhoKb: arquivo.TAMANHO ?? null })),
  };
}

/** The example lesson of the docs. Made up. */
export const AULA_EXEMPLO: Aula = {
  idPlanoAula: 7310452,
  idTurmaDisc: 48213,
  idHorarioTurma: 90121,
  codigo: 'PW2',
  disciplina: 'Programação Web II',
  turma: 'DS-2026-A',
  subturma: null,
  data: '2026-11-03',
  diaSemana: 3,
  dia: 'terca',
  aula: 21,
  inicio: '18:30',
  fim: '19:20',
  tipo: { codigo: 'P', descricao: 'Aula prática' },
  conteudoPrevisto: 'Rotas e middlewares no servidor.',
  conteudoEfetivo: 'Rotas, middlewares e tratamento de erros.',
  licaoDeCasa: null,
  observacao: null,
  confirmada: false,
  local: { predio: 'PRD1 - Prédio 1', bloco: '1 - Bloco A', sala: 'LAB3 - Laboratório 3' },
  urlAulaOnline: null,
  arquivos: [],
};
