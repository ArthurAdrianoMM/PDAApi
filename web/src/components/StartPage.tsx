import type { DocModel } from '../lib/spec';
import { loginHref, routeHref } from '../state';
import { CopyButton } from './CopyButton';
import { ArrowIcon } from './Icons';

const SERVE_COMMAND = 'portal-aluno serve';

const PROMISES = [
  { title: 'Só leitura', text: 'Nenhuma rota altera nada no portal.' },
  { title: 'Senha fica com você', text: 'Vai só para o servidor local e dele para o portal. Nunca é salva.' },
  { title: 'Sessão na memória', text: 'Some quando você sai ou encerra o servidor.' },
  { title: 'Token por login', text: 'Outros sites abertos no navegador não conseguem usar a API.' },
];

const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

export function StartPage({ model }: { model: DocModel }) {
  const localHost = hostOf(model.serverUrl) || location.host;
  const portalHost = hostOf(model.portalUrl);

  return (
    <div className="start">
      <section className="hero">
        <p className="overline overline--gold">Comece aqui</p>
        <h1>Seus dados do Portal do Aluno, em JSON.</h1>
        <p>
          Uma API somente leitura que roda no seu computador. Ela entra no portal com a sua conta, organiza as
          respostas e serve tudo em <code>127.0.0.1</code>. Não existe servidor no meio, então ninguém além de você e
          do portal vê sua senha.
        </p>
      </section>

      <section aria-labelledby="passos">
        <h2 id="passos">Testar em três passos</h2>
        <div className="steps">
          <div className="card step">
            <span className="step__number">01</span>
            <h3>Rode o servidor local</h3>
            <p>
              Precisa do Node 22 ou mais novo. Dentro do repositório, o mesmo comando é <code>npm run serve</code>.
            </p>
            <div className="actions">
              <code className="code-chip">{SERVE_COMMAND}</code>
              <CopyButton text={SERVE_COMMAND} small />
            </div>
          </div>
          <div className="card step">
            <span className="step__number">02</span>
            <h3>Abra a documentação</h3>
            <p>O terminal mostra o endereço. Sem entrar, dá para ler todos os endpoints e exemplos.</p>
            <pre className="terminal">{`Documentação: http://${localHost}/docs/`}</pre>
          </div>
          <div className="card step">
            <span className="step__number">03</span>
            <h3>Entre e teste</h3>
            <p>
              Use o ícone no canto superior direito para entrar com o usuário e a senha do portal. Depois, cada endpoint
              ganha o botão de enviar.
            </p>
            <div className="actions">
              <a className="btn btn--primary btn--small" href={loginHref({ kind: 'inicio' })}>
                Entrar
              </a>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="fluxo">
        <h2 id="fluxo">Para onde vão seus dados</h2>
        <div className="card flow">
          <div className="flow__node">
            <span className="overline">Seu navegador</span>
            <strong>Esta documentação</strong>
            <span>Envia a senha uma vez ao servidor local; depois, só o token.</span>
          </div>
          <ArrowIcon />
          <div className="flow__node flow__node--local">
            <span className="overline overline--gold">Seu computador</span>
            <strong>
              <code>{localHost}</code>
            </strong>
            <span>Guarda a sessão na memória e organiza as respostas.</span>
          </div>
          <ArrowIcon />
          <div className="flow__node">
            <span className="overline">Portal do Aluno</span>
            <strong>
              <code>{portalHost}</code>
            </strong>
            <span>Recebe o login e as chamadas, como faria o seu navegador.</span>
          </div>
        </div>
        <div className="promises">
          {PROMISES.map((promise) => (
            <div className="promise" key={promise.title}>
              <strong>{promise.title}</strong>
              <span>{promise.text}</span>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="indice">
        <div className="section-head">
          <h2 id="indice">Todos os endpoints</h2>
          <span className="muted">
            {model.operations.length} {model.operations.length === 1 ? 'rota' : 'rotas'}
          </span>
        </div>
        <div className="index">
          {model.tags.map((tag) => (
            <div className="card index__group" key={tag.name}>
              <header>
                <span className="overline overline--gold">{tag.name}</span>
                <span>{tag.description}</span>
              </header>
              {tag.operations.map((op) => (
                <a className="index__route" key={op.id} href={routeHref({ kind: 'operacao', id: op.id })}>
                  <code>
                    {op.method} {op.path}
                  </code>
                  <span>{op.summary}</span>
                </a>
              ))}
            </div>
          ))}
        </div>
        <p className="muted">
          Fora do escopo, de propósito: financeiro e pagamentos, troca de senha, matrícula e qualquer escrita no portal.
        </p>
      </section>
    </div>
  );
}
