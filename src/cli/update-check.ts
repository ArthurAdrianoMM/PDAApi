/**
 * Tells `serve` when npm has a newer release. One request to the npm registry,
 * made after the server is listening: it sends only the package name, never
 * delays startup, and stays quiet when offline or on any error.
 *
 * `mcp` doesn't use it: its stdout carries the protocol, and clients that start
 * it with `npx -y portal-2@latest` already get the newest release.
 *
 * Off when NO_UPDATE_NOTIFIER (the variable npm tools share) or CI is set.
 */

const REGISTRY = 'https://registry.npmjs.org';
// Generous: it runs after startup, so a slow network delays nothing but the notice.
const TIMEOUT_MS = 5000;

type Version = { core: [number, number, number]; prerelease: boolean };

function parse(version: string): Version | null {
  const match = /^(\d+)\.(\d+)\.(\d+)(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/.exec(version);
  if (!match) return null;
  return { core: [Number(match[1]), Number(match[2]), Number(match[3])], prerelease: match[4] !== undefined };
}

/** True when `candidate` is a release (no `-beta.0`) newer than `current`. */
export function isNewer(candidate: string, current: string): boolean {
  const next = parse(candidate);
  const now = parse(current);
  if (!next || !now || next.prerelease) return false;
  for (let i = 0; i < 3; i++) {
    if (next.core[i]! !== now.core[i]!) return next.core[i]! > now.core[i]!;
  }
  // Same x.y.z: the release is newer than its own pre-releases.
  return now.prerelease;
}

export interface UpdateCheckOptions {
  env?: NodeJS.ProcessEnv;
  fetch?: typeof globalThis.fetch;
}

/** The newer version on npm's `latest` tag, or `null` (up to date, turned off, or unknown). */
export async function checkForUpdate(name: string, current: string, options: UpdateCheckOptions = {}): Promise<string | null> {
  const env = options.env ?? process.env;
  if (env.NO_UPDATE_NOTIFIER || env.CI) return null;
  try {
    const response = await (options.fetch ?? fetch)(`${REGISTRY}/${name.replace('/', '%2f')}/latest`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const { version } = (await response.json()) as { version?: unknown };
    return typeof version === 'string' && isNewer(version, current) ? version : null;
  } catch {
    return null;
  }
}

/** What to run to update, depending on how this process was started. */
export function updateHint(name: string, env: NodeJS.ProcessEnv = process.env): string {
  // npx (npm exec) sets npm_command=exec; an outdated npx run means its cache is stale.
  return env.npm_command === 'exec' ? `npx ${name}@latest serve` : `npm install -g ${name}@latest`;
}
