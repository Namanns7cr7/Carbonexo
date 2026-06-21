'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useCarbon } from '@/lib/store';
import { ACTIONS, CATEGORY_META } from '@/lib/carbon';
import { getCoachHistory, sendCoachMessage } from '@/lib/api/ai';
import { isAuthenticated } from '@/lib/api/auth';

interface Msg {
  id: number | string;
  role: 'user' | 'ai';
  text: React.ReactNode;
  prompt?: string;
  provider?: string;
  model?: string;
}

const SUGGESTIONS = [
  'Is my travel footprint high?',
  'Easiest action today?',
  'How much can metro save?',
  'How am I doing this week?',
];

function PromptInspector({ prompt, provider, model }: { prompt: string; provider?: string; model?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2 text-left border-t border-border/30 pt-1.5">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-[11px] font-bold text-lime-deep hover:underline focus:outline-none"
        aria-expanded={open}
      >
        <span>{open ? '▼' : '▶'}</span>
        <span>Inspect Prompt Engineering Details</span>
        {provider && model && (
          <span className="text-[10px] text-muted font-normal">
            ({provider} · {model})
          </span>
        )}
      </button>
      {open && (
        <pre className="mt-2 max-w-full overflow-x-auto rounded-lg bg-surface2 border border-border p-2.5 font-mono text-[10px] text-text whitespace-pre-wrap leading-relaxed">
          {prompt}
        </pre>
      )}
    </div>
  );
}

export default function Coach() {
  const { profile, biggestSource, todayTotal, streak, totalSaved, weekTotals } = useCarbon();
  const weekTotal = Math.round(weekTotals.reduce((s, d) => s + d.total, 0));
  const bsLabel = biggestSource ? CATEGORY_META[biggestSource.category].label : 'travel';

  const [msgs, setMsgs] = useState<Msg[]>([
    {
      id: 0,
      role: 'ai',
      text: (
        <>Hi {profile.name}! I&apos;m your Carbonexo coach. Ask me anything about reducing your footprint — or tap a suggestion below.</>
      ),
    },
  ]);
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(1);

  // Load chat history on mount if authenticated
  useEffect(() => {
    const loadHistory = async () => {
      if (!isAuthenticated()) return;
      try {
        const history = await getCoachHistory();
        if (history.length > 0) {
          const mapped: Msg[] = history.map((h) => ({
            id: h.id,
            role: h.role === 'assistant' ? 'ai' : 'user',
            text: h.content,
            provider: h.provider || 'gemini',
            model: h.model || 'gemini-2.0-flash',
          }));
          setMsgs([
            {
              id: 'welcome',
              role: 'ai',
              text: <>Hi {profile.name}! I&apos;m your Carbonexo coach. Ask me anything about reducing your footprint — or tap a suggestion below.</>,
            },
            ...mapped,
          ]);
        }
      } catch (err) {
        console.warn('Failed to load chat history from API', err);
      }
    };
    loadHistory();
  }, [profile.name]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, typing]);

  const reply = (q: string): React.ReactNode => {
    const s = q.toLowerCase();
    if (s.includes('travel') || s.includes('high') || s.includes('footprint')) {
      return (
        <>Your <strong>{bsLabel.toLowerCase()}</strong> emissions are your largest source ({biggestSource?.value ?? 0} kg this week).
          Swapping two car trips for the metro could save around <strong className="text-lime-deep">8 kg CO₂</strong> and noticeably lift your weekly score.</>
      );
    }
    if (s.includes('easiest') || s.includes('action') || s.includes('today')) {
      const easy = ACTIONS.find((a) => a.difficulty === 'Easy')!;
      return (
        <>The easiest win right now: <strong>{easy.title.toLowerCase()}</strong>. It&apos;s low-effort and saves about
          <strong className="text-lime-deep"> {easy.saving} kg/week</strong>. Want me to add it to your plan? You can do it from the Actions tab.</>
      );
    }
    if (s.includes('metro') || s.includes('save') || s.includes('how much')) {
      return (
        <>Replacing a ~13 km car commute with the metro saves roughly <strong className="text-lime-deep">2 kg CO₂ per trip</strong>.
          Do that twice a week and you&apos;re looking at <strong>~8 kg/week</strong> — one of the biggest single levers you have.</>
      );
    }
    if (s.includes('week') || s.includes('doing') || s.includes('progress')) {
      return (
        <>This week you&apos;ve tracked <strong>{weekTotal} kg</strong>, with a <strong>{streak}-day streak</strong> 🔥 and
          <strong className="text-lime-deep"> {totalSaved} kg</strong> saved overall. Today is at {todayTotal} kg — keep it up!</>
      );
    }
    return (
      <>Great question! Your biggest opportunity is <strong>{bsLabel.toLowerCase()}</strong>. Start with one small swap there this week —
        consistency beats intensity. Check the Actions tab for tailored ideas.</>
    );
  };

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || typing) return;
    const userId = 'user-' + Date.now() + '-' + idRef.current++;
    setMsgs((m) => [...m, { id: userId, role: 'user', text: q }]);
    setInput('');
    setTyping(true);

    if (isAuthenticated()) {
      try {
        const response = await sendCoachMessage(q);
        setMsgs((m) => [
          ...m,
          {
            id: 'ai-' + Date.now() + '-' + idRef.current++,
            role: 'ai',
            text: response.result,
            prompt: response.prompt,
            provider: 'gemini',
            model: 'gemini-2.0-flash',
          },
        ]);
        setTyping(false);
        return;
      } catch (err) {
        console.warn('API call failed, falling back to local simulation', err);
      }
    }

    // fallback simulation
    setTimeout(() => {
      setTyping(false);
      setMsgs((m) => [
        ...m,
        {
          id: 'ai-canned-' + Date.now() + '-' + idRef.current++,
          role: 'ai',
          text: reply(q),
        },
      ]);
    }, 1300);
  };

  return (
    <div className="flex h-[calc(100vh-150px)] min-h-[460px] flex-col md:h-[calc(100vh-110px)]">
      {/* header */}
      <div className="mb-3 flex items-center gap-2.5 border-b border-border pb-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-lime text-lg">✦</div>
        <div>
          <div className="text-[15px] font-bold">Carbonexo Coach</div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-lime-deep">
            <span className="h-[7px] w-[7px] rounded-full bg-lime" /> Online now
          </div>
        </div>
      </div>

      {/* messages */}
      <div ref={scrollRef} className="cx-scroll flex-1 space-y-3 overflow-y-auto pr-1">
        {msgs.map((m) =>
          m.role === 'user' ? (
            <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
              <div className="max-w-[82%] rounded-[18px_18px_5px_18px] bg-lime px-4 py-2.5 text-[14.5px] font-medium leading-[1.5] text-[#0c1d15]">{m.text}</div>
            </motion.div>
          ) : (
            <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start gap-2.5">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] bg-lime-soft text-sm">✦</div>
              <div className="max-w-[82%] rounded-[18px_18px_18px_5px] border border-border bg-surface2 px-4 py-3 text-[14.5px] leading-[1.55]">
                <div>{m.text}</div>
                {m.prompt && (
                  <PromptInspector prompt={m.prompt} provider={m.provider} model={m.model} />
                )}
              </div>
            </motion.div>
          )
        )}
        {typing && (
          <div className="flex justify-start gap-2.5">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] bg-lime-soft text-sm">✦</div>
            <div className="flex gap-1.5 rounded-[18px_18px_18px_5px] border border-border bg-surface2 px-4 py-4">
              {[0, 0.2, 0.4].map((d) => (
                <span key={d} className="h-2 w-2 rounded-full bg-muted" style={{ animation: `blink 1.2s ${d}s infinite` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* suggestions */}
      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => send(q)}
            disabled={typing}
            className="rounded-full border border-border px-3 py-1.5 text-[12.5px] font-semibold text-muted transition-colors hover:border-lime hover:text-lime-deep disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>

      {/* input */}
      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="mt-3 flex items-center gap-2 rounded-[16px] border border-border bg-surface p-1.5 pl-4"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask your coach…"
          aria-label="Ask your coach"
          className="flex-1 bg-transparent text-[15px] outline-none"
        />
        <button
          type="submit"
          disabled={!input.trim() || typing}
          className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-lime text-lg font-bold text-[#0c1d15] transition-transform hover:-translate-y-0.5 disabled:opacity-40"
          aria-label="Send"
        >
          ↑
        </button>
      </form>
    </div>
  );
}
