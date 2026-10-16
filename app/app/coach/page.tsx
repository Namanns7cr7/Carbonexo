'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCarbon } from '@/lib/store';
import { ACTIONS, CATEGORY_META } from '@/lib/carbon';
import { getCoachHistory, sendCoachMessage } from '@/lib/api/ai';
import { isAuthenticated } from '@/lib/api/auth';
import { CLIMATE_KNOWLEDGE_BASE, generateScientificCoachAdvice } from '@/lib/data/climate-knowledge';
import { BookOpen, CheckCircle2, ChevronDown, ChevronRight, Sparkles, Terminal, X } from 'lucide-react';

interface Msg {
  id: number | string;
  role: 'user' | 'ai';
  text: string;
  prompt?: string;
  provider?: string;
  model?: string;
  source?: string;
  citation?: string;
}

const SCIENTIFIC_SUGGESTIONS = [
  '🚆 Car vs Metro savings? (DEFRA 2024)',
  '🥩 Beef vs chicken & lentils? (Oxford)',
  '⚡ AC & appliance consumption (EPA)',
  '🎯 Am I on track for 2030 Paris target?',
  '💡 Easiest quick win for today?',
];

function PromptInspector({
  prompt,
  provider,
  model,
  citation,
  source,
}: {
  prompt: string;
  provider?: string;
  model?: string;
  citation?: string;
  source?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3 text-left border-t border-border/40 pt-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-[11px] font-bold text-lime-deep hover:underline focus:outline-none"
        aria-expanded={open}
      >
        <span>{open ? <ChevronDown className="h-3 w-3 inline" /> : <ChevronRight className="h-3 w-3 inline" />}</span>
        <Terminal className="h-3 w-3 inline text-lime-deep" />
        <span>Inspect Prompt & Scientific Grounding</span>
        {provider && model && (
          <span className="text-[10px] text-muted font-normal">
            ({provider} · {model})
          </span>
        )}
      </button>

      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-2 space-y-2"
        >
          {source && (
            <div className="rounded-md bg-surface border border-border p-2 text-[11px]">
              <span className="font-semibold text-text">Dataset: </span>
              <span className="text-lime-deep font-medium">{source}</span>
              {citation && <p className="text-[10px] text-muted mt-1 leading-snug">{citation}</p>}
            </div>
          )}
          <pre className="max-w-full overflow-x-auto rounded-lg bg-surface2 border border-border p-2.5 font-mono text-[10.5px] text-text whitespace-pre-wrap leading-relaxed">
            {prompt}
          </pre>
        </motion.div>
      )}
    </div>
  );
}

// Simple, safe inline markdown formatter
function FormattedMessage({ text }: { text: string }) {
  const paragraphs = text.split('\n\n');

  return (
    <div className="space-y-2 text-[14px] leading-relaxed">
      {paragraphs.map((para, i) => {
        // Bullet list
        if (para.includes('\n• ') || para.startsWith('• ') || para.startsWith('1. ')) {
          const lines = para.split('\n');
          return (
            <ul key={i} className="space-y-1.5 my-1.5 pl-1">
              {lines.map((line, j) => {
                const clean = line.replace(/^[•\d\.]+\s*/, '');
                return (
                  <li key={j} className="flex items-start gap-2">
                    <span className="text-lime-deep font-bold mt-0.5">•</span>
                    <span>{renderBold(clean)}</span>
                  </li>
                );
              })}
            </ul>
          );
        }

        return <p key={i}>{renderBold(para)}</p>;
      })}
    </div>
  );
}

function renderBold(str: string): React.ReactNode {
  const parts = str.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="font-semibold text-text">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

export default function Coach() {
  const { profile, biggestSource, todayTotal, streak, totalSaved, weekTotals } = useCarbon();
  const weekTotal = Math.round(weekTotals.reduce((s, d) => s + d.total, 0));
  const bsLabel = biggestSource ? CATEGORY_META[biggestSource.category].label : 'travel';

  const [showSourcesModal, setShowSourcesModal] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      id: 0,
      role: 'ai',
      text: `Hi ${profile.name || 'there'}! I'm your Carbonexo Coach, grounded in verified data from UK DEFRA 2024, Oxford University food science, US EPA eGRID, and IPCC benchmarks.\n\nAsk me anything about your footprint, carbon math, or tap a verified scientific query below!`,
      source: 'UK DEFRA 2024, Oxford University & IPCC AR6',
      citation: 'Pre-loaded verified open climate science repository (Zero cost, no paywall).',
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
              text: `Hi ${profile.name || 'there'}! I'm your Carbonexo Coach, grounded in verified datasets from UK DEFRA 2024, Oxford University, US EPA eGRID, and IPCC AR6. Ask me anything or explore suggestions below.`,
              source: 'UK DEFRA 2024 & IPCC AR6',
              citation: 'Public domain & open scientific data.',
            },
            ...mapped,
          ]);
        }
      } catch (err) {
        console.warn('Chat history API unavailable, using verified local grounding', err);
      }
    };
    loadHistory();
  }, [profile.name]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, typing]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || typing) return;

    const userId = 'user-' + Date.now() + '-' + idRef.current++;
    setMsgs((m) => [...m, { id: userId, role: 'user', text: q }]);
    setInput('');
    setTyping(true);

    // Prepare verified scientific advice
    const scientific = generateScientificCoachAdvice({
      query: q,
      userName: profile.name || 'Sakshi',
      todayTotal,
      biggestCategory: bsLabel,
      biggestValue: biggestSource?.value ?? 3.1,
      streak,
      totalSaved,
    });

    if (isAuthenticated()) {
      try {
        const response = await sendCoachMessage(q);
        setMsgs((m) => [
          ...m,
          {
            id: 'ai-' + Date.now() + '-' + idRef.current++,
            role: 'ai',
            text: response.result || scientific.response,
            prompt: response.prompt || scientific.promptUsed,
            provider: 'gemini',
            model: 'gemini-2.0-flash',
            source: scientific.source,
            citation: scientific.citation,
          },
        ]);
        setTyping(false);
        return;
      } catch (err) {
        console.info('Backend API unavailable. Using verified open scientific dataset.', err);
      }
    }

    // High fidelity fallback with exact scientific grounding
    setTimeout(() => {
      setTyping(false);
      setMsgs((m) => [
        ...m,
        {
          id: 'ai-sci-' + Date.now() + '-' + idRef.current++,
          role: 'ai',
          text: scientific.response,
          prompt: scientific.promptUsed,
          source: scientific.source,
          citation: scientific.citation,
          provider: 'Scientific Grounding Engine',
          model: 'DEFRA-2024 / Oxford-2018 / EPA',
        },
      ]);
    }, 700);
  };

  return (
    <div className="flex h-[calc(100vh-150px)] min-h-[460px] flex-col md:h-[calc(100vh-110px)] relative">
      {/* header */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-gradient-to-br from-lime to-emerald-400 text-lg shadow-sm">
            <Sparkles className="h-5 w-5 text-[#0c1d15]" />
          </div>
          <div>
            <div className="text-[15px] font-bold flex items-center gap-1.5">
              Carbonexo Coach
              <span className="text-[10px] font-semibold bg-lime-soft text-lime-deep px-1.5 py-0.5 rounded border border-lime/30">
                Scientifically Grounded
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-lime-deep">
              <span className="h-[7px] w-[7px] rounded-full bg-lime animate-pulse" /> Live Climate Data Engine Active
            </div>
          </div>
        </div>

        {/* View Knowledge Base Button */}
        <button
          onClick={() => setShowSourcesModal(true)}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-border bg-surface2 hover:border-lime hover:text-lime-deep transition-all shadow-sm"
        >
          <BookOpen className="h-3.5 w-3.5 text-lime-deep" />
          <span>Scientific Sources (Free/Open)</span>
        </button>
      </div>

      {/* messages */}
      <div ref={scrollRef} className="cx-scroll flex-1 space-y-3 overflow-y-auto pr-1">
        {msgs.map((m) =>
          m.role === 'user' ? (
            <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
              <div className="max-w-[82%] rounded-[18px_18px_5px_18px] bg-lime px-4 py-2.5 text-[14.5px] font-medium leading-[1.5] text-[#0c1d15] shadow-sm">
                {m.text}
              </div>
            </motion.div>
          ) : (
            <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start gap-2.5">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] bg-lime-soft text-sm mt-0.5">
                ✦
              </div>
              <div className="max-w-[84%] rounded-[18px_18px_18px_5px] border border-border bg-surface2 px-4 py-3 text-[14px] leading-[1.55] shadow-sm">
                {/* Source Badge if present */}
                {m.source && (
                  <div className="mb-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-lime/10 text-lime-deep border border-lime/25">
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    <span>Source: {m.source.split(';')[0]}</span>
                  </div>
                )}

                <FormattedMessage text={m.text} />

                {m.prompt && (
                  <PromptInspector
                    prompt={m.prompt}
                    provider={m.provider}
                    model={m.model}
                    source={m.source}
                    citation={m.citation}
                  />
                )}
              </div>
            </motion.div>
          )
        )}
        {typing && (
          <div className="flex justify-start gap-2.5">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] bg-lime-soft text-sm">✦</div>
            <div className="flex items-center gap-1.5 rounded-[18px_18px_18px_5px] border border-border bg-surface2 px-4 py-3">
              <span className="text-xs text-muted font-medium mr-1">Calculating verified metrics</span>
              {[0, 0.2, 0.4].map((d) => (
                <span key={d} className="h-1.5 w-1.5 rounded-full bg-lime" style={{ animation: `blink 1.2s ${d}s infinite` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* suggestions */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {SCIENTIFIC_SUGGESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => send(q)}
            disabled={typing}
            className="rounded-full border border-border bg-surface/80 backdrop-blur px-3 py-1.5 text-[12px] font-semibold text-muted transition-all hover:border-lime hover:text-lime-deep hover:bg-lime-soft/40 disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>

      {/* input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mt-3 flex items-center gap-2 rounded-[16px] border border-border bg-surface p-1.5 pl-4 shadow-sm focus-within:border-lime transition-all"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask your coach anything about carbon, diet, travel, or appliances..."
          aria-label="Ask your coach"
          className="flex-1 bg-transparent text-[14.5px] outline-none"
        />
        <button
          type="submit"
          disabled={!input.trim() || typing}
          className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-lime text-lg font-bold text-[#0c1d15] transition-transform hover:-translate-y-0.5 disabled:opacity-40 shadow-sm"
          aria-label="Send"
        >
          ↑
        </button>
      </form>

      {/* Knowledge Base Modal */}
      <AnimatePresence>
        {showSourcesModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-surface border border-border p-6 shadow-2xl cx-scroll"
            >
              <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
                <div>
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-lime-deep" />
                    Verified Climate Knowledge Base
                  </h3>
                  <p className="text-xs text-muted mt-0.5">
                    100% Free, Public Domain & Peer-Reviewed Scientific Datasets
                  </p>
                </div>
                <button
                  onClick={() => setShowSourcesModal(false)}
                  className="rounded-lg p-1.5 text-muted hover:text-text hover:bg-surface2 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs leading-relaxed">
                {CLIMATE_KNOWLEDGE_BASE.map((bm) => (
                  <div key={bm.id} className="p-3.5 rounded-xl border border-border bg-surface2/60">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-bold text-[13px] text-text">{bm.topic}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-lime-soft text-lime-deep border border-lime/30">
                        {bm.category}
                      </span>
                    </div>

                    <p className="text-muted mb-2">{bm.summary}</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-2 p-2 rounded-lg bg-surface border border-border/60">
                      <div>
                        <span className="text-[10px] text-muted block">Benchmark Metric:</span>
                        <span className="font-mono font-bold text-lime-deep text-xs">
                          {bm.value} {bm.unit}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted block">Primary Source:</span>
                        <span className="font-semibold text-text text-[11px] truncate block">
                          {bm.source}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 text-[10px] text-muted italic border-t border-border/40 pt-1.5">
                      Citation: {bm.citation}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 pt-4 border-t border-border flex justify-end">
                <button
                  onClick={() => setShowSourcesModal(false)}
                  className="px-4 py-2 rounded-xl bg-lime font-bold text-xs text-[#0c1d15] hover:opacity-90 transition-opacity"
                >
                  Done Exploring
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
