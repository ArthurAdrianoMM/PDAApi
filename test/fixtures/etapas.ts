/** Made-up `EtapasTurmaDisc` answers, in the shapes recorded on 2026-11-03 (ENDPOINTS.md 4.7). */
const etapa = (extra: Record<string, unknown>) => ({
  CODCOLIGADA: 1,
  IDTURMADISC: 48213,
  CODETAPA: 1,
  TIPOETAPA: 'N',
  APLICACAO: 'S',
  CODFORMULANOTA: '12',
  CODFORMULAFALTA: null,
  IDGRUPO: null,
  DESCRICAO: 'AV 1 / AV QT 1',
  PONTDIST: 10,
  MEDIA: null,
  FREQMIN: null,
  DTINICIO: null,
  DTFIM: null,
  AULASDADAS: null,
  AULASPREVISTAS: null,
  DTLIMITEDIGITACAO: '2026-12-26T00:00:00',
  CONCEITOGRAFICO: null,
  DIGAULASDADAS: null,
  ETAPAFINAL: null,
  EXIBENAWEB: 'S',
  EXIBENOGRAFICO: 'S',
  DTINICIODIGITACAO: '2026-08-03T00:00:00',
  DTLIMITECONTPREVISTO: null,
  DTLIMITECONTEFETIVO: null,
  DISPONIVELALUNOS: 'S',
  ETAPAENCERRADA: 'N',
  PERMITEDIGITACAO: 'N',
  AGRUPADOR: null,
  NOMEREDUZIDO: null,
  PERMITIRCADASTRARAVALIACAO: 'N',
  IDFT: null,
  ...extra,
});

/** `tipoEtapaTurmaDisc=N`, in the portal's order. */
export const ETAPAS_NOTA = [etapa({ CODETAPA: 2, DESCRICAO: 'AV 2 / AV QT 2' }), etapa({})];

/** `tipoEtapaTurmaDisc=F`. */
export const ETAPAS_FALTA = [
  etapa({
    CODETAPA: 0, TIPOETAPA: 'F', DESCRICAO: 'Faltas', CODFORMULANOTA: null, CODFORMULAFALTA: '3', PONTDIST: null, FREQMIN: 75,
    DTINICIO: '2021-07-01T00:00:00', DTFIM: '2030-12-31T00:00:00', AULASDADAS: 38, DIGAULASDADAS: 'N', ETAPAFINAL: 'S',
  }),
];
