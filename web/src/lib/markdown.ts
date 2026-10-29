/**
 * A small Markdown reader for the texts in the OpenAPI document, which this
 * project writes itself. It covers what those texts use: paragraphs, lists,
 * GitHub-style alerts (`> [!NOTE]`, `> [!WARNING]`), `code`, **bold** and
 * links. It returns data, never HTML, so nothing is injected into the page.
 */

export type Inline =
  | { type: 'text'; value: string }
  | { type: 'code'; value: string }
  | { type: 'strong'; value: string }
  | { type: 'link'; value: string; href: string };

export type Block =
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'alert'; tone: 'note' | 'warning'; title: string; text: string };

const ALERT_MARKER = /^\[!(NOTE|WARNING)\]$/;
const ALERT_TITLE = /^\*\*(.+)\*\*$/;

export function parseBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of markdown.trim().split(/\n\s*\n/)) {
    const lines = chunk.split('\n');

    if (lines.every((line) => line.startsWith('>'))) {
      const body = lines.map((line) => line.replace(/^>\s?/, ''));
      const marker = ALERT_MARKER.exec(body[0] ?? '');
      if (marker) {
        const rest = body.slice(1);
        const title = ALERT_TITLE.exec(rest[0] ?? '');
        const text = (title ? rest.slice(1) : rest).join(' ').trim();
        blocks.push({ kind: 'alert', tone: marker[1] === 'WARNING' ? 'warning' : 'note', title: title?.[1] ?? '', text });
        continue;
      }
      blocks.push({ kind: 'paragraph', text: body.join(' ').trim() });
      continue;
    }

    if (lines.every((line) => /^[-*] /.test(line))) {
      blocks.push({ kind: 'list', items: lines.map((line) => line.slice(2).trim()) });
      continue;
    }

    blocks.push({ kind: 'paragraph', text: lines.join(' ').trim() });
  }
  return blocks.filter((block) => block.kind !== 'paragraph' || block.text !== '');
}

const INLINE = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

/** Only links that stay on http(s), in-page anchors or this server. */
function safeHref(href: string): string | null {
  return /^(https?:\/\/|#|\/)/.test(href) ? href : null;
}

export function parseInline(text: string): Inline[] {
  const parts: Inline[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    if (match.index > last) parts.push({ type: 'text', value: text.slice(last, match.index) });
    const [whole, code, strong, label, href] = match;
    if (code !== undefined) parts.push({ type: 'code', value: code });
    else if (strong !== undefined) parts.push({ type: 'strong', value: strong });
    else if (label !== undefined && href !== undefined) {
      const safe = safeHref(href);
      parts.push(safe ? { type: 'link', value: label, href: safe } : { type: 'text', value: whole });
    }
    last = match.index + whole.length;
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) });
  return parts;
}
