import { useEffect, useMemo, useState } from 'react';
import { OperationPage } from './components/OperationPage';
import { Sidebar } from './components/Sidebar';
import { StartPage } from './components/StartPage';
import { TopBar } from './components/TopBar';
import { searchOperations } from './lib/search';
import { buildModel, type DocModel, type OpenApiDocument } from './lib/spec';
import { routeHref, useConnection, useRoute, useTheme } from './state';

/** The page sits at /docs/; the document is served next to it, at /openapi.json. */
const SPEC_URL = '../openapi.json';

export function App() {
  const [model, setModel] = useState<DocModel | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState('');
  const route = useRoute();
  const connection = useConnection();
  const [theme, toggleTheme] = useTheme();

  useEffect(() => {
    fetch(SPEC_URL, { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<OpenApiDocument>;
      })
      .then((doc) => setModel(buildModel(doc)))
      .catch(() => setLoadError(true));
  }, []);

  const results = useMemo(
    () => (model && query.trim() ? searchOperations(model.operations, query) : null),
    [model, query],
  );

  const operation = model && route.kind === 'operacao' ? model.operations.find((op) => op.id === route.id) : undefined;

  useEffect(() => {
    document.title = operation ? `${operation.summary} · Portal do Aluno API` : 'Portal do Aluno API';
    window.scrollTo(0, 0);
  }, [operation]);

  if (loadError) {
    return (
      <main className="screen-message">
        <h1>Não foi possível carregar a documentação</h1>
        <p>
          O arquivo <code>openapi.json</code> não respondeu. Confira se o servidor ainda está rodando no terminal.
        </p>
      </main>
    );
  }
  if (!model) {
    return (
      <main className="screen-message" aria-busy="true">
        <p>Carregando…</p>
      </main>
    );
  }

  return (
    <>
      <TopBar
        title={model.title}
        version={model.version}
        query={query}
        onQuery={setQuery}
        onSubmitQuery={() => {
          const first = results?.[0];
          if (first) location.hash = routeHref({ kind: 'operacao', id: first.id });
        }}
        connection={connection.state}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <div className="layout">
        <Sidebar model={model} route={route} results={results} connection={connection.state} />
        <main className="content">
          {operation ? (
            <OperationPage key={operation.id} model={model} operation={operation} connection={connection} />
          ) : route.kind === 'operacao' ? (
            <div className="screen-message">
              <h1>Endpoint não encontrado</h1>
              <p>
                <a href="#/">Voltar para o início</a>
              </p>
            </div>
          ) : (
            <StartPage model={model} />
          )}
        </main>
      </div>
    </>
  );
}
