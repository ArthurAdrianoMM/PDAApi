import { z } from 'zod';
import { codeLike, integerLike, optionalText } from '../core/schemas.js';
import { hoje, somarDias } from './dates.js';
import { defineOperation } from './define.js';

/** The page's default view is a month; without dates the API shows the next 30 days. */
const JANELA_PADRAO_DIAS = 30;

/** `LABEL` codes (`eduEnumsConsts.TipoEventoCalendario`), with the page's legend texts. */
const TIPOS = [
  { codigo: 0, nome: 'matricula_presencial', descricao: 'Matrícula presencial' },
  { codigo: 1, nome: 'matricula_portal', descricao: 'Matrícula pelo portal' },
  { codigo: 2, nome: 'limite_trancamento', descricao: 'Limite de trancamento' },
  { codigo: 3, nome: 'avaliacao', descricao: 'Avaliações' },
  { codigo: 4, nome: 'atividade_inscrita', descricao: 'Atividades inscritas' },
  { codigo: 5, nome: 'aula', descricao: 'Aula' },
  { codigo: 6, nome: 'entrega_trabalho', descricao: 'Entrega de trabalho' },
  { codigo: 7, nome: 'licao_de_casa', descricao: 'Lição de casa' },
] as const;

type NomeTipo = (typeof TIPOS)[number]['nome'];
const NOMES = TIPOS.map((t) => t.nome) as [NomeTipo, ...NomeTipo[]];

/** `YYYY-MM-DDTHH:mm:ss`, local wall time with no zone (the page shows it as is). */
const dataHora = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/).transform((value) => value.slice(0, 19));

/** `UNTIL = 2025-8-05T09:50:0`: unpadded numbers, as the portal writes them. */
const UNTIL = /UNTIL\s*=\s*(\d{4})-(\d{1,2})-(\d{1,2})T(\d{1,2}):(\d{1,2}):(\d{1,2})/;

/** `data.APPOINTMENTS[]` (ENDPOINTS.md 4.6). Types as recorded on 2026-11-03. */
const upstreamSchema = z.looseObject({
  APPOINTMENTS: z.array(
    z.looseObject({
      ID: z.number().int(),
      LABEL: integerLike,
      STARTTIME: dataHora,
      ENDTIME: dataHora,
      ALLDAY: z.boolean().nullish(),
      SUBJECT: optionalText,
      DESCRIPTION: optionalText,
      RECURRENCEINFO: optionalText,
      IDTURMADISC: z.number().int().nullish(),
      IDPLANOAULA: z.number().int().nullish(),
      CODETAPA: integerLike.nullish(),
      CODPROVA: integerLike.nullish(),
      IDOFERTA: codeLike.nullish(),
    }),
  ),
});

type Appointment = z.output<typeof upstreamSchema>['APPOINTMENTS'][number];

/** The rule's `UNTIL` as `YYYY-MM-DDTHH:mm:ss`, or `null` when the rule has none. */
function until(rule: string | null): string | null {
  const m = rule ? UNTIL.exec(rule) : null;
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const p = (v: string | undefined) => v!.padStart(2, '0');
  return `${y}-${p(mo)}-${p(d)}T${p(h)}:${p(mi)}:${p(s)}`;
}

/**
 * The rule only when it repeats the event. Every rule seen ends (`UNTIL`) at
 * the event's own end, so the event happens once and the rule says nothing.
 */
function recorrencia(item: Appointment): { regra: string; ate: string | null } | null {
  if (!item.RECURRENCEINFO) return null;
  const fim = until(item.RECURRENCEINFO);
  if (fim !== null && fim <= item.ENDTIME) return null;
  return { regra: item.RECURRENCEINFO, ate: fim };
}

const eventoSchema = z.object({
  id: z.number().int().describe('ID do evento no calendário (`ID`).'),
  tipo: z.object({
    codigo: z.number().int().describe('`LABEL` do portal: 0 a 7.'),
    nome: z.enum(NOMES).nullable().describe('O mesmo tipo como nome, para filtrar com `tipo`; `null` para um código desconhecido.'),
    descricao: z.string().nullable().describe('O texto da legenda do portal.'),
  }),
  titulo: z.string().nullable().describe('Título do evento, como o portal escreve (`SUBJECT`).'),
  descricao: z.string().nullable().describe('Descrição, como o portal escreve (`DESCRIPTION`); nas aulas, o local.'),
  inicio: z.string().describe('Início, `AAAA-MM-DDTHH:mm:ss` no horário local, sem fuso.'),
  fim: z.string().describe('Fim, no mesmo formato.'),
  diaInteiro: z.boolean().describe('Se o evento ocupa o dia todo (`ALLDAY`).'),
  idTurmaDisc: z.number().int().nullable().describe('Disciplina do evento. Combina com `/disciplinas`.'),
  idPlanoAula: z.number().int().nullable().describe('Aula do evento. Combina com `/aulas`.'),
  codEtapa: z.number().int().nullable().describe('Etapa, nos eventos de avaliação.'),
  codProva: z.number().int().nullable().describe('Prova, nos eventos de avaliação.'),
  idOferta: z.string().nullable().describe('Oferta, nos eventos de atividades inscritas.'),
  recorrencia: z
    .object({
      regra: z.string().describe('A regra como o portal envia (`RECURRENCEINFO`). Não é expandida.'),
      ate: z.string().nullable().describe('O fim da repetição (`UNTIL`), `AAAA-MM-DDTHH:mm:ss`.'),
    })
    .nullable()
    .describe('A regra de repetição, só quando o evento se repete; `null` num evento único.'),
});

type Evento = z.output<typeof eventoSchema>;

function toEvento(item: Appointment): Evento {
  const tipo = TIPOS.find((t) => t.codigo === item.LABEL);
  return {
    id: item.ID,
    tipo: { codigo: item.LABEL, nome: tipo?.nome ?? null, descricao: tipo?.descricao ?? null },
    titulo: item.SUBJECT,
    descricao: item.DESCRIPTION,
    inicio: item.STARTTIME,
    fim: item.ENDTIME,
    diaInteiro: item.ALLDAY ?? false,
    idTurmaDisc: item.IDTURMADISC ?? null,
    idPlanoAula: item.IDPLANOAULA ?? null,
    codEtapa: item.CODETAPA ?? null,
    codProva: item.CODPROVA ?? null,
    idOferta: item.IDOFERTA ?? null,
    recorrencia: recorrencia(item),
  };
}

export const listarEventosDoCalendario = defineOperation({
  id: 'listarEventosDoCalendario',
  method: 'get',
  path: '/calendario',
  tag: 'Rotina',
  summary: 'Calendário',
  description:
    'Lista os eventos do calendário do aluno numa janela de datas: aulas, avaliações, entregas de trabalho, ' +
    'lições de casa e prazos de matrícula, como a página "Calendário" do portal. Sem datas, traz os próximos 30 dias. ' +
    'Os eventos vêm em ordem de início.',
  callouts: [
    {
      kind: 'info',
      title: 'Uma chamada, o calendário inteiro',
      body:
        'O portal manda o calendário todo de uma vez, sem filtro de data, de todos os períodos. A API recebe tudo e ' +
        'devolve só os eventos que tocam a janela pedida, então qualquer janela custa o mesmo ao portal. ' +
        'Por isso este endpoint não tem `periodo`: a resposta do portal é a mesma para todas as matrículas.',
    },
    {
      kind: 'info',
      title: 'Na conta testada, só aulas',
      body:
        'Todos os 1206 eventos da conta testada eram aulas (`tipo.nome` `aula`). Os outros tipos vêm da legenda da página ' +
        'do portal e não foram vistos numa resposta.',
    },
    {
      kind: 'info',
      title: 'Horários e repetição',
      body:
        '`inicio` e `fim` são o horário local, sem fuso, como o portal manda. Cada evento visto acontece uma vez: ' +
        'a regra de repetição do portal termina no próprio evento, e aí `recorrencia` é `null`.',
    },
  ],
  upstream: ['TOTVSEducacional/Aluno/CalendarioAluno'],
  input: z
    .object({
      de: z.iso.date().optional().describe('Primeiro dia (AAAA-MM-DD). Padrão: hoje, ou 30 dias antes de `ate`.'),
      ate: z.iso.date().optional().describe('Último dia (AAAA-MM-DD). Padrão: 30 dias depois de `de`.'),
      tipo: z.enum(NOMES).optional().describe('Só eventos deste tipo.'),
      idTurmaDisc: z.number().int().positive().optional().describe('Só eventos desta disciplina.'),
    })
    .refine(({ de, ate }) => de === undefined || ate === undefined || de <= ate, {
      path: ['de'],
      message: '`de` precisa ser igual ou anterior a `ate`.',
    }),
  output: z.object({
    de: z.iso.date().describe('Primeiro dia da janela usada.'),
    ate: z.iso.date().describe('Último dia da janela usada.'),
    eventos: z.array(eventoSchema),
  }),
  example: {
    de: '2026-11-04',
    ate: '2026-12-04',
    eventos: [
      {
        id: 412,
        tipo: { codigo: 5, nome: 'aula', descricao: 'Aula' },
        titulo: 'Aula: Programação Web II (DS-2026-A)',
        descricao: 'Prédio: PRD1 - Prédio 1 Bloco: 1 - Bloco A Sala: LAB3 - Laboratório 3',
        inicio: '2026-11-04T18:30:00',
        fim: '2026-11-04T19:20:00',
        diaInteiro: false,
        idTurmaDisc: 48213,
        idPlanoAula: 7310452,
        codEtapa: null,
        codProva: null,
        idOferta: null,
        recorrencia: null,
      },
    ],
  },
  async handler(session, input) {
    const de = input.de ?? (input.ate ? somarDias(input.ate, -JANELA_PADRAO_DIAS) : hoje());
    const ate = input.ate ?? somarDias(de, JANELA_PADRAO_DIAS);
    // No parameters: the page loads the whole calendar and the scheduler shows a window of it (ENDPOINTS.md 4.6).
    const { APPOINTMENTS } = await session.getData('TOTVSEducacional/Aluno/CalendarioAluno', {}, upstreamSchema);

    const eventos = APPOINTMENTS.map(toEvento)
      .filter((evento) => {
        const ultimo = (evento.recorrencia?.ate ?? evento.fim).slice(0, 10);
        return evento.inicio.slice(0, 10) <= ate && ultimo >= de;
      })
      .filter((evento) => input.tipo === undefined || evento.tipo.nome === input.tipo)
      .filter((evento) => input.idTurmaDisc === undefined || evento.idTurmaDisc === input.idTurmaDisc)
      .sort((a, b) => a.inicio.localeCompare(b.inicio) || a.id - b.id);

    return { de, ate, eventos };
  },
});
