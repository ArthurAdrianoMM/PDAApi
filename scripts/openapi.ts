/**
 * Writes openapi.json at the repository root. It is committed, so every change
 * to the API shows up as a diff; test/openapi.test.ts fails when it is stale.
 *
 *   npm run openapi
 */
import { writeFile } from 'node:fs/promises';
import { generateOpenApi } from '../src/openapi/generate.js';

const OPENAPI_FILE = new URL('../openapi.json', import.meta.url);

await writeFile(OPENAPI_FILE, JSON.stringify(generateOpenApi(), null, 2) + '\n');
console.log('openapi.json atualizado.');
