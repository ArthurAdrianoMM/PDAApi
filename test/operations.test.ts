import { describe, expect, it } from 'vitest';
import { TAGS, operations, runOperation } from '../src/operations/index.js';
import { listarDisciplinas } from '../src/operations/disciplinas.js';
import { obterNotas } from '../src/operations/notas.js';
import { listarPeriodos } from '../src/operations/periodos.js';
import { academicRoute, createTestSession, type DataRoute } from './support/fake-portal.js';

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
