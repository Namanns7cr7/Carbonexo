'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Maximize2, Send, RotateCcw, Compass, ArrowUpRight } from 'lucide-react';
import { useEcoMindContext } from '@/lib/context/ecomind-context';
import { useCarbon } from '@/lib/store';
import { COACH_MESSAGE_MAX_CHARS, sendCoachMessage, getCoachHistory, type CoachHistoryEntry } from '@/lib/api/ai';
import { isAuthenticated } from '@/lib/api/auth';
import { generateScientificCoachAdvice } from '@/lib/data/climate-knowledge';
import { smallTalkReply } from '@/lib/ai/small-talk';
import { COACH_CHAT_STORAGE_KEY } from '@/lib/constants';
import { modelLabel, OFFLINE_LIBRARY_PROVIDER } from '@/lib/ai/model-label';
import type { CoachCitation } from '@/lib/api/ai';
import { CoachCitations, CoachFeedbackButtons } from './CoachReplyMeta';
import {
  LeafSproutThinking,
  ResponseBloomBadge,
  AnimatedMessageBubble,
  LeafCopyButton,
} from './EcoMindLeafAnimations';

interface Msg {
  id: string | number;
  role: 'user' | 'ai';
  text: string;
  source?: string;
  model?: string;
  provider?: string;
  contextRoute?: string;
  citations?: CoachCitation[];
  responseId?: string | null;
}

const STORAGE_KEY = COACH_CHAT_STORAGE_KEY;

export function GlobalEcoMindPanel() {
  const pathname = usePathname();
  const isCoachPage = pathname === '/app/coach';
  const {
    pageContext,
    isGlobalChatOpen,
    setIsGlobalChatOpen,
    toggleGlobalChat,
    draftMessage,
    setDraftMessage,
  } = useEcoMindContext();

  const { profile, todayTotal, biggestSource, streak, totalSaved } = useCarbon();

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  // The model of the latest real reply; neutral "EcoMind" until one exists.
  const lastAnswered = [...msgs].reverse().find((m) => m.role === 'ai' && !String(m.id).startsWith('welcome'));
  const headerLabel = lastAnswered ? modelLabel(lastAnswered.provider, lastAnswered.model) : 'EcoMind';
  const scrollRef = useRef<HTMLDivElement>(null);
  const idCounter = useRef(1);

  // Sync messages with localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMsgs(parsed);
            return;
          }
        }
      } catch (e) {
        console.warn('Failed to parse local coach history', e);
      }
    }

    // Default welcome message if empty
    setMsgs([
      {
        id: 'welcome-global',
        role: 'ai',
        text: `Hi ${profile.name || 'there'}! I'm EcoMind, your climate intelligence copilot. I'm aware you're currently on the **${pageContext.pageTitle}** page. Ask me anything about your footprint or activities!`,
      },
    ]);
  }, [profile.name, pageContext.pageTitle]);

  // No local cache (new device, or after sign-out): restore this user's conversation from the server once.
  const historyLoaded = useRef(false);
  useEffect(() => {
    if (historyLoaded.current || !isAuthenticated()) return;
    historyLoaded.current = true;
    try {
      if (typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY)) return;
    } catch {
      // storage unavailable: fall through to the server copy
    }
    getCoachHistory()
      .then((history: CoachHistoryEntry[]) => {
        if (!history.length) return;
        setMsgs((current) =>
          current.length > 1
            ? current
            : [
                ...current,
                ...history.map((h) => ({
                  id: h.id,
                  role: h.role === 'assistant' ? ('ai' as const) : ('user' as const),
                  text: h.content,
                  provider: h.provider,
                  model: h.model,
                })),
              ]
        );
      })
      .catch((err) => console.warn('Coach history unavailable', err));
  }, []);

  // Save to localStorage whenever msgs change
  useEffect(() => {
    if (typeof window !== 'undefined' && msgs.length > 1) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs));
      } catch (e) {
        console.warn('Failed to persist msgs to localStorage', e);
      }
    }
  }, [msgs]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (isGlobalChatOpen && scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [msgs, typing, isGlobalChatOpen]);

  const clearChat = useCallback(() => {
    const fresh: Msg = {
      id: 'welcome-' + Date.now(),
      role: 'ai',
      text: `Chat reset. I'm ready to assist with **${pageContext.pageTitle}** or any sustainability question!`,
    };
    setMsgs([fresh]);
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {
        console.warn('Failed to clear storage', e);
      }
    }
  }, [pageContext.pageTitle]);

  const handleSend = async (textToSend: string) => {
    const q = textToSend.trim();
    if (!q || typing) return;

    const userMsg: Msg = {
      id: 'user-' + Date.now() + '-' + idCounter.current++,
      role: 'user',
      text: q,
      contextRoute: pageContext.route,
    };

    setMsgs((prev) => [...prev, userMsg]);
    setDraftMessage('');
    // Signed out: answer pure small talk locally. Signed in, the backend answers it
    // instantly (no model/RAG) and saves it to history.
    const chat = isAuthenticated() ? null : smallTalkReply(q);
    if (chat) {
      setMsgs((prev) => [
        ...prev,
        { id: 'ai-st-' + Date.now() + '-' + idCounter.current++, role: 'ai', text: chat, contextRoute: pageContext.route },
      ]);
      return;
    }

    setTyping(true);

    // Call API with active pageContext
    if (isAuthenticated()) {
      try {
        const response = await sendCoachMessage(q, pageContext);
        if (response.result?.trim()) {
          setMsgs((prev) => [
            ...prev,
            {
              id: 'ai-' + Date.now() + '-' + idCounter.current++,
              role: 'ai',
              text: response.result,
              model: response.model ?? undefined,
              provider: response.provider ?? undefined,
              contextRoute: pageContext.route,
              citations: response.citations,
              responseId: response.responseId,
            },
          ]);
          setTyping(false);
          return;
        }
      } catch (err) {
        console.info('Backend coach call fallback to open climate dataset', err);
      }
    }

    // High fidelity offline dataset fallback
    setTimeout(() => {
      const sci = generateScientificCoachAdvice({
        query: q,
        userName: profile.name || 'there',
        todayTotal,
        biggestCategory: biggestSource?.category || 'travel',
        biggestValue: biggestSource?.value ?? 0,
        streak,
        totalSaved,
      });

      setMsgs((prev) => [
        ...prev,
        {
          id: 'ai-sci-' + Date.now() + '-' + idCounter.current++,
          role: 'ai',
          text: sci.response,
          source: sci.source,
          provider: OFFLINE_LIBRARY_PROVIDER,
          contextRoute: pageContext.route,
        },
      ]);
      setTyping(false);
    }, 600);
  };

  // If already on the dedicated coach page, hide floating trigger to avoid redundancy
  if (isCoachPage) {
    return null;
  }

  return (
    <>
      {/* Floating EcoMind Leaf Trigger Pill (Fixed Bottom-Right) */}
      <div className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-40 no-print">
        <motion.button
          onClick={toggleGlobalChat}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          aria-label="Open EcoMind AI Assistant"
          className="flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-slate-900/90 hover:bg-slate-800 text-white border border-emerald-500/40 shadow-xl shadow-emerald-500/10 backdrop-blur-md transition-all group"
        >
          {/* Sprout Icon with Living Ping */}
          <div className="relative flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
            <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
            <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
          </div>

          <div className="flex flex-col text-left">
            <span className="text-xs font-bold leading-none text-emerald-300 flex items-center gap-1">
              EcoMind
            </span>
            <span className="text-[10px] text-slate-400 font-medium truncate max-w-[110px]">
              {pageContext.pageTitle}
            </span>
          </div>
        </motion.button>
      </div>

      {/* Persistent Chat Drawer / Panel */}
      <AnimatePresence>
        {isGlobalChatOpen && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-50 w-[92vw] sm:w-[420px] h-[550px] max-h-[80vh] flex flex-col rounded-2xl bg-slate-950/95 border border-emerald-500/30 shadow-2xl shadow-emerald-950/50 backdrop-blur-xl overflow-hidden no-print"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-emerald-500/20 bg-slate-900/60">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 border border-emerald-400/30 text-emerald-300">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-bold text-white">
                    <span>EcoMind AI</span>
                    <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded" data-testid="panel-model-label">
                      {headerLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-emerald-400/90 font-medium">
                    <Compass className="h-3 w-3 inline text-emerald-400" />
                    <span className="truncate max-w-[180px]">Active: {pageContext.pageTitle}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 text-slate-400">
                {/* Reset Chat */}
                <button
                  onClick={clearChat}
                  title="New Conversation"
                  className="p-1.5 rounded-lg hover:text-emerald-300 hover:bg-slate-800 transition-colors"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>

                {/* Expand to full /app/coach */}
                <Link
                  href="/app/coach"
                  onClick={() => setIsGlobalChatOpen(false)}
                  title="Open Fullscreen Coach"
                  className="p-1.5 rounded-lg hover:text-emerald-300 hover:bg-slate-800 transition-colors"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </Link>

                {/* Close Drawer */}
                <button
                  onClick={() => setIsGlobalChatOpen(false)}
                  title="Close"
                  className="p-1.5 rounded-lg hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Context Awareness Pill */}
            <div className="px-4 py-1.5 bg-emerald-950/30 border-b border-emerald-500/10 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Page Context:</span>
              <span className="text-emerald-300 font-medium truncate max-w-[240px]">
                {pageContext.pageTitle} · {profile.name || 'User'}
              </span>
            </div>

            {/* Messages Feed */}
            <div ref={scrollRef} className="cx-scroll flex-1 p-4 space-y-3 overflow-y-auto">
              {msgs.map((m) => (
                <AnimatedMessageBubble key={m.id} role={m.role}>
                  {m.role === 'user' ? (
                    <div className="max-w-[85%] rounded-[16px_16px_4px_16px] bg-gradient-to-r from-emerald-600 to-emerald-500 px-3.5 py-2 text-[13.5px] font-medium text-white shadow-sm">
                      {m.text}
                    </div>
                  ) : (
                    <>
                      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400 text-xs mt-0.5 border border-emerald-500/20">
                        ✦
                      </div>
                      <div className="max-w-[85%] rounded-[16px_16px_16px_4px] border border-emerald-500/20 bg-slate-900/80 px-3.5 py-2.5 text-[13px] leading-relaxed text-slate-100 shadow-sm space-y-2">
                        {!String(m.id).startsWith('welcome') && (
                          <ResponseBloomBadge source={m.source} model={modelLabel(m.provider, m.model)} />
                        )}
                        <p className="whitespace-pre-wrap">{m.text}</p>
                        <CoachCitations citations={m.citations} />
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <CoachFeedbackButtons responseId={m.responseId} />
                          <LeafCopyButton text={m.text} />
                        </div>
                      </div>
                    </>
                  )}
                </AnimatedMessageBubble>
              ))}

              {typing && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <LeafSproutThinking label="EcoMind" />
                </motion.div>
              )}
            </div>

            {/* Quick Context-Driven Suggestions */}
            <div className="px-3 py-1.5 flex gap-1.5 overflow-x-auto border-t border-emerald-500/10 bg-slate-950/50">
              <button
                onClick={() => handleSend(`How do I reduce my emissions on ${pageContext.pageTitle}?`)}
                disabled={typing}
                className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded-full bg-slate-900 border border-emerald-500/20 text-slate-300 hover:text-emerald-300 hover:border-emerald-500 transition-colors"
              >
                💡 Quick tips for {pageContext.pageTitle}
              </button>
              <button
                onClick={() => handleSend('Car vs Metro savings? (DEFRA 2024)')}
                disabled={typing}
                className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded-full bg-slate-900 border border-emerald-500/20 text-slate-300 hover:text-emerald-300 hover:border-emerald-500 transition-colors"
              >
                🚆 Car vs Metro
              </button>
            </div>

            {/* Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend(draftMessage);
              }}
              className="p-2.5 bg-slate-900/90 border-t border-emerald-500/20 flex items-center gap-2"
            >
              <input
                value={draftMessage}
                maxLength={COACH_MESSAGE_MAX_CHARS}
                onChange={(e) => setDraftMessage(e.target.value)}
                placeholder={`Ask EcoMind about ${pageContext.pageTitle}...`}
                disabled={typing}
                className="flex-1 bg-slate-950/80 border border-emerald-500/30 rounded-xl px-3 py-2 text-[13px] text-white placeholder-slate-400 focus:outline-none focus:border-emerald-400"
              />
              <button
                type="submit"
                disabled={!draftMessage.trim() || typing}
                aria-label="Send"
                className="h-8 w-8 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center font-bold disabled:opacity-40 transition-colors shadow-sm"
              >
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
