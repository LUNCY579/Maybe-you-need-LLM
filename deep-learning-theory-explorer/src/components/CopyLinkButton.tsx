import { useState } from 'react';
import { Button } from './ui';
import { shareUrlFor, useSharedSetup } from '../lib/sharedSetup';

/**
 * A shareable link to the current experiment.
 *
 * The link carries the whole shared setup, so a reader who opens it sees the
 * same activation, the same initialization and the same seed. That makes a
 * result reproducible by a second person rather than only by its author.
 */
export function CopyLinkButton() {
  const { setup } = useSharedSetup();
  const [state, setState] = useState<'idle' | 'copied' | 'manual'>('idle');
  const [url, setUrl] = useState('');

  const build = () => {
    if (typeof window === 'undefined') return '';
    return shareUrlFor(setup, `${window.location.origin}${window.location.pathname}`, window.location.hash);
  };

  const copy = async () => {
    const link = build();
    setUrl(link);
    try {
      await navigator.clipboard.writeText(link);
      setState('copied');
    } catch {
      // Clipboard access can be denied; show the link so it can be copied by hand.
      setState('manual');
    }
  };

  return (
    <div className="space-y-1">
      <Button variant="ghost" onClick={copy} title="Copy a link that reproduces this setup exactly">
        {state === 'copied' ? 'link copied ✓' : 'copy link to this setup'}
      </Button>
      {state === 'manual' && (
        <input
          className="mono w-full rounded border border-lab-600 bg-lab-900 px-2 py-1 text-[11px] text-lab-100"
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="the shareable link"
        />
      )}
    </div>
  );
}
