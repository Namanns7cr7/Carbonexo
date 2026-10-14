import { Navbar } from '@/components/Navbar';
import { AmbientBackground } from '@/components/AmbientBackground';
import { WindLeaves } from '@/components/WindLeaves';
import { ChapterPlanet } from '@/components/chapters/ChapterPlanet';
import { JourneyFlow } from '@/components/JourneyFlow';
import { FeatureCards } from '@/components/FeatureCards';
import { CarbonSwapSection } from '@/components/CarbonSwapSection';
import { ProgressSection } from '@/components/ProgressSection';
import { AICoachPreview } from '@/components/AICoachPreview';
import { FinalCTA } from '@/components/FinalCTA';

/** Marketing landing page. The app entry point (/) redirects to /login; this
 *  page stays reachable directly at /welcome.
 *
 *  Chapter 1 (ChapterPlanet) is the opening scene. It replaces the previous
 *  HeroSection, which carried invented social proof — "120k+ daily trackers",
 *  "2.4M kg CO2 saved together", "4.9 star app rating" — none of which is real
 *  data. The component is left in the tree but is no longer rendered. */
export default function Welcome() {
  return (
    /* root wrapper carries the (possibly-gradient) themed background */
    <div className="relative min-h-screen overflow-x-hidden" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <AmbientBackground />
      <WindLeaves />
      <div className="relative z-[1]">
        <Navbar />
        <ChapterPlanet />
        <JourneyFlow />
        <FeatureCards />
        <CarbonSwapSection />
        <ProgressSection />
        <AICoachPreview />
        <FinalCTA />
      </div>
    </div>
  );
}
