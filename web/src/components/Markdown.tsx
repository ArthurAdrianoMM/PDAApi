import type { ReactNode } from 'react';
import { parseBlocks, parseInline } from '../lib/markdown';
import { InfoIcon, WarningIcon } from './Icons';

export function InlineText({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((part, i) => {
        switch (part.type) {
          case 'code':
            return <code key={i}>{part.value}</code>;
          case 'strong':
            return <strong key={i}>{part.value}</strong>;
          case 'link':
            return (
              <a key={i} href={part.href} {...(part.href.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {})}>
                {part.value}
              </a>
            );
          default:
            return part.value;
        }
      })}
    </>
  );
}

export function Callout({ tone, title, children }: { tone: 'note' | 'warning'; title: string; children: ReactNode }) {
  const Icon = tone === 'warning' ? WarningIcon : InfoIcon;
  return (
    <div className={`callout callout--${tone}`} role="note">
      <Icon size={18} />
      <div className="callout__body">
        {title && <strong className="callout__title">{title}</strong>}
        {children}
      </div>
    </div>
  );
}

/** Renders the Markdown subset described in lib/markdown.ts. */
export function Markdown({ text, className = 'prose' }: { text: string; className?: string }) {
  return (
    <div className={className}>
      {parseBlocks(text).map((block, i) => {
        if (block.kind === 'alert') {
          return (
            <Callout key={i} tone={block.tone} title={block.title}>
              <p>
                <InlineText text={block.text} />
              </p>
            </Callout>
          );
        }
        if (block.kind === 'list') {
          return (
            <ul key={i}>
              {block.items.map((item, j) => (
                <li key={j}>
                  <InlineText text={item} />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i}>
            <InlineText text={block.text} />
          </p>
        );
      })}
    </div>
  );
}
