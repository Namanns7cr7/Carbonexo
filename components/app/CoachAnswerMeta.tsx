'use client';

import { useState } from 'react';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { sendCoachFeedback, type CoachCitation, type FeedbackReason } from '@/lib/api/ai';

const DOWN_REASONS: { id: FeedbackReason; label: string }[] = [
  { id: 'incorrect_number', label: 'Wrong number' },
  { id: 'wrong_citation', label: 'Wrong source' },
  { id: 'ignored_my_data', label: 'Ignored my data' },
  { id: 'wrong_region', label: 'Wrong region' },
  { id: 'unsupported_claim', label: 'Unsupported claim' },
  { id: 'unclear', label: 'Unclear' },
];

/**
 * Under a live coach answer: who produced it, the sources it cites (only those the tools supplied),
 * and thumbs feedback. Research consent is opt-in and off by default.
 */
export function CoachAnswerMeta({
  responseId,
  provider,
  model,
  citations = [],
}: {
  responseId?: string | null;
  provider?: string | null;
  model?: string | null;
  citations?: CoachCitation[];
}) {
  const [rating, setRating] = useState<1 | -1 | null>(null);
  const [reasons, setReasons] = useState<FeedbackReason[]>([]);
  const [correction, setCorrection] = useState('');
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<'idle' | 'sent' | 'error'>('idle');

  const submit = async (r: 1 | -1, rs: FeedbackReason[] = reasons) => {
    if (!responseId) return;
    try {
      await sendCoachFeedback(responseId, {
        rating: r,
        reasons: r === 1 ? ['helpful'] : rs,
        correction: correction.trim() || undefined,
        consentResearch: consent,
      });
      setState('sent');
    } catch {
      setState('error');
    }
  };

  return (
    <div className="mt-3 space-y-2 border-t border-border/40 pt-2 text-[11px] text-slate-300">
      {provider && model && <div className="text-[10px] text-muted">Answered by {provider} · {model}</div>}

      {citations.length > 0 && (
        <ol className="space-y-1">
          {citations.map((c) => (
            <li key={c.marker} className="leading-snug">
              <span className="font-semibold text-emerald-300">[{c.marker}]</span> {c.title}
              {c.locator ? <span className="text-muted"> — {c.locator}</span> : null}
              {c.review_status === 'CANDIDATE' && (
                <span className="ml-1 rounded bg-amber-500/15 px-1 text-[10px] text-amber-300">provisional: not yet reviewed by a person</span>
              )}
            </li>
          ))}
        </ol>
      )}

      {responseId && state !== 'sent' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-muted">Was this useful?</span>
            <button aria-label="Helpful" onClick={() => { setRating(1); void submit(1); }}
              className={`rounded p-1 hover:bg-emerald-500/15 ${rating === 1 ? 'text-emerald-300' : ''}`}>
              <ThumbsUp className="h-3.5 w-3.5" />
            </button>
            <button aria-label="Not helpful" onClick={() => setRating(-1)}
              className={`rounded p-1 hover:bg-red-500/15 ${rating === -1 ? 'text-red-300' : ''}`}>
              <ThumbsDown className="h-3.5 w-3.5" />
            </button>
          </div>
          {rating === -1 && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1">
                {DOWN_REASONS.map((r) => (
                  <button key={r.id}
                    onClick={() => setReasons((x) => (x.includes(r.id) ? x.filter((y) => y !== r.id) : [...x, r.id]))}
                    className={`rounded border px-1.5 py-0.5 ${reasons.includes(r.id) ? 'border-red-400 text-red-200' : 'border-border text-muted'}`}>
                    {r.label}
                  </button>
                ))}
              </div>
              <textarea value={correction} onChange={(e) => setCorrection(e.target.value.slice(0, 2000))} rows={2}
                placeholder="Optional: what should the answer have said?"
                className="w-full rounded border border-border bg-slate-900/60 p-1.5 text-[11px]" />
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                Let Carbonexo reviewers use this conversation to improve the coach
              </label>
              <button onClick={() => void submit(-1)} className="rounded bg-slate-700 px-2 py-0.5 text-white">Send feedback</button>
            </div>
          )}
          {state === 'error' && <div className="text-red-300">Could not send feedback.</div>}
        </div>
      )}
      {state === 'sent' && <div className="text-emerald-300">Thanks for the feedback.</div>}
    </div>
  );
}
