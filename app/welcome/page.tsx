import { Navbar } from '@/components/Navbar';
import { AmbientBackground } from '@/components/AmbientBackground';
import { WindLeaves } from '@/components/WindLeaves';
import { HeroSection } from '@/components/HeroSection';
import { JourneyFlow } from '@/components/JourneyFlow';
import { FeatureCards } from '@/components/FeatureCards';
import { CarbonSwapSection } from '@/components/CarbonSwapSection';
import { ProgressSection } from '@/components/ProgressSection';
import { AICoachPreview } from '@/components/AICoachPreview';
import { FinalCTA } from '@/components/FinalCTA';

/** Marketing landing page. The app entry point (/) redirects to /login; this
 *  page stays reachable directly at /welcome. */
export default function Welcome() {
  return (
    /* root wrapper carries the (possibly-gradient) themed background */
    <div className="relative min-h-screen overflow-x-hidden" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <AmbientBackground />
      <WindLeaves />
      <div className="relative z-[1]">
        <Navbar />
        <HeroSection />
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
