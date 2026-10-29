import type { DocModel } from '../lib/spec';
import { routeHref } from '../state';
import { CopyButton } from './CopyButton';
import { ArrowIcon } from './Icons';

const SERVE_COMMAND = 'portal-aluno serve';

const PROMISES = [
  { title: 'Só leitura', text: 'Nenhuma rota altera nada no portal.' },
  { title: 'Senha fica com você', text: 'Digitada no terminal e enviada só ao portal.' },
  { title: 'Sessão na memória', text: 'Some quando você encerra o servidor.' },
  { title: 'Token por execução', text: 'Outros sites abertos no navegador não conseguem usar a API.' },
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
            <h3>Entre pelo terminal</h3>
            <p>Usuário e senha são pedidos lá, não no navegador. A senha não é salva em arquivo.</p>
            <pre className="terminal">{'Usuário (RA): ••••••••\nSenha:\n✓ Conectado. Matrícula do período 2026S2.'}</pre>
          </div>
          <div className="card step">
            <span className="step__number">03</span>
            <h3>Abra o link e teste</h3>
            <p>O terminal mostra o endereço desta documentação com um token que vale só para essa execução.</p>
            <pre className="terminal">{`Documentação:\nhttp://${localHost}/docs/#token=…`}</pre>
          </div>
        </div>
      </section>

      <section aria-labelledby="fluxo">
        <h2 id="fluxo">Para onde vão seus dados</h2>
        <div className="card flow">
          <div className="flow__node">
            <span className="overline">Seu navegador</span>
            <strong>Esta documentação</strong>
            <span>Envia o token local. Nunca vê a senha.</span>
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
