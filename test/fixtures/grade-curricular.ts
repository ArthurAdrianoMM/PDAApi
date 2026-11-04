/**
 * A made-up `GradeCurricular/EnsinoSuperior` answer with the row kinds recorded
 * on 2026-11-03 (ENDPOINTS.md 4.5): disciplines in each situation, the page's
 * text rows (totals, "none" messages, modality headers) and an activity.
 * Shared by the operation tests and the fake server.
 */
const linha = (extra: Record<string, unknown>) => ({
  CODPERIODO: 1,
  CODGRUPO: '1° Semestre',
  CODDISC: '',
  DISCIPLINA: '',
  STATUS: '',
  PLETIVO: '',
  CONCEITO: null,
  NOTA: null,
  FALTAS: '',
  NUMCREDITOS: null,
  CH: null,
  IMG: 'img_branco.PNG',
  NEGRITO: null,
  ITALICO: null,
  IDTURMADISC: null,
  IDPERLET: null,
  CHEXTENSAO: null,
  DECIMAIS: 1,
  CHINTEGRALIZADA: null,
  STATUSENUM: 0,
  TIPOENUM: 1,
  ...extra,
});

const cursada = (extra: Record<string, unknown>) =>
  linha({ STATUS: 'Aprovado', PLETIVO: '2023S1', CONCEITO: '', NOTA: '8,5', FALTAS: '4', NUMCREDITOS: '60,0000', CH: '60,0000', CHINTEGRALIZADA: '60,0000', IMG: 'img_concluida.PNG', IDTURMADISC: 40112, IDPERLET: 2351, STATUSENUM: 3, ...extra });

export const GRADE_CURRICULAR = {
  SHabilitacaoAluno: [
    {
      CODCOLIGADA: 1, RA: 'oculto', CODSTATUS: 20, NOMESTATUS: 'Matriculado', DTINGRESSO: '2023-02-06T00:00:00', NOMETIPOINGRESSO: 'Processo seletivo',
      NOMECURSO: 'Desenvolvimento de Sistemas', NOMEHABILITACAO: 'Técnico em Desenvolvimento de Sistemas', NOMEGRADE: 'Matriz 2023', NOMETURNO: 'Noite',
      CODCURSO: 'DS', CR: null, MEDIAGLOBAL: 8.4, TOTCHCURSO: 1200, TOTCHINTEGRALIZADA: 160, TOTCHCONCLUIDA: 160, CARGAHORARIAGRADE: '1.200,0000',
      POSSUIEXTENSAO: 'N', QTDTOTALDISCOBR: 4, QTDCONCDISCOBR: 2, QTDPENDDISCOBR: 2,
      TIPOCONTDISCOPT: 'Carga horária', QTDTOTALDISCOPT: 0, QTDCONCDISCOPT: 0, QTDPENDDISCOPT: 0,
      TIPOCONTDISCELE: 'Carga horária', QTDTOTALDISCELE: 0, QTDCONCDISCELE: 0, QTDPENDDISCELE: 0,
      TIPOCONTATVCUR: 'Carga horária', QTDTOTALATVCUR: 60, QTDCONCATVCUR: 40, QTDPENDATVCUR: 20,
      QTDTOTALEXTENSAO: 0, QTDCONCEXTENSAO: 0, QTDPENDEXTENSAO: 0,
    },
  ],
  SDiscEquivConcluidas: [],
  SDiscEquivEmCurso: [],
  SDisciplinaTCC: [],
  SDisciplinaTCCOrientador: [],
  SDisciplinaTCCBanca: [],
  SDisciplinaTCCDisciplinaGrade: [],
  APRESENTACAOHISTORICO: [
    cursada({ CODDISC: 'LP1', DISCIPLINA: 'Lógica de Programação' }),
    cursada({ CODDISC: 'IC1', DISCIPLINA: 'Introdução à Computação', NOTA: '7,0', FALTAS: '0', NUMCREDITOS: '100,0000', CH: '100,0000', CHINTEGRALIZADA: '100,0000', IDTURMADISC: 40113 }),
    linha({ CODDISC: 'totCHIntegralizada', DISCIPLINA: 'Total CH integralizada: 160,0000' }),
    cursada({ CODPERIODO: 2, CODGRUPO: '2° Semestre', CODDISC: 'PW2', DISCIPLINA: 'Programação Web II', STATUS: 'Matriculado', PLETIVO: '2026S2', NOTA: null, FALTAS: '6', CHINTEGRALIZADA: null, IMG: 'img_naoconcluida.PNG', IDTURMADISC: 48213, IDPERLET: 1042, STATUSENUM: 1 }),
    cursada({ CODPERIODO: 2, CODGRUPO: '2° Semestre', CODDISC: 'BD1', DISCIPLINA: 'Banco de Dados I', STATUS: 'Cancelado', PLETIVO: '2025S2', NOTA: null, FALTAS: '2', CHINTEGRALIZADA: null, IMG: 'img_naoconcluida.PNG', IDTURMADISC: 45001, IDPERLET: 988, STATUSENUM: 2 }),
    linha({ CODPERIODO: 2, CODGRUPO: '2° Semestre', CODDISC: 'ES1', DISCIPLINA: 'Engenharia de Software', CH: '80,0000', NUMCREDITOS: '80,0000', IMG: 'img_pendente.PNG', IDTURMADISC: 48240, IDPERLET: 1042, STATUSENUM: 2 }),
    linha({ CODPERIODO: 2, CODGRUPO: '2° Semestre', CODDISC: 'totCHIntegralizada', DISCIPLINA: 'Total CH integralizada: 0,0000' }),
    linha({ CODPERIODO: 98, CODGRUPO: 'Eletivas/Optativas&nbsp;', CODDISC: 'Não existem disciplinas eletivas/optativas', TIPOENUM: 3, NOTA: '' }),
    linha({ CODPERIODO: 100, CODGRUPO: 'Componente curricular: ATIVIDADES COMPLEMENTARES', CODDISC: '-1', NEGRITO: true, ITALICO: false, TIPOENUM: 4, DECIMAIS: 4 }),
    linha({ CODPERIODO: 100, CODGRUPO: 'Componente curricular: ATIVIDADES COMPLEMENTARES', CODDISC: '-1', DISCIPLINA: 'Modalidade: 1.1 Monitoria', NEGRITO: false, ITALICO: false, TIPOENUM: 4, DECIMAIS: 4 }),
    linha({ CODPERIODO: 100, CODGRUPO: 'Componente curricular: ATIVIDADES COMPLEMENTARES', DISCIPLINA: 'Monitoria de Lógica', STATUS: 'Concluída', PLETIVO: '2026S1', NUMCREDITOS: '40,0000', CH: '40,0000', CHINTEGRALIZADA: '40,0000', IMG: 'img_concluida.PNG', STATUSENUM: 3, TIPOENUM: 4, DECIMAIS: 4 }),
    linha({ CODPERIODO: 100, CODGRUPO: 'Componente curricular: ATIVIDADES COMPLEMENTARES', CODDISC: 'totaisModalidade', DISCIPLINA: 'Total CH concluída: 40,0000 | Total CH integralizada: 40,0000', NEGRITO: false, ITALICO: true, TIPOENUM: 4, DECIMAIS: 4 }),
  ],
};
