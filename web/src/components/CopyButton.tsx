import { useEffect, useRef, useState } from 'react';
import { CopyIcon } from './Icons';

export function CopyButton({ text, label = 'Copiar', small = false }: { text: string; label?: string; small?: boolean }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      setState('failed');
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState('idle'), 1500);
  }

  return (
    <button type="button" className={`btn btn--ghost${small ? ' btn--small' : ''}`} onClick={copy} aria-live="polite">
      <CopyIcon size={14} />
      {state === 'copied' ? 'Copiado' : state === 'failed' ? 'Não copiou' : label}
    </button>
  );
}
