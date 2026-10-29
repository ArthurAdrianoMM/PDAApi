/** Groups shown in the docs sidebar, in display order. */
export const TAGS = [
  { name: 'Conta', description: 'Quem está logado e suas matrículas.' },
  { name: 'Período', description: 'Períodos e disciplinas. Base para os outros filtros.' },
  { name: 'Desempenho', description: 'Notas, faltas e histórico.' },
  { name: 'Rotina', description: 'Horário, calendário e aulas.' },
  { name: 'Arquivos', description: 'Materiais publicados pela escola.' },
  { name: 'Institucional', description: 'Avaliações e permissões da conta.' },
] as const;

export type OperationTag = (typeof TAGS)[number]['name'];
