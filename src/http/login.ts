/**
 * Who is logged in to the local server: at most one portal session, and the
 * bearer token that opens it. A new login replaces the previous one, so a
 * token from an older login stops working.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Credentials, PortalSession, SessionState } from '../core/index.js';

/** Creates a portal session that logs in with these credentials (and again after the portal expires it). */
export type OpenSession = (credentials: Credentials) => PortalSession;

export const createToken = (): string => randomBytes(32).toString('base64url');

const digest = (value: string) => createHash('sha256').update(value).digest();

export class LocalLogin {
  readonly #open: OpenSession;
  #current: { session: PortalSession; digest: Buffer } | null = null;

  constructor(open: OpenSession, initial?: { session: PortalSession; token: string }) {
    this.#open = open;
    if (initial) this.#current = { session: initial.session, digest: digest(initial.token) };
  }

  /** Logs in to the portal. On success the new session replaces the current one; on failure nothing changes. */
  async login(credentials: Credentials): Promise<{ token: string; state: SessionState }> {
    const session = this.#open(credentials);
    let state: SessionState;
    try {
      state = await session.login();
    } catch (error) {
      session.forget();
      throw error;
    }
    const token = createToken();
    this.#current?.session.forget();
    this.#current = { session, digest: digest(token) };
    return { token, state };
  }

  /** The session this token opens, or null. */
  sessionFor(token: string | null): PortalSession | null {
    const current = this.#current;
    if (!current || token === null) return null;
    return timingSafeEqual(digest(token), current.digest) ? current.session : null;
  }

  /** Forgets the session, if this token opens it. */
  logout(token: string | null): boolean {
    const session = this.sessionFor(token);
    if (!session) return false;
    session.forget();
    this.#current = null;
    return true;
  }
}
