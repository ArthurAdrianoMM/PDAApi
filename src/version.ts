import { readFileSync } from 'node:fs';

/**
 * package.json is the single source of the name and version. This file sits one
 * level below it both as source (src/) and built (dist/), and the published
 * package and the .mcpb bundle both carry package.json.
 */
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { name: string; version: string };

export const PACKAGE_NAME: string = pkg.name;
export const VERSION: string = pkg.version;
