/**
 * Made-up answers for the account endpoints, in the shapes recorded on
 * 2026-11-03 (ENDPOINTS.md 4.2, 4.4). Shared by the operation tests and the fake server.
 */

/** A 1×1 PNG, as raw base64 like `IMAGEM`. */
export const FOTO_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

/** `Aluno/InformacoesPessoaisBasicas`. */
export const INFORMACOES_PESSOAIS = [{ NOME: 'Aluno Teste da Silva', IMAGEM: FOTO_BASE64 }];

const avaliacao = (id: number, extra: Record<string, unknown>) => ({
  CODCOLIGADA: 1,
  CODPROVA: 'F149IES_2026.2',
  CODPESSOA: 1,
  ID: id,
  IDEXECPROVA: `73F${id}`,
  DESCOBJETOAVALIADO: 'Professor - Turma - Disciplina:Professora Exemplo - DS-2026-A - Programação Web II',
  NOME: null,
  NOMECURSO: null,
  NOMEHABILITACAO: null,
  NOMEGRADE: null,
  NOMEDISCIPLINA: 'Programação Web II',
  NOMEPROFESSOR: 'Professora Exemplo',
  CODCURSO: null,
  CODHABILITACAO: null,
  CODGRADE: null,
  CODTURMA: 'DS-2026-A',
  OBJETOAVALIADO: 'Professor',
  RECCREATEDBY: null,
  RECCREATEDON: null,
  RECMODIFIEDBY: null,
  RECMODIFIEDON: null,
  DESCRICAO: 'Professora Exemplo',
  ...extra,
});

const curso = (id: number, codigo: string, nome: string) =>
  avaliacao(id, {
    CODPROVA: 'F014IES_2026',
    DESCOBJETOAVALIADO: `Curso:${codigo} - ${nome}`,
    NOMECURSO: nome,
    NOMEDISCIPLINA: null,
    NOMEPROFESSOR: null,
    CODCURSO: codigo,
    CODTURMA: null,
    OBJETOAVALIADO: 'Curso',
    DESCRICAO: nome,
  });

/** `AvaliacoesInstitucionais`: one of another course, which the page leaves out. */
export const AVALIACOES_INSTITUCIONAIS = {
  Avaliacao: [avaliacao(0, {}), curso(1, 'DS', 'Curso Exemplo'), curso(2, 'OUTRO', 'Outro curso')],
};
