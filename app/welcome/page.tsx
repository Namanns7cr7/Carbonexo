import { Navbar } from '@/components/Navbar';
import { AmbientBackground } from '@/components/AmbientBackground';
import { WindLeaves } from '@/components/WindLeaves';
import { ChapterPlanet } from '@/components/chapters/ChapterPlanet';
import { ChapterTrace } from '@/components/chapters/ChapterTrace';
import { ChapterImpact } from '@/components/chapters/ChapterImpact';
import { ChapterTwin } from '@/components/chapters/ChapterTwin';
import { ChapterChange } from '@/components/chapters/ChapterChange';
import { ChapterDawn } from '@/components/chapters/ChapterDawn';
import { FeatureCards } from '@/components/FeatureCards';
import { AICoachPreview } from '@/components/AICoachPreview';

/** Marketing landing page. The app entry point (/) redirects to /login; this
 *  page stays reachable directly at /welcome.
 *
 *  Chapter 1 (ChapterPlanet) is the opening scene. It replaces the previous
 *  HeroSection, which carried invented social proof — "120k+ daily trackers",
 *  "2.4M kg CO2 saved together", "4.9 star app rating" — none of which is real
 *  data. The component is left in the tree but is no longer rendered.
 *
 *  Chapters 2–6 supersede JourneyFlow, CarbonSwapSection, ProgressSection and
 *  FinalCTA the same way. ProgressSection's figures (5-day streak, 42 kg,
 *  18 actions, a badge) were invented; every number in the chapters is derived
 *  from the emission-factor and action catalogs (lib/story.ts). The navbar's
 *  anchors still resolve: #swap and #progress live in Chapter 5, and the two
 *  light "toolkit" sections (#features, #coach) sit between Chapters 4 and 5. */
export default function Welcome() {
  return (
    /* root wrapper carries the (possibly-gradient) themed background */
    <div className="relative min-h-screen overflow-x-hidden" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <AmbientBackground />
      <WindLeaves />
      <div className="relative z-[1]">
        <Navbar />
        <ChapterPlanet />
        <ChapterTrace />
        <ChapterImpact />
        <ChapterTwin />
        <FeatureCards />
        <AICoachPreview />
        <ChapterChange />
        <ChapterDawn />
      </div>
    </div>
  );
}
