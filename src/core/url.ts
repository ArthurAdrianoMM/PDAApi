import { API_BASE_PATH } from './config.js';

export type QueryValue = string | number | boolean | undefined;

/** Builds `{baseUrl}/FrameHTML/RM/API/{path}?{query}`. Undefined query values are left out. */
export function apiUrl(baseUrl: string, path: string, query: Record<string, QueryValue> = {}): URL {
  const url = new URL(API_BASE_PATH + path.replace(/^\/+/, ''), baseUrl);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url;
}
