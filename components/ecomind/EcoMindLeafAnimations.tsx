'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Check, Copy, Sparkles } from 'lucide-react';

/**
 * Lightweight SVG Leaf Sprout thinking animation.
 * Features an organic seedling that softly sways and 3 bouncing spore dots.
 * Strictly CSS/SVG transform-based (no heavy canvas, 0 GPU stalls).
 */
export function LeafSproutThinking({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-1.5 px-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/20 backdrop-blur-sm shadow-sm max-w-fit">
      <div className="relative flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/25 to-teal-500/15 border border-emerald-400/30">
        {/* Organic SVG sprout */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 text-emerald-400 animate-pulse"
        >
          {/* Stem */}
          <path d="M12 22V10" />
          {/* Left leaf */}
          <path d="M12 14c-3-3-4-7-1-9 3.5 0 5 4 1 9z" fill="currentColor" fillOpacity="0.3" />
          {/* Right leaf */}
          <path d="M12 11c2.5-2.5 3.5-6 1-7.5-3 0-4 3.5-1 7.5z" fill="currentColor" fillOpacity="0.4" />
        </svg>

        {/* Ambient ping ring */}
        <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
      </div>

      <div className="flex flex-col">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-300">
          <span>{label || 'EcoMind'}</span>
          {/* Bouncing spore dots */}
          <span className="inline-flex items-center gap-1 ml-0.5">
            <span
              className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-bounce"
              style={{ animationDelay: '0ms', animationDuration: '900ms' }}
            />
            <span
              className="h-1.5 w-1.5 rounded-full bg-teal-300 animate-bounce"
              style={{ animationDelay: '180ms', animationDuration: '900ms' }}
            />
            <span
              className="h-1.5 w-1.5 rounded-full bg-lime-400 animate-bounce"
              style={{ animationDelay: '360ms', animationDuration: '900ms' }}
            />
          </span>
        </div>
        <span className="text-[10px] text-slate-400 font-medium">Thinking…</span>
      </div>
    </div>
  );
}

/**
 * Response Bloom Badge: subtle leaf/sparkle indicator shown on completion
 */
export function ResponseBloomBadge({ source, model }: { source?: string; model?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-300/90 bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-500/25"
    >
      <Sparkles className="h-3 w-3 text-emerald-400" />
      <span>{model || 'EcoMind'}</span>
      {source && (
        <>
          <span className="text-emerald-500/50">·</span>
          <span className="text-slate-300">{source.split(';')[0]}</span>
        </>
      )}
    </motion.div>
  );
}

export const LeafBloomBadge = ResponseBloomBadge;

/**
 * Animated Message Bubble wrapper with soft spring entrance
 */
export function AnimatedMessageBubble({
  children,
  role,
}: {
  children: React.ReactNode;
  role: 'user' | 'ai';
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      data-testid="chat-msg"
      data-role={role}
      className={`flex ${role === 'user' ? 'justify-end' : 'justify-start gap-2.5'}`}
    >
      {children}
    </motion.div>
  );
}

/**
 * Spring-based copy button with animated icon swap
 */
export function LeafCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      type="button"
      title="Copy grounded response"
      className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-emerald-300 transition-colors py-1 px-2 rounded-md hover:bg-slate-800/60 active:scale-95"
    >
      {copied ? (
        <>
          <Check className="h-3 w-3 text-emerald-400" />
          <span className="text-emerald-400">Copied</span>
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" />
          <span>Copy</span>
        </>
      )}
    </button>
  );
}
