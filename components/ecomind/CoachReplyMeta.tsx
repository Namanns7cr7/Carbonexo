'use client';

import { useState } from 'react';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { sendCoachFeedback, type CoachCitation } from '@/lib/api/ai';

/**
 * Sources and feedback under a coach reply. Citations come only from the backend's
 * citation ledger (sources the tools returned and the answer cites); greetings and
 * offline replies have none, so nothing is shown for them.
 */
export function CoachCitations({ citations }: { citations?: CoachCitation[] }) {
  if (!citations?.length) return null;
  return (
    <div className="mt-2.5 space-y-1.5 border-t border-emerald-500/10 pt-2" aria-label="Sources">
      <div className="text-[10.5px] font-semibold uppercase tracking-wide text-emerald-400/80">Sources</div>
      {citations.map((c) => (
        <div key={c.marker} className="rounded-lg border border-emerald-500/20 bg-emerald-950/30 px-2.5 py-1.5 text-[11.5px] leading-snug">
          <div className="flex items-start gap-1.5">
            <span className="font-mono text-emerald-300">[{c.marker}]</span>
            <span className="font-medium text-slate-100">
              {c.resource?.startsWith('http') ? (
                <a href={c.resource} target="_blank" rel="noopener noreferrer" className="underline decoration-emerald-500/40 hover:text-emerald-200">
                  {c.title}
                </a>
              ) : (
                c.title
              )}
            </span>
          </div>
          {(c.review_status || c.locator) && (
            <div className="mt-0.5 pl-6 text-[10.5px] text-slate-400">
              {[c.review_status, c.locator].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function CoachFeedbackButtons({ responseId }: { responseId?: string | null }) {
  const [state, setState] = useState<'idle' | 'up' | 'down' | 'error'>('idle');
  if (!responseId) return null;
  const send = async (rating: 1 | -1) => {
    try {
      await sendCoachFeedback(responseId, { rating });
      setState(rating === 1 ? 'up' : 'down');
    } catch {
      setState('error');
    }
  };
  const done = state === 'up' || state === 'down';
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Rate this answer">
      <button
        type="button"
        onClick={() => send(1)}
        disabled={done}
        aria-pressed={state === 'up'}
        aria-label="Helpful"
        className={`rounded p-1 transition-colors ${state === 'up' ? 'text-emerald-300' : 'text-slate-400 hover:text-emerald-300'} disabled:cursor-default`}
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => send(-1)}
        disabled={done}
        aria-pressed={state === 'down'}
        aria-label="Not helpful"
        className={`rounded p-1 transition-colors ${state === 'down' ? 'text-amber-300' : 'text-slate-400 hover:text-amber-300'} disabled:cursor-default`}
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </button>
      {done && <span className="text-[10.5px] text-slate-400">Thanks for the feedback</span>}
      {state === 'error' && <span className="text-[10.5px] text-amber-300">Feedback not saved</span>}
    </div>
  );
}
