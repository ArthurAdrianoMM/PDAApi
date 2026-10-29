# SENAI Portal do Aluno: endpoint map

Target: `https://senaiweb6.fieb.org.br`. TOTVS RM Portal Educacional v12.1.15. The login page is AngularJS, and the logged-in student app is Angular with lazy-loaded feature modules.

Purpose and scope: see [INTENT.md](INTENT.md).

## How this map was built

1. **Login page (public):** endpoints read from the login page's own scripts and its calls on load.
2. **Logged-in app:** the portal was opened in a browser (isolated context) and logged in with the student's own account. The browser's network log records the exact requests the frontend makes.
3. **Response shapes:** each GET endpoint was called from the logged-in page with `fetch`, the same way the frontend does. Only the JSON *structure* (field names and types) was kept. No personal values are recorded here.
4. **Feature modules:** the lazy-loaded route and controller files were read to find which pages call which endpoints.

Status key: **verified** = seen in the browser network log and/or its shape checked. **found** = present in the code, not yet observed. **out of scope** = payment or card related, not called on purpose.

Credentials, cookies, tokens and personal values are not written in this file.

---

## 1. Base URLs and conventions

- REST base: `https://senaiweb6.fieb.org.br/FrameHTML/RM/API/`
  - Student data: `TOTVSEducacional/...`
  - User session: `user/...`
  - Library (not used): `TOTVSBiblioteca/...`
- All responses are JSON in the envelope `{ "data": ..., "messages": [], "length": n, "HttpStatusCode": 200 }`, except `user/getcurrentuser` (flat object) and `user/...` helpers.
- Authentication is **session cookies**, not a bearer token (verified in the browser and from curl, see section 3).
- Academic endpoints also need the **context cookie** `EduContextoAlunoResponsavelAPI`, which the client must set itself (section 2.4).
- Several list endpoints are called with the active enrollment context; the frontend sends no extra header beyond cookies (`accept: application/json, text/plain, */*`).
- Responses use `cache-control: no-cache`.

---

## 2. Login flow

### 2.1 Pre-login (public, verified)

| Method | Path | Purpose | Result |
|---|---|---|---|
| GET | `/FrameHTML/RM/API/TOTVSEducacional/ListarAlias` | Institution aliases | `["CorporeRM"]`, a bare array with no envelope (re-checked 2026-10-29) |
| GET | `/FrameHTML/RM/API/user/ExternalApps?alias=CorporeRM` | External (SSO) providers | `data.oauthProviders` (empty for this alias) |

**Removed: `TOTVSEducacional/LoginURL?alias=CorporeRM`.** On 2026-10-29 it returned **404** (`"No HTTP resource was found that matches the request URI"`), and the current login page code (`login/login.controller.js`) does not call it. The old portal's base is a constant in the portal's own config: `CONST_GLOBAL_URL_CORPORE_RM = '/Corpore.net/'` in `FrameHTML/web/js/totvs-app.global.config.js`, on the same host.

### 2.2 Form login (verified)

`POST /Corpore.Net/Source/EDU-EDUCACIONAL/Public/EduPortalAlunoLogin.aspx?AutoLoginType=ExternalLogin`

Re-verified from curl on 2026-10-29: this POST, then `AutoLoginPortal` (2.3), `Contexto` and the context cookie (2.4), then `getcurrentuser` returned the logged-in user.

- Content type: `application/x-www-form-urlencoded`
- Fields: `User`, `Pass`, `Alias` (`CorporeRM`)
- Needs `Content-Length`. Without it the server returns 411.
- Success: **302** to `https://senaiweb6.fieb.org.br/framehtml/web/app/edu/PortalEducacional/#/main?key=<opaque>`, and cookies are set (see section 3). Treat the 302 as success. Do not follow redirects with a body-less POST.
- The `key` value is an opaque session key. The app passes it to step 2.3.

**Found, not verified: the login page's own JSON login.** The current login page (`login.controller.js`, function `login`) does not post this form. It calls `POST /FrameHTML/RM/API/TOTVSEducacional/Login` with the JSON body `{ user, password, alias }`, and on success reads the key from `result.value`, then redirects to `#/main?key=<value>`. The response shape and status codes have not been recorded. The API keeps the form POST above because it is the verified path.

### 2.3 Session bootstrap (verified, GET)

`GET /FrameHTML/RM/API/user/AutoLoginPortal?key=<key from the 302>`

The frontend calls this right after the redirect, which turns the key into an authenticated app session. Other endpoints require this session. After this call the cookie jar holds `RMAuthForm`, `ASP.NET_SessionId`, `.ASPXAUTH`, `DefaultAlias` and `CorporePrincipal`.

### 2.4 Set the context cookie (verified from curl, required)

The server never sets `EduContextoAlunoResponsavelAPI`. In the browser the portal's JavaScript sets it after login. A client outside the browser must set it itself:

1. `GET /FrameHTML/RM/API/TOTVSEducacional/Contexto` and pick the enrollment record (for example the latest by `DTINICIO`).
2. Set the cookie `EduContextoAlunoResponsavelAPI` on `senaiweb6.fieb.org.br`, path `/`, to that record's `IDCONTEXTOALUNO`, **as is (not URL-encoded)**.

Observed results for `TOTVSEducacional/NotaEtapa`:

| Context cookie | Result |
|---|---|
| Missing | HTTP 200, `data` = `{"RMException:Message": ...}`, `messages[0]` = `{ type: "warning", detail: "Usuário sem permissão para acessar os dados acadêmicos do aluno" }` |
| URL-encoded value | HTTP 403, empty body |
| Raw `IDCONTEXTOALUNO` | HTTP 200, `data.Notas[]` as in section 4.3 |

`user/getcurrentuser` and `Contexto` work without this cookie. The permission warning is the sign that the context cookie is missing, not that the account lacks access.

### 2.5 Logout (verified, state-changing, avoid)

`POST /FrameHTML/RM/API/TOTVSEducacional/Logout`

The login page calls this **on load**, so it ends any existing session. Do not call it casually from the API.

### 2.6 Other login-page calls (found, not called)

`RecoverPassword`, `RegisterNewPassword`, `ChangePassword` (all POST on `TOTVSEducacional/`). These change credentials and are out of scope.

---

## 3. Session and cookies (verified, names only)

| Cookie | Notes |
|---|---|
| `RMAuthForm` | Main authentication cookie, HttpOnly, SameSite=Lax |
| `ASP.NET_SessionId` | ASP.NET session, HttpOnly |
| `.ASPXAUTH` | ASP.NET forms-auth ticket, sent with requests |
| `DefaultAlias` | Selected alias, `CorporeRM` |
| `CorporePrincipal` | Encrypted principal blob set by the portal |
| `EduContextoAlunoResponsavelAPI` | Active student context. Set by the frontend JavaScript, **not by the server**. Holds the raw `IDCONTEXTOALUNO` from `Contexto`. API clients must set it themselves (section 2.4) |
| `EduMascaras` | Front-end masks (phone, CEP). Not sensitive |

**Session check:** `GET /FrameHTML/RM/API/user/getcurrentuser` returns the logged-in user. Use it to check whether the session still works.

**Session expiry (observed):** during this mapping the session expired. The next navigation redirected the app to `…/PortalEducacional/login/?sessaoexpirada=true`, and the login page showed "Sua sessão expirou. Realize o login novamente." Logging in again restored the session. The exact lifetime is still unknown. Build the API to detect this redirect (or a 401) and log in again.

**Note on the bundle's token endpoints:** the main app's JavaScript also contains `/api/connect/token` and `/api/connect/getCurrentUser` (paths on the same host, with a Bearer token in `localStorage`). In the browser, the logged-in pages used the `RM/API` cookie endpoints above and did not call those token paths. Treat the token flow as **unused** for this portal unless a later check shows otherwise.

---

## 4. Verified student endpoints

All are `GET` unless noted, all need the session cookies, and all return the envelope from section 1 unless noted.

### 4.1 Identity and context

| Path | Verified | Response (field names, types) | Notes |
|---|---|---|---|
| `user/getcurrentuser` | yes | `{ username: string, dialect: string, email: string, login: string }` | `login` is the student's user code (the RA-style login). Flat object, no envelope. |
| `TOTVSEducacional/UsuarioLogado` | yes | `{ data: boolean, messages, length, HttpStatusCode }` | Session "is logged in" flag. |
| `TOTVSEducacional/Contexto` | yes | `data[]` of enrollment records: `CODCOLIGADA`, `CODFILIAL`, `CODTIPOCURSO`, `CODPESSOAUSUARIO`, `NOMEFILIAL`, `NOMETIPOCURSO`, `RA`, `NOMEALUNO`, `DTNASCIMENTOALUNO`, `CODCURSO`, `NOMECURSO`, `CODHABILITACAO`, `NOMEHABILITACAO`, `NOMEMATRIZ`, `NOMETURNO`, `IDPERLET`, `CODPERLET`, `DTINICIO`, `APRESENTACAO`, `SITMATHABILITACAO`, `SITMATPERLET`, `CODUSUARIOALUNO`, `CONTEXTOSOLICITATERMOACEITE`, `EMAIL`, `ACESSODADOSACADEMICOS`, `ACESSODADOSFINANCEIROS`, `IDCONTEXTOALUNO` (opaque), plus `*_EXTRATOFIN` and responsible-person fields (mostly null for this student) | Returns one record per enrollment period (8 for this student). `IDPERLET` and `CODPERLET` identify the period (e.g. `2026S2`). `SITMATPERLET` gives the enrollment status. |
| `TOTVSEducacional/Contexto/GetUsertype` | yes | `data.value.ListUserType[]` (user types for the portal) | Used to decide which menu items show. |
| `TOTVSEducacional/Contexto/Selecao` | yes (POST, not called by us) | Selects the active enrollment context. Request body not captured. | **State-changing.** It sets the session's active context. Only call it if a flow needs to switch context, and check the request body first. |

### 4.2 Student profile and settings

| Path | Verified | Response | Notes |
|---|---|---|---|
| `TOTVSEducacional/Aluno/InformacoesPessoaisBasicas` | yes | `data[0]`: `NOME` (string), `IMAGEM` (base64 photo) | Personal data. Do not log the photo. |
| `TOTVSEducacional/Parametrizacao/TotvsEducacional` | yes | `data`: about 90 portal settings (booleans, numbers and strings). Includes report codes such as `CodRelatorioConsultaNotaReports` and `PermiteAlterarSenha` | Portal configuration, read-only. |
| `TOTVSEducacional/Parametrizacao/v1/TotvsEducacional/Geral` | yes | `data.UtilizaBuscaIpServer` (boolean) | |
| `TOTVSEducacional/Permissoes` | yes | `data`: about 50 permission keys, each a string (for example `EDU_ACADEMICO_CENTRALALUNO_NOTAS`, `EDU_FINANCEIRO_NOVO`) | Use these to know which pages this student may open. |
| `TOTVSEducacional/GetMenu` | yes | `data[]` of 14 entries: `id`, `name`, `url`, `itens` | Menu items (see section 6). |
| `TOTVSEducacional/Aluno/TermoImagemVoz/?incluirRelatorio=false&obterNomeResponsavel=false&somenteStatus=true` | yes | `data`: consent-term status fields | Consent status. Read-only here. |
| `TOTVSEducacional/v1/Contexto/ConsultaAceiteTermosConsentimento` | yes | `data`: privacy and cookie-consent flags and versions | |

### 4.3 Academic data (grades, absences, schedule)

Each page first calls `Periodos` and `DisciplinasAlunoPeriodoLetivo`, then its own endpoint.

| Path | Verified | Response | Notes |
|---|---|---|---|
| `TOTVSEducacional/Periodos` | yes | `data[]`: `CODPERLET` (string), `IDPERLET` (number). 8 periods for this student | The period list. |
| `TOTVSEducacional/DisciplinasAlunoPeriodoLetivo?mostraApenasDiscEmCurso=false` | yes | `data[]`: `CODCOLIGADA`, `RA`, `CODSTATUS`, `DESCRICAO`, `IDTURMADISC` (number, the class ID), `IDTURMADISCORIGEM`, `CODTURMA`, `CODSUBTURMA`, `CODFILIAL`, `CODTIPOCURSO`, `CODDISC` (course code), `NOME` (course name), `IDPERLET` | `IDTURMADISC` is the key the other academic calls use. `mostraApenasDiscEmCurso=false` returns all classes. |
| `TOTVSEducacional/NotaEtapa` | yes | `data.Notas[]`: `FILIAL`, `CODTURMA`, `CODDISC`, `DISCIPLINA`, `SITUACAO`, `IDTURMADISC`, and one column per assessment (e.g. `"1 - AV 1 / AV QT 1"`, `"3 - AV 3 / AV QT 3"`) with string or null values | **Column names are dynamic**, one per assessment stage. Parse by name and never hard-code them. The call takes no parameters here, so it returns the grades for the active context. **Verified from curl** with the context cookie from section 2.4. Without that cookie it returns a permission warning instead. |
| `TOTVSEducacional/FaltaEtapa` (optional `?idTurmaDisc=<id>`) | yes, **from a script** (2026-10-29) | `data.FaltasEtapa[]`: `Filial` (string), `CODTURMA` (string), `CODDISC` (string), `Disciplina` (string), `Situação` (string, e.g. `Matriculado`), `0 - Faltas` (string, e.g. `"8"`), `PERCENTUAL` (number, e.g. `11.11`), `IDTURMADISC` (number), `SITUACAOFALTAS` (number) | Absence totals per class, for the context in the cookie. **Stage columns are dynamic** like `NotaEtapa`: the page (`faltas-etapas-list.controller.js`) renders every column it doesn't know, and `0 - Faltas` is stage 0. With `idTurmaDisc` the portal returns that class only (checked); the page sends it when a class is picked and leaves it out (null) for "todas". `SITUACAOFALTAS` follows the page's legend: 1 "Faltas dentro do limite", 2 "Faltas próximas do limite", 3 "Faltas acima do limite", 4 "Não foi possível calcular o percentual". The page shows `PERCENTUAL` and the legend only when the portal setting `ValidaLimiteFaltas` is on. For this student all 5 classes came with `SITUACAOFALTAS` 4 while `PERCENTUAL` was filled. |
| `TOTVSEducacional/Aluno/Falta/Aula?tipoFrequencia=A&dataDe=<ISO>&dataAte=<ISO>` | yes, **from a script** (2026-10-29) | `data.SFREQUENCIAALUNO[]`: `CODCOLIGADA` (number), `IDTURMADISC` (number), `IDPLANOAULA` (number), `IDHORARIOTURMA` (number), `AULA` (number), `CODDISC` (string), `DISCIPLINA` (string), `DATAFALTA` and `DATA` (string `YYYY-MM-DDTHH:MM:SS`, equal in every row), `HORAINICIAL`, `HORAFINAL` (string `HH:MM`), `JUSTIFICADAPERSONALIZADO` (string, `Não`), `ABONAFALTAPERSONALIZADO` (string, empty), `MOTIVOPERSONALIZADO` (null), `COMPOETOTALFALTAS` (null, not in the earlier capture), `PRESENCA` (string, `A`), `JUSTIFICADA` (null), `CODSUBTURMA` (null or string), `SITUACAO` (string, `Não justificada`) | **One row per missed lesson** in a date window. `tipoFrequencia=A` means "ausência" (page comment), so presences never come back. `dataDe`/`dataAte` are JavaScript `Date`s serialized with `toISOString()`. The portal compares them as dates, not times (checked: noon to noon on one day returns that day's rows). The page's default window is **now − 360 days to now** (`faltas-aula-list.controller.js`, buttons for 15, 30, 90, 180 and 360 days, or a custom range). Its class filter runs in the browser on `IDTURMADISC`. For this student, the 360-day window (which covered 2026S1 too) returned only rows of the session's enrollment (2026S2), and each class's row count equalled its `0 - Faltas` in `FaltaEtapa`. Found, not called: `Aluno/Falta/AulaTurmaDisc?idTurmaDisc=<id>` (same factory, used from a class's own page). |
| `TOTVSEducacional/EtapasTurmaDisc?idTurmaDisc=<id>&tipoEtapaTurmaDisc=F` | yes | `data[]` (empty in the check, which used `idTurmaDisc=-1`) | Stages for one class. Needs a real `IDTURMADISC` from `DisciplinasAlunoPeriodoLetivo`. |
| `TOTVSEducacional/QuadroHorarioAluno` | yes | `data.SHorarioAluno[]` (weekly slots: `DIASEMANA` (string), `HORAINICIAL`, `HORAFINAL` (`HH:mm`), `IDTURMADISC`, `IDHORARIOTURMA` (numbers), `CODDISC`, `NOME`, `CODTURMA`, `CODSUBTURMA`, `NOMEREDUZIDO`, `DATAINICIAL`, `DATAFINAL`, `PREDIO`, `BLOCO`, `SALA`, `URLAULAONLINE`, `IMPBOLETIM`, and `CODPREDIO`, `CODSALA`, `IDTURMADISCORIGEM` (always null here)), `data.SDescDisc[]` (classes: `CODTURMA`, `DATAINICIAL`, `DATAFINAL`, `CODDISC`, `NOME`, `TIPO`, `CODCOLIGADA`, `IDTURMADISC`, `IMPBOLETIM`, `PREDIO`, `BLOCO`, `SALA`), `data.SQuadroHorarioAluno[]` (empty here), `data.SQuadroHorarioAulaOnline[]` (empty here) | Weekly timetable for the active period. Takes no parameters. **Verified from curl** with the context cookie (2026-10-29). Details below. |

**`QuadroHorarioAluno` in detail** (from the page's code, `js/aluno/quadro-horario/quadro-horario-list.controller.js` and `quadro-horario.factory.js`, and one run against the real portal on 2026-10-29, shapes only):

- The factory sends no query parameters, so the answer is for the enrollment in the context cookie.
- `DIASEMANA` is a string. The page reads `'1'` as domingo, `'2'` segunda … `'7'` sábado (JavaScript `getDay()` + 1).
- Rows with `DIASEMANA` `'0'` (10 of 38 here) have only `HORAINICIAL` and `HORAFINAL`. Everything else is null. The page skips them in the day columns but still builds a grid row (time band) from them, so they are the empty time bands of the grid, not classes.
- Every class slot here has `DATAINICIAL` and `DATAFINAL` (`YYYY-MM-DDTHH:mm:ss`, no zone). The page calls a slot with both dates "modular" and hides it when `new Date(DATAFINAL) < now`, unless "Mostrar todos" is ticked. Since `DATAFINAL` is midnight, the page already hides a slot on its last day. The API compares dates only, so it keeps the slot on that day.
- `PREDIO`, `BLOCO` and `SALA` are `"code - name"` text, null on some class slots. `CODSUBTURMA` is set on some slots. `URLAULAONLINE` was always null, and `SQuadroHorarioAulaOnline` was empty, so neither the type of a set `URLAULAONLINE` nor the shape of `SQuadroHorarioAulaOnline` items is recorded. The API reads `URLAULAONLINE` as optional text and ignores `SQuadroHorarioAulaOnline`.
- Each slot's `IDTURMADISC` appears in `SDescDisc` and matches `DisciplinasAlunoPeriodoLetivo`. `SDescDisc` held one class twice (6 rows, 5 IDs). The page only uses `SDescDisc` to look up `IDTURMADISC` by `CODDISC`, which the slots already carry, so the API does not use it.

### 4.4 Widgets and other reads

| Path | Verified | Notes |
|---|---|---|
| `TOTVSEducacional/Widget/DadosWidgets?idFuncionalidade=<n>` | partly (only 6 checked alone) | Dashboard widget data per feature. `idFuncionalidade=6` returned an empty `data`. IDs 2 (notes), 5 (schedule) and 12 (finance) are seen in the page calls but their shapes are not checked. |
| `TOTVSEducacional/Widget/DadosWidgetsFavoritos` | yes | Favourite widgets. Empty for this student. |
| `TOTVSEducacional/Banner` | yes | `data[]` of banner images (`IDBANNER`, `TITULO`, `DTINICIAL`, `IMAGEM` (base64/url), `LINK`, `ORDEM`, `ATIVO`, `PORTALALUNO`). |
| `TOTVSEducacional/v1/AtividadeOfertada/AlertaAtividadesAcademicas` | yes | Academic activity alerts. Empty here. |
| `TOTVSEducacional/AvaliacoesInstitucionais` | yes | `data.Avaliacao[]` of institutional evaluations (`CODPROVA`, `IDEXECPROVA`, `DESCRICAO`, `NOMEPROFESSOR`, `NOMEDISCIPLINA`, `NOMECURSO`, …). |
| `TOTVSBiblioteca/v1/Context/LibraryUnitContext?pageSize=100` | yes | Library context. Not needed for the grades API. |

---

### 4.5 Grade curriculum and history (verified)

| Path | Verified | Response | Notes |
|---|---|---|---|
| `TOTVSEducacional/GradeCurricular/EnsinoSuperior` | yes | `data.SHabilitacaoAluno[0]`: enrollment summary (`RA`, `CODSTATUS`, `NOMESTATUS`, `DTINGRESSO`, `NOMEGRADE`, `NOMECURSO`, `NOMEHABILITACAO`, `NOMETURNO`, `CODCURSO`, `CODHABILITACAO`, `CODGRADE`, `CODTIPOCURSO`, `CODFILIAL`, `CR`, `MEDIAGLOBAL`, `TOTCHCURSO`, `TOTCHINTEGRALIZADA`, `CARGAHORARIAGRADE`, and counts `QTDTOTALDISCOBR`, `QTDCONCDISCOBR`, `QTDPENDDISCOBR`, `QTDTOTALDISCOPT`, `QTDCONCDISCOPT`, `QTDPENDDISCOPT`, `QTDTOTALDISCELE`, `QTDCONCDISCELE`, `QTDPENDDISCELE`, `QTDTOTALATVCUR`, `QTDCONCATVCUR`, `QTDPENDATVCUR`, `QTDTOTALEXTENSAO`, `QTDCONCEXTENSAO`, `QTDPENDEXTENSAO`, `POSSUIEXTENSAO`); `data.SDiscEquivConcluidas[]`, `data.SDiscEquivEmCurso[]`, `data.SDisciplinaTCC*[]`; **`data.APRESENTACAOHISTORICO[]`** (82 rows for this student) | This is the main grade-curriculum endpoint for higher education. `APRESENTACAOHISTORICO` rows hold the academic history: `CODPERIODO`, `CODGRUPO`, `CODDISC`, `DISCIPLINA`, `STATUS`, `PLETIVO`, `CONCEITO`, `NOTA` (string), `FALTAS` (string), `NUMCREDITOS`, `CH`, `CHINTEGRALIZADA`, `IDTURMADISC`, `IDPERLET`, `STATUSENUM`, `TIPOENUM`. The grade page uses this call. The history page uses the basic-education call below. |
| `TOTVSEducacional/GradeCurricular/HistoricoEnsinoBasico` | yes, **error for this student** | Returns `messages[0]` with `type` and `detail` (the response shape is `{"data": {"RMException:Message": "..."}, ...}`), HTTP 200 | This is the basic-education history. It fails for a higher-education student, so the history page (`#/historico`) is basic-education only. Use `EnsinoSuperior` for this student's history. |

Pages: `#/grade-curricular` calls `Periodos`, `GradeCurricular/EnsinoSuperior`, and `Widget/DadosWidgets?idFuncionalidade=4`. `#/historico` calls `GradeCurricular/HistoricoEnsinoBasico` (fails here) and `Widget/DadosWidgets?idFuncionalidade=8`.

### 4.6 Calendar (verified)

| Path | Verified | Response | Notes |
|---|---|---|---|
| `TOTVSEducacional/Aluno/CalendarioAluno` | yes | `data.APPOINTMENTS[]` (1458 items for this student). Fields: `ID` (number), `EVENTTYPE` (number), `RECURRENCEINFO` (string), `STARTTIME`, `ENDTIME` (ISO strings), `SUBJECT`, `DESCRIPTION`, `ALLDAY` (boolean), `LABEL`, `IDTURMADISC` (number, class), `IDPLANOAULA` (number, lesson), `CODETAPA`, `CODPROVA`, `IDOFERTA` (null here) | One call returns the whole calendar. No date parameter is sent. Expect a large response. Use `IDPLANOAULA` and `IDTURMADISC` to link an appointment to a lesson or class. |

Page `#/calendario` calls `Aluno/CalendarioAluno`, `Periodos`, `DisciplinasAlunoPeriodoLetivo?mostraApenasDiscEmCurso=false`, and `Widget/DadosWidgets?idFuncionalidade=3`.

### 4.7 Classes and lessons (verified)

Each class has a numeric `IDTURMADISC`, taken from `DisciplinasAlunoPeriodoLetivo`. Some classes also have a subclass code (`CODSUBTURMA`, for example `SUBTURMA C`), which must be sent as well.

| Path | Verified | Response | Notes |
|---|---|---|---|
| `TOTVSEducacional/AulasDisciplina/{idTurmaDisc}?codSubTurma=<code or empty>&dataInicio=<ISO>&dataFim=<ISO>` | yes (200) | `data[]`: one object per day, with `DataAula` (string), `QuantidadeFaltas`, `QuantidadeAvaliacoes`, `QuantidadeMateriais`, `QuantidadeOcorrencia`, `QuantidadeLicoesDeCasa` (numbers), `IdTurmaDisc`, `CodColigada`, `ListaDetalhesPlanoAulaPortal[]`, `ListaFaltas[]`, `ListaMateriais[]` | **The class ID goes in the path.** The query-string form `AulasDisciplina?idTurmaDisc=…` returns 404. The window the frontend sent in this run was 2026-06-18 to 2027-02-13 (about 8 months). `ListaDetalhesPlanoAulaPortal[]` items have `PlanoAula` (the lesson: `IdPlanoAula`, `NumAula`, `DataAula`, `HoraInicial`, `HoraFinal`, `Conteudo` (lesson content), `LicaoCasa` (homework), `Confirmado`, `TipoAula`, `UrlAulaOnline`, `Locacao`, `Observacao`) and `Horario` (`DiaSemana`, `HoraInicial`, `HoraFinal`, `IdHorarioTurma`, `DataInicial`, `DataFinal`, `CodTurno`). `ListaFaltas[]` items have `Data`, `Aula`, `TipoFrequencia`, `Justificada`, `JustificativaFalta`, `AbonoFalta`, `HoraInicial`, `HoraFinal`. |
| `TOTVSEducacional/PlanoAula/Aula?idTurmaDisc=<id>&idPlanoAula=<id>` | yes (200 for a real lesson) | `data.SPlanoAula[]` (one item for the lesson): `CONTEUDO`, `CONTEUDOEFETIVO`, `LICAOCASA`, `OBSERVACAO`, `DATA`, `HORAINICIAL`, `HORAFINAL`, `HORAINICIALREALIZADO`, `HORAFINALREALIZADO`, `CODPREDIO`, `PREDIO`, `BLOCO`, `SALA`, `NOMEDISC`, `CODDISC`, `CODTURMA`, `CODSUBTURMA`, `CONFIRMADO`, `IDPLANOAULA`, `IDTURMADISC`, `URLAULAONLINE`, `FREQUENCIADISPWEB`, `DIASEMANA`, `AULA`, `IDPERLET`, and others. `data.SPlanoAulaArquivo[]` (empty here). | Lesson detail. Lesson detail (the factory's `retornarDetalhesAula`). `idPlanoAula` must be a real number. Sending `undefined` gives 400. |
| `TOTVSEducacional/PlanoAula/ArquivoAula?start=0&limit=10&idTurmaDisc=<id>&idPlanoAula=<id>` | **403** | Forbidden for this student, even for a lesson with content | Lesson attachments. The 403 means the account lacks permission for this endpoint, not that the lesson has no files. Do not try to get around it. |
| `TOTVSEducacional/EtapasTurmaDisc?idTurmaDisc=<id>&tipoEtapaTurmaDisc=F` | yes | `data[]` of stages for the class: `CODETAPA`, `TIPOETAPA`, `APLICACAO`, `DESCRICAO`, `FREQMIN`, `DTINICIO`, `DTFIM`, `AULASDADAS`, `AULASPREVISTAS`, `DTLIMITEDIGITACAO`, `DISPONIVELALUNOS`, `ETAPAENCERRADA`, `PERMITEDIGITACAO`, `EXIBENAWEB`, `ETAPAFINAL` (and others) | Assessment stages. Used by the grades and absences pages. |
| `TOTVSEducacional/MateriaisTurmaDisciplina?idTurmaDisc=<id>` | yes (empty) | `data[]` (empty for the classes checked) | Materials for one class. |

Page `#/aulas` loads its view (`aulas-lista.view.html`) on navigation. Its own data calls on load were not separated from the calendar page's in this capture. The per-class `AulasDisciplina/{id}` call is what the lesson list uses, and it was observed in a later navigation. The lesson view uses `PlanoAula/Aula` and `PlanoAula/ArquivoAula` (the latter returns 403 here).

### 4.8 Lesson plan by day (verified)

| Path | Verified | Response | Notes |
|---|---|---|---|
| `TOTVSEducacional/v1/planoaulas/aulas?dtInicial=<ISO>&dtFinal=<ISO>&orderby=HORAINICIAL&idContextoAluno=<encoded context>` | yes (200) | `data.SPlanoAula[]` (12 items for the current day), same lesson fields as `PlanoAula/Aula`, plus `IDHORARIOTURMA`, `CODHOR`, `CODPROF`, `CODFILIAL`, `DATA` | The lesson-plan page's day view. `dtInicial` and `dtFinal` were the same date (the selected day). |

**`idContextoAluno`:** the frontend takes this from the cookie `EduContextoAlunoResponsavelAPI`, which holds the active enrollment context (the same value as `IDCONTEXTOALUNO` in `Contexto`). The frontend reads the cookie (decoded) and applies `encodeURI` to it. Keep the same steps. The encoding applies only to this query parameter. The cookie itself must hold the raw value (section 2.4). The value is opaque, so do not log it.

Page `#/plano-aula` calls `v1/planoaulas/aulas` for the selected day.

### 4.9 Files and materials (verified)

| Path | Verified | Response | Notes |
|---|---|---|---|
| `TOTVSEducacional/Material/Institucional` | yes | `data[]` (32 items): `IDMATERIALSEC` (number), `DESCRICAO`, `DESCRICAOTIPOMATERIAL` (`Material P/ Aluno`, `Estágio`, `Todos`), `IDTIPOMATERIAL`, `TIPOUSUARIO`, `TIPOUSUARIOORIGEM`, `DATAEXPIRACAO`, `DATAINCLUSAO`, `CODUSRAUTOR`, `TAMANHO` (bytes), `ARQUIVO` (filename, e.g. `…docx`), `PATHARQUIVO` | Institutional documents. |
| `TOTVSEducacional/Material` | yes (empty) | `data[]` empty for this student | Student-specific materials. |
| `TOTVSEducacional/Material/Download?idMaterialSec=<id>&pathArquivo=<encodeURIComponent(PATHARQUIVO)>` | yes (headers checked) | HTTP 200, `content-type: application/octet-stream`, `content-disposition` present, file size from `content-length` (about 1 MB for a sample `.docx`) | **File download (GET).** The factory builds it this way. The body was not saved. Build the link from `IDMATERIALSEC` and `PATHARQUIVO`. |

Page `#/arquivos` calls `Periodos`, `Widget/DadosWidgets?idFuncionalidade=11`, `Material/Institucional`, and `DisciplinasAlunoPeriodoLetivo?mostraApenasDiscEmCurso=true`.

---

## 5. Out of scope (payment and card)

These are called by the financial pages. They handle payment data, so the API should **not** expose them, and they were not exercised:

- `TOTVSEducacional/v1/Payments/QtdeCartoesCarteiraDigital`
- `TOTVSEducacional/v1/Payments/DadosUsuarios`
- `TOTVSEducacional/v2/Payments/BoletoAlertaProximoVencimento`
- Any `Payments/*`, `paymentcard*`, `digitalwallet*`, `paymenthub*`, `defineddataantifraud`, `paymentrecurring`, `Boleto/*` endpoint.

The financial statement page (`#/financeiro.new`) was opened, but its installment list was **not captured**. Its calls are payment-adjacent, so they stay out of scope.

---

## 6. Menu and pages (verified)

From `GetMenu`:

| Menu name | Front-end route | Status |
|---|---|---|
| Mural | `/` | Home page |
| Calendário | `#/calendario` | verified (section 4.6) |
| Grade Curricular | `#/grade-curricular` | verified (section 4.5) |
| Matrícula online | `/es/matricula/apresentacao` | out of scope |
| Central do Aluno | `#` (container) | contains Notas (`#/notas`), Faltas (`#/faltas`), Quadro de horário (`#/quadro-horario`), Aulas (`#/aulas`), Plano de aula (`#/plano-aula`), Histórico (`#/historico`) |
| Secretaria | `#` (container) | requests and documents |
| Oportunidades | `#` (container) | internships and extra activities |
| Arquivos | `/arquivos` | files |
| Financeiro | `/financeiro.new` | payment-related, see section 5 |
| Negociação on-line | `/negociacao/...` | payment-related, out of scope |
| Avaliação Institucional | `/avaliacoes` | verified (section 4.3/4.4) |
| Relatórios | `/relatorios` | reports |

**Page-to-endpoint map (verified in the browser):**

| Page (`#/route`) | Calls, in order |
|---|---|
| `#/notas` | `Periodos`, `DisciplinasAlunoPeriodoLetivo`, `NotaEtapa`, `Widget/DadosWidgets?idFuncionalidade=2` |
| `#/faltas` | `Periodos`, `Aluno/Falta/Aula`, `Widget/DadosWidgets?idFuncionalidade=6`, `FaltaEtapa`, `DisciplinasAlunoPeriodoLetivo`, `EtapasTurmaDisc` |
| `#/quadro-horario` | `Periodos`, `Widget/DadosWidgets?idFuncionalidade=5`, `QuadroHorarioAluno` |
| `#/financeiro.new` | `Periodos`, `v1/Payments/DadosUsuarios` (out of scope), `Widget/DadosWidgets?idFuncionalidade=12` |
| `#/grade-curricular` | `Periodos`, `GradeCurricular/EnsinoSuperior`, `Widget/DadosWidgets?idFuncionalidade=4` |
| `#/historico` | `GradeCurricular/HistoricoEnsinoBasico` (fails for this student), `Widget/DadosWidgets?idFuncionalidade=8` |
| `#/calendario` | `Aluno/CalendarioAluno`, `Periodos`, `DisciplinasAlunoPeriodoLetivo?mostraApenasDiscEmCurso=false`, `Widget/DadosWidgets?idFuncionalidade=3` |
| `#/aulas` | View only on load. Per-class `AulasDisciplina/{id}` and `PlanoAula/*` when a class or lesson is opened (section 4.7) |
| `#/plano-aula` | `v1/planoaulas/aulas` for the selected day (section 4.8) |
| `#/arquivos` | `Periodos`, `Widget/DadosWidgets?idFuncionalidade=11`, `Material/Institucional`, `DisciplinasAlunoPeriodoLetivo?mostraApenasDiscEmCurso=true` |

All academic pages listed in the menu are now mapped (sections 4.5 to 4.9). The per-class lesson calls are documented from the factory code and from the calls seen during lesson-plan and lesson-list use.

---

## 7. Known gaps and next steps

1. Capture the lesson calls for a selected class in the browser (click a class on `#/aulas`), so the per-class request list comes from the page itself, not from the factory code.
2. Find out why `PlanoAula/ArquivoAula` returns 403. It may need a permission that this account lacks. Do not try to get around it.
3. Check the `Contexto/Selecao` request body. Needed only if the API must switch between enrollments.
4. Find the session lifetime. Session expiry was observed (section 3), but the timing was not measured.
5. Re-check `Widget/DadosWidgets` for `idFuncionalidade` 2, 3, 4, 5 and 11 separately. Only ID 6 has been checked alone.
6. Build the API on the verified GET endpoints in section 4, plus `Periodos` and `DisciplinasAlunoPeriodoLetivo`.
7. Only the login flow, `getcurrentuser`, `Contexto`, `NotaEtapa`, `FaltaEtapa` and `Aluno/Falta/Aula` have been checked from outside the browser (curl or the API's own client). The other academic endpoints were checked in the browser, where the context cookie was already set. They probably need the cookie too. Confirm each one from outside the browser.
8. Check whether setting the context cookie to another enrollment's `IDCONTEXTOALUNO` is enough to switch periods. If it is, the API does not need the state-changing `Contexto/Selecao` (item 3). Until then, `/notas`, `/faltas` and `/faltas/aulas` have no `periodo` parameter: they answer for the enrollment the session picked.

### 7.1 Not yet recorded, handled defensively in `src/core`

The client does not assume an answer to these. Each one notes what the code does today.

1. **Login with a wrong password.** What the form POST returns is not recorded. The client treats anything other than a 3xx whose `Location` carries `key` as `login_falhou`.
2. **API calls with an expired session.** Section 3 records the app's page redirect, not what an API call returns. The client treats a 3xx or 401 on an API call as an expired session, logs in again once and retries.
3. ~~**`ListarAlias` envelope.**~~ Resolved 2026-10-29: a bare array. The client now accepts only that.
4. **`AutoLoginPortal` response.** Its status and body are not recorded. The client accepts any status below 400 and then checks the session with `getcurrentuser`.
5. **Assessment values in `NotaEtapa`.** The value format (decimal comma or point, concepts) is not recorded. The API returns the raw text as `valor`, and `nota` only when the text is a plain number.
6. **Field types not recorded** (`CODSTATUS`, `CODTURMA`, `IDPERLET` outside `Periodos`, `DTINICIO` format). The schemas in `src/core/schemas.ts` accept string or number and normalize.
7. ~~**`Aluno/Falta/Aula` window bounds.**~~ Resolved 2026-10-29: the portal compares dates only. A window of noon to noon on one day returned that day's absences. `/faltas/aulas` still sends the start of `de` and the end of `ate` in local time. Still not recorded: values of `JUSTIFICADAPERSONALIZADO` and `ABONAFALTAPERSONALIZADO` other than `Não` and empty. The API passes their text on as is.

The first run against the real portal (`npm run try -- notas`) answers items 1 to 6. Update this section with what it shows.

## 8. Operating notes for the API

- Never call `Logout` or `Contexto/Selecao` as a side effect.
- After login, set the context cookie from `Contexto` before any academic call (section 2.4). Treat the "Usuário sem permissão" warning as a missing or wrong context cookie.
- Pass dates in ISO format, and keep the window to what the page uses.
- Parse `NotaEtapa` and `FaltaEtapa` columns by name, since the names are dynamic.
- Keep requests at a normal page-load rate.
- Keep cookies in memory. Do not write them to files or logs.
- Mask names, the photo, emails, dates of birth and RA values in any logs or examples.
