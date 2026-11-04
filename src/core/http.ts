import { Cookie, CookieJar, cookieCompare } from 'tough-cookie';
import type { PortalConfig } from './config.js';
import { PortalError } from './errors.js';
import { createThrottle } from './throttle.js';
import './tls.js';

export type FetchFn = typeof fetch;

export interface PortalRequest {
  method: 'GET' | 'POST';
  url: URL;
  /** Sent as `application/json`. */
  json?: unknown;
  /**
   * Cookies for this request only, replacing the jar's cookies of the same
   * name. Values are sent as is. The jar itself does not change.
   */
  cookies?: Record<string, string>;
}

export interface PortalResponse {
  status: number;
  /** `Location` header, for 3xx responses. */
  location: string | null;
  body: string;
}

/** A response read as bytes, for file downloads. */
export interface PortalBytesResponse {
  status: number;
  location: string | null;
  /** `Content-Type`, `Content-Disposition` and the rest, as the portal sent them. */
  headers: Headers;
  bytes: Uint8Array<ArrayBuffer>;
}

/** The frontend's `accept` header for API calls (ENDPOINTS.md 1). */
const ACCEPT = 'application/json, text/plain, */*';

/**
 * Low-level transport to the portal: one in-memory cookie jar, throttled
 * requests, and no automatic redirects. Redirects carry the session-expiry
 * signal, so callers must see them. Never logs anything.
 */
export class PortalHttp {
  readonly #config: PortalConfig;
  readonly #fetch: FetchFn;
  readonly #schedule: ReturnType<typeof createThrottle>;
  #jar = new CookieJar();

  constructor(config: PortalConfig, fetchFn: FetchFn = fetch) {
    this.#config = config;
    this.#fetch = fetchFn;
    this.#schedule = createThrottle(config.minRequestIntervalMs);
  }

  request(req: PortalRequest): Promise<PortalResponse> {
    return this.#schedule(async () => {
      const res = await this.#send(req);
      const body = await this.#read(res, req, () => res.text());
      return { status: res.status, location: res.headers.get('location'), body };
    });
  }

  /** Like `request`, reading the body as bytes. */
  requestBytes(req: PortalRequest): Promise<PortalBytesResponse> {
    return this.#schedule(async () => {
      const res = await this.#send(req);
      const bytes = await this.#read(res, req, async () => new Uint8Array(await res.arrayBuffer()));
      return { status: res.status, location: res.headers.get('location'), headers: res.headers, bytes };
    });
  }

  /** Sets a host-only cookie on the portal origin, path `/`. The value is stored as is, not URL-encoded. */
  async setCookie(name: string, value: string): Promise<void> {
    const cookie = new Cookie({ key: name, value, path: '/' });
    await this.#jar.setCookie(cookie, this.#config.baseUrl);
  }

  /** Drops every cookie. Local only: it does not tell the portal. */
  clearCookies(): void {
    this.#jar = new CookieJar();
  }

  /** Sends the request and stores the cookies it sets. The body is left for the caller to read. */
  async #send({ method, url, json, cookies: overrides = {} }: PortalRequest): Promise<Response> {
    const headers = new Headers({ accept: ACCEPT, 'user-agent': this.#config.userAgent });
    const jar = (await this.#jar.getCookies(url.href)).sort(cookieCompare).filter((c) => !Object.hasOwn(overrides, c.key));
    const cookies = [...jar.map((c) => c.cookieString()), ...Object.entries(overrides).map(([name, value]) => `${name}=${value}`)];
    if (cookies.length > 0) headers.set('cookie', cookies.join('; '));

    let body: string | undefined;
    if (json !== undefined) {
      body = JSON.stringify(json);
      headers.set('content-type', 'application/json');
    }

    let res: Response;
    try {
      res = await this.#fetch(url, {
        method,
        headers,
        body,
        redirect: 'manual',
        signal: AbortSignal.timeout(this.#config.timeoutMs),
      });
    } catch (cause) {
      throw new PortalError('portal_indisponivel', `Não foi possível falar com o portal (${method} ${url.pathname}).`, { cause });
    }

    for (const setCookie of res.headers.getSetCookie()) {
      await this.#jar.setCookie(setCookie, url.href, { ignoreError: true });
    }
    return res;
  }

  async #read<T>(res: Response, { method, url }: PortalRequest, read: () => Promise<T>): Promise<T> {
    try {
      return await read();
    } catch (cause) {
      throw new PortalError('portal_indisponivel', `A resposta do portal foi interrompida (${method} ${url.pathname}).`, { cause });
    }
  }
}
