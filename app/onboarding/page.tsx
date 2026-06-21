'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AmbientBackground } from '@/components/AmbientBackground';
import { PillGrid } from '@/components/onboarding/PillGrid';
import { useCarbon } from '@/lib/store';

const TRAVEL = [
  { v: 'Car', e: '🚗' },
  { v: 'Motorbike', e: '🛵' },
  { v: 'Bus', e: '🚌' },
  { v: 'Metro', e: '🚇' },
  { v: 'Bike', e: '🚲' },
  { v: 'Walk', e: '🚶' },
];
const DIET = [
  { v: 'Meat-heavy', e: '🥩', d: 'Meat most meals' },
  { v: 'Mixed', e: '🍽️', d: 'A bit of everything' },
  { v: 'Vegetarian', e: '🥗', d: 'No meat' },
  { v: 'Vegan', e: '🌱', d: 'Fully plant-based' },
];
const LEVELS = [
  { v: 'Low', e: '🍃', d: 'Mindful usage' },
  { v: 'Medium', e: '⚡', d: 'Average household' },
  { v: 'High', e: '🔌', d: 'AC, appliances often' },
];
const SHOPPING = [
  { v: 'Rarely', e: '🌿', d: 'Only essentials' },
  { v: 'Sometimes', e: '🛍️', d: 'A few times a month' },
  { v: 'Often', e: '📦', d: 'Frequent orders' },
];
const GOALS = [
  { v: 10, label: 'Gentle', d: 'Reduce ~10% / week' },
  { v: 15, label: 'Steady', d: 'Reduce ~15% / week' },
  { v: 25, label: 'Ambitious', d: 'Reduce ~25% / week' },
];

/** split/join helpers for comma-separated multi-select values */
const toList = (csv: string | undefined): string[] =>
  (csv ?? '').split(',').map((s) => s.trim()).filter(Boolean);

interface Draft {
  name: string;
  travelModes: string[];
  dailyDistance: number;
  diets: string[];
  electricity: string;
  shopping: string[];
  weeklyGoalPct: number;
}


export default function Onboarding() {
  const router = useRouter();
  const { profile, saveProfile, completeOnboarding } = useCarbon();
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>({
    name: profile.name || '',
    travelModes: toList(profile.travelMode) ,
    dailyDistance: profile.dailyDistance,
    diets: toList(profile.diet),
    electricity: profile.electricity,
    shopping: toList(profile.shopping),
    weeklyGoalPct: profile.weeklyGoalPct,
  });
  const updateDraft = (patch: Partial<Draft>) => setD((p) => ({ ...p, ...patch }));

  // toggle a value in/out of a string-array field
  const toggleIn = (key: 'travelModes' | 'diets' | 'shopping', v: string) =>
    setD((p) => {
      const has = p[key].includes(v);
      return { ...p, [key]: has ? p[key].filter((x) => x !== v) : [...p[key], v] };
    });

  const steps = [
    {
      title: `Welcome to Carbonexo`,
      sub: 'A few quick questions so we can personalize your daily footprint. What should we call you?',
      body: (
        <input
          autoFocus
          value={d.name}
          onChange={(e) => updateDraft({ name: e.target.value })}
          placeholder="Your name"
          className="w-full rounded-[14px] border border-border bg-surface px-4 py-3.5 text-[15px] font-semibold outline-none transition-colors focus:border-lime"
        />
      ),
      valid: d.name.trim().length > 0,
    },
    {
      title: 'How do you usually get around?',
      sub: 'Pick every mode you use — select as many as apply.',
      body: <PillGrid options={TRAVEL} selected={d.travelModes} onToggle={(v) => toggleIn('travelModes', v)} cols={3} />,
      valid: d.travelModes.length > 0,
    },
    {
      title: 'Roughly how far each day?',
      sub: 'Your typical daily travel distance.',
      body: (
        <div className="rounded-[16px] border border-border bg-surface p-5">
          <div className="mb-4 text-center">
            <span className="font-display text-[40px] font-extrabold text-lime">{d.dailyDistance}</span>
            <span className="ml-1 text-base font-bold text-muted">km / day</span>
          </div>
          <input
            id="daily-distance"
            type="range"
            min={0}
            max={120}
            step={1}
            value={d.dailyDistance}
            onChange={(e) => updateDraft({ dailyDistance: Number(e.target.value) })}
            className="w-full accent-lime"
            aria-label="Daily travel distance"
            aria-valuemin={0}
            aria-valuemax={120}
            aria-valuenow={d.dailyDistance}
          />
          <div className="mt-2 flex justify-between text-xs text-muted">
            <span>0</span>
            <span>120 km</span>
          </div>
        </div>
      ),
      valid: true,
    },
    {
      title: 'How would you describe your diet?',
      sub: 'Pick all that fit your typical week.',
      body: <PillGrid options={DIET} selected={d.diets} onToggle={(v) => toggleIn('diets', v)} />,
      valid: d.diets.length > 0,
    },
    {
      title: 'Home electricity use?',
      sub: 'A rough sense is enough.',
      body: <PillGrid options={LEVELS} selected={[d.electricity]} onToggle={(v) => updateDraft({ electricity: v })} cols={3} />,
      valid: true,
    },
    {
      title: 'How often do you shop?',
      sub: 'Pick all the ways you buy things.',
      body: <PillGrid options={SHOPPING} selected={d.shopping} onToggle={(v) => toggleIn('shopping', v)} cols={3} />,
      valid: d.shopping.length > 0,
    },
    {
      title: 'Set your weekly goal',
      sub: 'How fast do you want to cut your footprint? You can change this anytime.',
      body: <PillGrid options={GOALS} selected={[d.weeklyGoalPct]} onToggle={(v) => updateDraft({ weeklyGoalPct: v })} />,
      valid: true,
    },
  ];

  const current = steps[step];
  const last = step === steps.length - 1;
  const progress = ((step + 1) / steps.length) * 100;

  const [saving, setSaving] = useState(false);

  const next = async () => {
    if (!current.valid || saving) return;
    if (last) {
      setSaving(true);
      try {
        // save answers first, then mark onboarded (sequential — avoids a race
        // where "complete onboarding" runs before the profile row exists)
        await saveProfile({
          name: d.name,
          travelMode: d.travelModes.join(', '),
          dailyDistance: d.dailyDistance,
          diet: d.diets.join(', '),
          electricity: d.electricity,
          shopping: d.shopping.join(', '),
          weeklyGoalPct: d.weeklyGoalPct,
        });
        await completeOnboarding();
        router.replace('/app');
      } finally {
        setSaving(false);
      }
      return;
    }
    setStep((s) => s + 1);
  };

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <AmbientBackground />
      <div className="relative z-[1] mx-auto flex min-h-screen max-w-[520px] flex-col px-5 py-6">
        <div className="mb-6 flex items-center justify-between">
          <Logo />
          <ThemeToggle />
        </div>

        {/* progress */}
        <div className="mb-1 h-1.5 w-full overflow-hidden rounded-full bg-border">
          <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${progress}%`, background: 'linear-gradient(90deg,var(--lime),var(--blue))' }} />
        </div>
        <div className="mb-7 text-xs font-semibold text-muted">Step {step + 1} of {steps.length}</div>

        <div className="flex flex-1 flex-col">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.32, ease: [0.2, 0.7, 0.2, 1] }}
            >
              <h1 className="mb-2 font-display text-[clamp(24px,5vw,32px)] font-extrabold leading-[1.1] tracking-[-0.03em]">{current.title}</h1>
              <p className="mb-6 text-[15px] leading-[1.5] text-muted">{current.sub}</p>
              {current.body}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-8 flex items-center gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="rounded-[14px] border border-border bg-surface px-5 py-3.5 text-[15px] font-bold text-text transition-colors hover:border-lime"
            >
              Back
            </button>
          )}
          <button
            onClick={next}
            disabled={!current.valid || saving}
            className="flex-1 rounded-[14px] bg-lime px-6 py-3.5 text-[15px] font-bold text-[#0c1d15] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ boxShadow: '0 12px 30px -12px var(--lime)' }}
          >
            {saving ? 'Saving…' : last ? 'Start tracking →' : 'Continue'}
          </button>
        </div>
        {step === 0 && (
          <button onClick={next} className="mt-3 text-center text-sm font-semibold text-muted transition-colors hover:text-lime" disabled={!current.valid}>
            Skip the intro
          </button>
        )}
      </div>
    </div>
  );
}
