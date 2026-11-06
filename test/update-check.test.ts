import { describe, expect, it, vi } from 'vitest';
import { checkForUpdate, isNewer, updateHint } from '../src/cli/update-check.js';

const registry = (body: unknown, status = 200) =>
  vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));

describe('isNewer', () => {
  it.each([
    ['0.2.0', '0.1.0', true],
    ['1.0.0', '0.9.9', true],
    ['0.10.0', '0.9.0', true],
    ['0.1.1', '0.1.0', true],
    ['0.2.0', '0.2.0-beta.1', true],
    ['0.1.0', '0.1.0', false],
    ['0.1.0', '0.2.0', false],
    ['0.3.0-beta.0', '0.2.0', false],
    ['nada', '0.1.0', false],
  ])('%s over %s: %s', (candidate, current, expected) => {
    expect(isNewer(candidate, current)).toBe(expected);
  });
});

describe('checkForUpdate', () => {
  it('returns the newer version from the latest tag', async () => {
    const fetch = registry({ version: '0.3.0' });
    expect(await checkForUpdate('portal-2', '0.2.0', { env: {}, fetch })).toBe('0.3.0');
    expect(fetch).toHaveBeenCalledWith('https://registry.npmjs.org/portal-2/latest', expect.anything());
  });

  it('asks for a scoped package by its encoded name', async () => {
    const fetch = registry({ version: '0.1.0' });
    await checkForUpdate('@escopo/portal-2', '0.1.0', { env: {}, fetch });
    expect(fetch).toHaveBeenCalledWith('https://registry.npmjs.org/@escopo%2fportal-2/latest', expect.anything());
  });

  it('returns null when up to date', async () => {
    expect(await checkForUpdate('portal-2', '0.3.0', { env: {}, fetch: registry({ version: '0.3.0' }) })).toBeNull();
  });

  it('stays quiet on errors and odd answers', async () => {
    const offline = vi.fn<typeof fetch>(async () => {
      throw new TypeError('fetch failed');
    });
    expect(await checkForUpdate('portal-2', '0.1.0', { env: {}, fetch: offline })).toBeNull();
    expect(await checkForUpdate('portal-2', '0.1.0', { env: {}, fetch: registry({ error: 'Not found' }, 404) })).toBeNull();
    expect(await checkForUpdate('portal-2', '0.1.0', { env: {}, fetch: registry({ version: 3 }) })).toBeNull();
  });

  it.each([{ NO_UPDATE_NOTIFIER: '1' }, { CI: 'true' }])('makes no request when %o is set', async (env) => {
    const fetch = registry({ version: '9.9.9' });
    expect(await checkForUpdate('portal-2', '0.1.0', { env, fetch })).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('updateHint', () => {
  it('suggests npx @latest under npx, and a global install otherwise', () => {
    expect(updateHint('portal-2', { npm_command: 'exec' })).toBe('npx portal-2@latest serve');
    expect(updateHint('portal-2', {})).toBe('npm install -g portal-2@latest');
  });
});
