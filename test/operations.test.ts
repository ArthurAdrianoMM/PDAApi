import { afterEach, describe, expect, it, vi } from 'vitest';
import { TAGS, operations, runOperation, type Operation } from '../src/operations/index.js';
import { listarAulas } from '../src/operations/aulas.js';
import { listarDisciplinas } from '../src/operations/disciplinas.js';
import { obterHorario } from '../src/operations/horario.js';
import { obterNotas } from '../src/operations/notas.js';
import { obterFaltas } from '../src/operations/faltas.js';
import { listarFaltasPorAula } from '../src/operations/faltas-aulas.js';
import { listarPeriodos } from '../src/operations/periodos.js';
import { CONTEXT_COOKIE, academicRoute, contextRoute, createTestSession, type DataRoute } from './support/fake-portal.js';

const CONTEXT_ID = 'ctx+B/2==';

const sessionWith = (routes: Record<string, DataRoute>) => createTestSession({ routes });

describe('operation definitions', () => {
  it.each(operations.map((op) => [op.id, op] as const))('%s: example satisfies the output schema', (_, op) => {
    expect(op.output.safeParse(op.example).success).toBe(true);
  });

  it('have unique ids and paths, and known tags', () => {
    expect(new Set(operations.map((op) => op.id)).size).toBe(operations.length);
    expect(new Set(operations.map((op) => op.path)).size).toBe(operations.length);
    const tags: readonly string[] = TAGS.map((t) => t.name);
    for (const op of operations) expect(tags).toContain(op.tag);
  });
});

describe('listarPeriodos', () => {
  it('maps the periods and marks the one the session uses', async () => {
    const { session } = sessionWith({
      'TOTVSEducacional/Periodos': academicRoute(CONTEXT_ID, [
        { CODPERLET: '2026S2', IDPERLET: 1042 },
        { CODPERLET: '2026S1', IDPERLET: 1017 },
      ]),
    });
    await expect(runOperation(listarPeriodos, session, {})).resolves.toEqual({
      periodos: [
        { codigo: '2026S2', id: 1042, selecionado: true },
        { codigo: '2026S1', id: 1017, selecionado: false },
      ],
    });
  });
});

describe('listarDisciplinas', () => {
  const row = {
    CODCOLIGADA: 1,
    RA: 'oculto',
    CODSTATUS: 1,
    DESCRICAO: 'Cursando',
    IDTURMADISC: 48230,
    IDTURMADISCORIGEM: null,
    CODTURMA: 'DS-2026-A',
    CODSUBTURMA: '',
    CODFILIAL: 1,
    CODTIPOCURSO: 2,
    CODDISC: 'BD1',
    NOME: 'Banco de Dados I',
    IDPERLET: 1042,
  };

  it('maps the fields and normalizes a blank subclass to null', async () => {
    const { session } = sessionWith({ 'TOTVSEducacional/DisciplinasAlunoPeriodoLetivo': academicRoute(CONTEXT_ID, [row]) });
    await expect(runOperation(listarDisciplinas, session, {})).resolves.toEqual({
      periodo: '2026S2',
      disciplinas: [
        {
          idTurmaDisc: 48230,
          codigo: 'BD1',
          nome: 'Banco de Dados I',
          turma: 'DS-2026-A',
          subturma: null,
          idPeriodo: 1042,
          status: { codigo: '1', descricao: 'Cursando' },
        },
      ],
    });
  });

  it('passes apenasEmCurso to the portal as mostraApenasDiscEmCurso', async () => {
    const { portal, session } = sessionWith({ 'TOTVSEducacional/DisciplinasAlunoPeriodoLetivo': academicRoute(CONTEXT_ID, []) });
    await runOperation(listarDisciplinas, session, {});
    await runOperation(listarDisciplinas, session, { apenasEmCurso: true });
    const sent = portal.requests
      .filter((r) => r.url.pathname.endsWith('DisciplinasAlunoPeriodoLetivo'))
      .map((r) => r.url.searchParams.get('mostraApenasDiscEmCurso'));
    expect(sent).toEqual(['false', 'true']);
  });

  it('rejects input of the wrong type', async () => {
    const { session } = sessionWith({});
    await expect(runOperation(listarDisciplinas, session, { apenasEmCurso: 'sim' })).rejects.toMatchObject({ name: 'ZodError' });
  });
});

describe('obterNotas', () => {
  const notas = {
    Notas: [
      {
        FILIAL: 'Unidade Exemplo',
        CODTURMA: 'DS-2026-A',
        CODDISC: 'PW2',
        DISCIPLINA: 'Programação Web II',
        SITUACAO: 'Cursando',
        IDTURMADISC: 48213,
        '3 - AV 3 / AV QT 3': null,
        '1 - AV 1 / AV QT 1': '8,5',
        '2 - AV 2 / AV QT 2': 'A',
        '4 - AV 4': ' ',
      },
    ],
  };

  it('turns the dynamic columns into assessments, in stage order', async () => {
    const { session } = sessionWith({ 'TOTVSEducacional/NotaEtapa': academicRoute(CONTEXT_ID, notas) });
    const result = await runOperation(obterNotas, session, {});

    expect(result.periodo).toBe('2026S2');
    expect(result.disciplinas).toEqual([
      {
        idTurmaDisc: 48213,
        codigo: 'PW2',
        nome: 'Programação Web II',
        turma: 'DS-2026-A',
        situacao: 'Cursando',
        avaliacoes: [
          { etapa: 1, nome: 'AV 1 / AV QT 1', valor: '8,5', nota: 8.5 },
          { etapa: 2, nome: 'AV 2 / AV QT 2', valor: 'A', nota: null },
          { etapa: 3, nome: 'AV 3 / AV QT 3', valor: null, nota: null },
          { etapa: 4, nome: 'AV 4', valor: null, nota: null },
        ],
      },
    ]);
  });

  it('reports a changed response shape without echoing the values', async () => {
    const secret = 'Nome Que Não Pode Vazar';
    const broken = { Notas: [{ ...notas.Notas[0], IDTURMADISC: secret }] };
    const { session } = sessionWith({ 'TOTVSEducacional/NotaEtapa': academicRoute(CONTEXT_ID, broken) });

    const error = await runOperation(obterNotas, session, {}).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'resposta_inesperada' });
    expect((error as Error).message).toContain('Notas.0.IDTURMADISC');
    expect((error as Error).message).not.toContain(secret);
  });
});

describe('obterFaltas', () => {
  const row = {
    Filial: 'Unidade Exemplo',
    CODTURMA: 'DS-2026-A',
    CODDISC: 'PW2',
    Disciplina: 'Programação Web II',
    Situação: 'Matriculado',
    '0 - Faltas': '8',
    PERCENTUAL: 11.11,
    IDTURMADISC: 48213,
    SITUACAOFALTAS: 4,
  };

  it('maps the totals, the stage columns and the limit legend', async () => {
    const other = { ...row, IDTURMADISC: 48230, '0 - Faltas': null, '1 - Faltas': '2', PERCENTUAL: null, SITUACAOFALTAS: 9 };
    const { session } = sessionWith({ 'TOTVSEducacional/FaltaEtapa': academicRoute(CONTEXT_ID, { FaltasEtapa: [row, other] }) });
    const result = await runOperation(obterFaltas, session, {});

    expect(result.periodo).toBe('2026S2');
    expect(result.disciplinas).toEqual([
      {
        idTurmaDisc: 48213,
        codigo: 'PW2',
        nome: 'Programação Web II',
        turma: 'DS-2026-A',
        situacao: 'Matriculado',
        percentual: 11.11,
        limite: { codigo: 4, descricao: 'Não foi possível calcular o percentual' },
        etapas: [{ etapa: 0, nome: 'Faltas', valor: '8', faltas: 8 }],
      },
      expect.objectContaining({
        idTurmaDisc: 48230,
        percentual: null,
        limite: { codigo: 9, descricao: null },
        etapas: [
          { etapa: 0, nome: 'Faltas', valor: null, faltas: null },
          { etapa: 1, nome: 'Faltas', valor: '2', faltas: 2 },
        ],
      }),
    ]);
  });

  it('sends idTurmaDisc to the portal only when given', async () => {
    const { portal, session } = sessionWith({ 'TOTVSEducacional/FaltaEtapa': academicRoute(CONTEXT_ID, { FaltasEtapa: [row] }) });
    await runOperation(obterFaltas, session, {});
    await runOperation(obterFaltas, session, { idTurmaDisc: 48213 });
    const sent = portal.requests
      .filter((r) => r.url.pathname.endsWith('FaltaEtapa'))
      .map((r) => r.url.searchParams.get('idTurmaDisc'));
    expect(sent).toEqual([null, '48213']);
  });
});

describe('listarFaltasPorAula', () => {
  const row = {
    CODCOLIGADA: 1,
    IDTURMADISC: 48213,
    IDPLANOAULA: 7310452,
    IDHORARIOTURMA: 15945342,
    AULA: 21,
    CODDISC: 'PW2',
    DISCIPLINA: 'Programação Web II',
    DATAFALTA: '2026-09-14T00:00:00',
    DATA: '2026-09-14T00:00:00',
    HORAINICIAL: '19:50',
    HORAFINAL: '20:40',
    JUSTIFICADAPERSONALIZADO: 'Não',
    ABONAFALTAPERSONALIZADO: '',
    MOTIVOPERSONALIZADO: null,
    COMPOETOTALFALTAS: null,
    PRESENCA: 'A',
    JUSTIFICADA: null,
    CODSUBTURMA: null,
    SITUACAO: 'Não justificada',
  };
  const rows = [
    row,
    { ...row, IDTURMADISC: 48230, CODDISC: 'BD1', CODSUBTURMA: 'SUBTURMA C', DATAFALTA: '2026-08-03T00:00:00', AULA: 3 },
    { ...row, AULA: 20, HORAINICIAL: '19:00', HORAFINAL: '19:50' },
  ];
  const route = () => academicRoute(CONTEXT_ID, { SFREQUENCIAALUNO: rows });
  const sentQuery = (portal: { requests: { url: URL }[] }) =>
    Object.fromEntries(portal.requests.findLast((r) => r.url.pathname.endsWith('Aluno/Falta/Aula'))!.url.searchParams);

  afterEach(() => {
    vi.useRealTimers();
  });

  it('maps the rows and sorts them by date and time', async () => {
    const { session } = sessionWith({ 'TOTVSEducacional/Aluno/Falta/Aula': route() });
    const result = await runOperation(listarFaltasPorAula, session, { de: '2026-08-01', ate: '2026-10-29' });

    expect(result).toMatchObject({ periodo: '2026S2', de: '2026-08-01', ate: '2026-10-29' });
    expect(result.faltas.map((f) => [f.data, f.horaInicial, f.aula])).toEqual([
      ['2026-08-03', '19:50', 3],
      ['2026-09-14', '19:00', 20],
      ['2026-09-14', '19:50', 21],
    ]);
    expect(result.faltas[0]).toMatchObject({ idTurmaDisc: 48230, codigo: 'BD1', subturma: 'SUBTURMA C' });
    expect(result.faltas[2]).toEqual({
      idTurmaDisc: 48213,
      codigo: 'PW2',
      disciplina: 'Programação Web II',
      subturma: null,
      data: '2026-09-14',
      aula: 21,
      horaInicial: '19:50',
      horaFinal: '20:40',
      situacao: 'Não justificada',
      justificada: 'Não',
      abono: null,
      motivo: null,
      idPlanoAula: 7310452,
    });
  });

  it('asks the portal for absences over whole local days', async () => {
    const { portal, session } = sessionWith({ 'TOTVSEducacional/Aluno/Falta/Aula': route() });
    await runOperation(listarFaltasPorAula, session, { de: '2026-08-01', ate: '2026-10-29' });
    expect(sentQuery(portal)).toEqual({
      dataDe: new Date(2026, 7, 1, 0, 0, 0, 0).toISOString(),
      dataAte: new Date(2026, 9, 29, 23, 59, 59, 999).toISOString(),
      tipoFrequencia: 'A',
    });
  });

  it('defaults to the page window: 360 days back to today', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 29, 15, 30));
    const { portal, session } = sessionWith({ 'TOTVSEducacional/Aluno/Falta/Aula': route() });

    const result = await runOperation(listarFaltasPorAula, session, {});
    expect(result).toMatchObject({ de: '2025-11-03', ate: '2026-10-29' });
    expect(sentQuery(portal).dataDe).toBe(new Date(2025, 10, 3).toISOString());
  });

  it('filters by idTurmaDisc here, without changing the portal call', async () => {
    const { portal, session } = sessionWith({ 'TOTVSEducacional/Aluno/Falta/Aula': route() });
    const result = await runOperation(listarFaltasPorAula, session, { de: '2026-08-01', ate: '2026-10-29', idTurmaDisc: 48230 });
    expect(result.faltas.map((f) => f.idTurmaDisc)).toEqual([48230]);
    expect(sentQuery(portal)).not.toHaveProperty('idTurmaDisc');
  });

  it('rejects invalid dates and a window that ends before it starts', async () => {
    const { session } = sessionWith({});
    await expect(runOperation(listarFaltasPorAula, session, { de: '2026-02-30' })).rejects.toMatchObject({ name: 'ZodError' });
    await expect(runOperation(listarFaltasPorAula, session, { de: '2026-10-29', ate: '2026-10-01' })).rejects.toMatchObject({
      name: 'ZodError',
      issues: [expect.objectContaining({ path: ['de'] })],
    });
  });
});

describe('obterHorario', () => {
  // Only the date is faked; the session's timers keep working.
  const today = (date: string) => vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(new Date(`${date}T10:00:00`));
  afterEach(() => vi.useRealTimers());

  /** A `DIASEMANA` `'0'` row, as the portal sends it: a time band and nothing else. */
  const faixa = (inicio: string, fim: string) => ({
    DIASEMANA: '0',
    HORAINICIAL: inicio,
    HORAFINAL: fim,
    CODTURMA: null,
    NOMEREDUZIDO: null,
    DATAINICIAL: null,
    DATAFINAL: null,
    CODPREDIO: null,
    CODSALA: null,
    CODDISC: null,
    NOME: null,
    IDTURMADISC: null,
    IDHORARIOTURMA: null,
    CODSUBTURMA: null,
    IMPBOLETIM: null,
    IDTURMADISCORIGEM: null,
    URLAULAONLINE: null,
    PREDIO: null,
    BLOCO: null,
    SALA: null,
  });

  const aula = (dia: string, inicio: string, fim: string, extra: Record<string, unknown> = {}) => ({
    ...faixa(inicio, fim),
    DIASEMANA: dia,
    CODTURMA: 'DS-2026-A',
    NOMEREDUZIDO: 'PW2',
    DATAINICIAL: '2026-08-03T00:00:00',
    DATAFINAL: '2026-12-18T00:00:00',
    CODDISC: 'PW2',
    NOME: 'Programação Web II',
    IDTURMADISC: 48213,
    IDHORARIOTURMA: 90121,
    IMPBOLETIM: 'S',
    PREDIO: 'PRD1 - Prédio 1',
    BLOCO: '1 - Bloco A',
    SALA: 'LAB3 - Laboratório 3',
    ...extra,
  });

  const quadro = (rows: unknown[]) => ({ SQuadroHorarioAluno: [], SHorarioAluno: rows, SDescDisc: [], SQuadroHorarioAulaOnline: [] });
  const sessionFor = (rows: unknown[]) => sessionWith({ 'TOTVSEducacional/QuadroHorarioAluno': academicRoute(CONTEXT_ID, quadro(rows)) });

  it('maps class slots, sorted by day and time, and keeps every row as a time band', async () => {
    today('2026-10-29');
    const { session } = sessionFor([
      faixa('18:30', '19:20'),
      aula('4', '18:30', '19:20', { CODSUBTURMA: 'SUBTURMA C', PREDIO: null, BLOCO: ' ', SALA: null }),
      aula('2', '19:20', '20:10', { IDHORARIOTURMA: 90122 }),
      aula('2', '18:30', '19:20'),
      faixa('20:10', '21:00'),
    ]);
    const result = await runOperation(obterHorario, session, {});

    expect(result.periodo).toBe('2026S2');
    expect(result.faixas).toEqual([
      { inicio: '18:30', fim: '19:20' },
      { inicio: '19:20', fim: '20:10' },
      { inicio: '20:10', fim: '21:00' },
    ]);
    expect(result.horarios.map((h) => [h.dia, h.inicio])).toEqual([
      ['segunda', '18:30'],
      ['segunda', '19:20'],
      ['quarta', '18:30'],
    ]);
    expect(result.horarios[0]).toEqual({
      diaSemana: 2,
      dia: 'segunda',
      inicio: '18:30',
      fim: '19:20',
      idTurmaDisc: 48213,
      idHorarioTurma: 90121,
      codigo: 'PW2',
      nome: 'Programação Web II',
      turma: 'DS-2026-A',
      subturma: null,
      local: { predio: 'PRD1 - Prédio 1', bloco: '1 - Bloco A', sala: 'LAB3 - Laboratório 3' },
      vigencia: { inicio: '2026-08-03', fim: '2026-12-18' },
      urlAulaOnline: null,
    });
    expect(result.horarios[2]).toMatchObject({ subturma: 'SUBTURMA C', local: { predio: null, bloco: null, sala: null } });
  });

  it('reads DIASEMANA with 1 as Sunday and 7 as Saturday', async () => {
    today('2026-10-29');
    const { session } = sessionFor([aula('7', '08:00', '08:50'), aula('1', '08:00', '08:50')]);
    const { horarios } = await runOperation(obterHorario, session, {});
    expect(horarios.map((h) => [h.diaSemana, h.dia])).toEqual([
      [1, 'domingo'],
      [7, 'sabado'],
    ]);
  });

  it('leaves out ended slots unless incluirEncerrados, and keeps a slot on its last day', async () => {
    const rows = [
      aula('2', '18:30', '19:20', { DATAINICIAL: '2026-08-03T00:00:00', DATAFINAL: '2026-09-30T00:00:00' }),
      aula('3', '18:30', '19:20', { DATAINICIAL: '2026-08-03T00:00:00', DATAFINAL: '2026-10-29T00:00:00' }),
      aula('4', '18:30', '19:20', { DATAINICIAL: null, DATAFINAL: null }),
    ];
    today('2026-10-29');
    const { session } = sessionFor(rows);

    const atuais = await runOperation(obterHorario, session, {});
    expect(atuais.horarios.map((h) => h.dia)).toEqual(['terca', 'quarta']);
    expect(atuais.horarios[1]!.vigencia).toBeNull();

    const todos = await runOperation(obterHorario, session, { incluirEncerrados: true });
    expect(todos.horarios.map((h) => h.dia)).toEqual(['segunda', 'terca', 'quarta']);
  });

  it('reports a class slot without its class ID, without echoing the values', async () => {
    const secret = 'Nome Que Não Pode Vazar';
    const { session } = sessionFor([aula('2', '18:30', '19:20', { IDTURMADISC: null, NOME: secret })]);
    const error = await runOperation(obterHorario, session, {}).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'resposta_inesperada' });
    expect((error as Error).message).toContain('SHorarioAluno.0.IDTURMADISC');
    expect((error as Error).message).not.toContain(secret);
  });
});

describe('periodo', () => {
  /** The smallest valid answer of each period-scoped operation's portal call. */
  const cases: { op: Operation; path: string; data: unknown }[] = [
    { op: listarDisciplinas, path: 'TOTVSEducacional/DisciplinasAlunoPeriodoLetivo', data: [] },
    { op: obterNotas, path: 'TOTVSEducacional/NotaEtapa', data: { Notas: [] } },
    { op: obterFaltas, path: 'TOTVSEducacional/FaltaEtapa', data: { FaltasEtapa: [] } },
    { op: listarFaltasPorAula, path: 'TOTVSEducacional/Aluno/Falta/Aula', data: { SFREQUENCIAALUNO: [] } },
    { op: obterHorario, path: 'TOTVSEducacional/QuadroHorarioAluno', data: { SHorarioAluno: [] } },
    { op: listarAulas, path: 'TOTVSEducacional/v1/planoaulas/aulas', data: { SPlanoAula: [] } },
  ];

  it.each(cases.map((c) => [c.op.id, c] as const))('%s answers for the period asked, with its context cookie', async (_, { op, path, data }) => {
    const { portal, session } = sessionWith({ [path]: contextRoute({ [CONTEXT_ID]: data, 'ctx+A/1==': data }) });

    await expect(runOperation(op, session, {})).resolves.toMatchObject({ periodo: '2026S2' });
    await expect(runOperation(op, session, { periodo: '2026S1' })).resolves.toMatchObject({ periodo: '2026S1' });
    const sent = portal.requests.filter((r) => r.url.pathname.endsWith(path)).map((r) => portal.cookiesOf(r).get(CONTEXT_COOKIE));
    expect(sent).toEqual([CONTEXT_ID, 'ctx+A/1==']);

    await expect(runOperation(op, session, { periodo: '1999S1' })).rejects.toMatchObject({ code: 'periodo_inexistente' });
  });
});

describe('listarAulas', () => {
  const today = (date: string) => vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(new Date(`${date}T10:00:00`));
  afterEach(() => vi.useRealTimers());

  /** One `SPlanoAula` row, as `v1/planoaulas/aulas` sent it on 2026-11-03. */
  const row = (extra: Record<string, unknown> = {}) => ({
    CODCOLIGADA: 1,
    IDHORARIOTURMA: 90121,
    DIASEMANA: 3,
    HORAINICIAL: '18:30',
    HORAFINAL: '19:20',
    CODPREDIO: 'PRD1',
    PREDIO: 'PRD1 - Prédio 1',
    CODBLOCO: '1',
    BLOCO: '1 - Bloco A',
    CODSALA: 'LAB3',
    SALA: 'LAB3 - Laboratório 3',
    DATA: '2026-11-03T00:00:00',
    AULA: 21,
    IDTURMADISC: 48213,
    TIPOFALTA: null,
    CONTEUDO: 'Rotas e middlewares.',
    CONTEUDOEFETIVO: null,
    LICAOCASA: '',
    CODTURMA: 'DS-2026-A',
    CODDISC: 'PW2',
    NOMEDISC: 'Programação Web II',
    CODSUBTURMA: '',
    CONFIRMADO: 'N',
    IDPLANOAULA: 7310452,
    TIPOAULA: 'P',
    CODHOR: 3,
    IDPERLET: 1042,
    URLAULAONLINE: '',
    FREQUENCIADISPWEB: '1',
    CODFILIAL: null,
    CODPROF: null,
    LOCACAO: null,
    HORAINICIALREALIZADO: null,
    HORAFINALREALIZADO: null,
    OBSERVACAO: null,
    ...extra,
  });
  const rows = [
    row({ IDPLANOAULA: 7310460, DATA: '2026-11-04T00:00:00', DIASEMANA: 4, HORAINICIAL: '20:20', HORAFINAL: '21:10', TIPOAULA: null }),
    row(),
    row({ IDPLANOAULA: 7311800, IDTURMADISC: 48230, CODDISC: 'BD1', HORAINICIAL: '17:30', HORAFINAL: '18:20', TIPOAULA: 'Z', CONFIRMADO: 'S', CODSUBTURMA: 'SUBTURMA C' }),
  ];
  const arquivos = [{ IDPLANOAULA: 7310452, IDMATERIALSEC: 991, ARQUIVO: 'slides.pdf', TAMANHO: 120, PATHARQUIVO: 'x' }];
  const sessionFor = (data: unknown = { SPlanoAula: rows, SPLANOAULAARQUIVO: arquivos }) =>
    sessionWith({ 'TOTVSEducacional/v1/planoaulas/aulas': academicRoute(CONTEXT_ID, data) });
  const sentQuery = (portal: { requests: { url: URL }[] }) =>
    Object.fromEntries(portal.requests.findLast((r) => r.url.pathname.endsWith('v1/planoaulas/aulas'))!.url.searchParams);

  it('maps the lessons, sorted by day and time, with their files', async () => {
    const { session } = sessionFor();
    const result = await runOperation(listarAulas, session, { de: '2026-11-03', ate: '2026-11-04' });

    expect(result).toMatchObject({ periodo: '2026S2', de: '2026-11-03', ate: '2026-11-04' });
    expect(result.aulas.map((a) => [a.data, a.inicio, a.idPlanoAula])).toEqual([
      ['2026-11-03', '17:30', 7311800],
      ['2026-11-03', '18:30', 7310452],
      ['2026-11-04', '20:20', 7310460],
    ]);
    expect(result.aulas[1]).toEqual({
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
      conteudoPrevisto: 'Rotas e middlewares.',
      conteudoEfetivo: null,
      licaoDeCasa: null,
      observacao: null,
      confirmada: false,
      local: { predio: 'PRD1 - Prédio 1', bloco: '1 - Bloco A', sala: 'LAB3 - Laboratório 3' },
      urlAulaOnline: null,
      arquivos: [{ idMaterial: 991, nome: 'slides.pdf', tamanhoKb: 120 }],
    });
    expect(result.aulas[0]).toMatchObject({ tipo: { codigo: 'Z', descricao: null }, confirmada: true, subturma: 'SUBTURMA C', arquivos: [] });
    expect(result.aulas[2]).toMatchObject({ tipo: null, dia: 'quarta' });
  });

  it('asks for noon of each day, the ordering and the encoded context ID, like the page', async () => {
    const { portal, session } = sessionFor();
    await runOperation(listarAulas, session, { de: '2026-11-03', ate: '2026-11-06' });
    expect(sentQuery(portal)).toEqual({
      dtInicial: new Date(2026, 10, 3, 12).toISOString(),
      dtFinal: new Date(2026, 10, 6, 12).toISOString(),
      orderby: 'HORAINICIAL',
      idContextoAluno: CONTEXT_ID,
    });
  });

  it('defaults to today, or to the one day given', async () => {
    today('2026-11-04');
    const { portal, session } = sessionFor({ SPlanoAula: [] });
    await expect(runOperation(listarAulas, session, {})).resolves.toMatchObject({ de: '2026-11-04', ate: '2026-11-04', aulas: [] });
    expect(sentQuery(portal).dtInicial).toBe(sentQuery(portal).dtFinal);
    await expect(runOperation(listarAulas, session, { ate: '2026-11-10' })).resolves.toMatchObject({ de: '2026-11-10', ate: '2026-11-10' });
  });

  it('filters by idTurmaDisc here, and takes a missing file list as none', async () => {
    const { portal, session } = sessionFor({ SPlanoAula: rows });
    const result = await runOperation(listarAulas, session, { de: '2026-11-03', idTurmaDisc: 48230 });
    expect(result.aulas.map((a) => a.idPlanoAula)).toEqual([7311800]);
    expect(sentQuery(portal)).not.toHaveProperty('idTurmaDisc');
  });

  it('rejects a window that ends before it starts, or is longer than 31 days', async () => {
    const { session } = sessionFor();
    await expect(runOperation(listarAulas, session, { de: '2026-11-04', ate: '2026-11-03' })).rejects.toMatchObject({
      issues: [expect.objectContaining({ path: ['de'] })],
    });
    await expect(runOperation(listarAulas, session, { de: '2026-10-01', ate: '2026-10-31' })).resolves.toBeDefined();
    await expect(runOperation(listarAulas, session, { de: '2026-10-01', ate: '2026-11-01' })).rejects.toMatchObject({
      issues: [expect.objectContaining({ path: ['ate'] })],
    });
  });
});
