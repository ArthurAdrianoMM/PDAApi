/** Hash routes of the docs page. */

/** `entrar` is the login screen; `voltar` is the page to return to afterwards. */
export type Route = { kind: 'inicio' } | { kind: 'operacao'; id: string } | { kind: 'entrar'; voltar: string };

function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return '';
  }
}

export function parseRoute(hash: string): Route {
  const login = /^#\/entrar(?:\?voltar=([^&#]*))?/.exec(hash);
  if (login) {
    const voltar = decode(login[1] ?? '');
    // Only back into this page, and never back to the login screen itself.
    return { kind: 'entrar', voltar: voltar.startsWith('#/') && !voltar.startsWith('#/entrar') ? voltar : '#/' };
  }
  const match = /^#\/operacao\/([^/?#]+)/.exec(hash);
  return match ? { kind: 'operacao', id: decode(match[1]!) } : { kind: 'inicio' };
}

export function routeHref(route: Route): string {
  if (route.kind === 'operacao') return `#/operacao/${encodeURIComponent(route.id)}`;
  if (route.kind === 'entrar') return route.voltar === '#/' ? '#/entrar' : `#/entrar?voltar=${encodeURIComponent(route.voltar)}`;
  return '#/';
}

/** The login screen, returning to `from` afterwards. */
export const loginHref = (from: Route): string =>
  routeHref({ kind: 'entrar', voltar: from.kind === 'entrar' ? from.voltar : routeHref(from) });
