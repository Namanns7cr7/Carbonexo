import type { Metadata } from 'next';
import { PlanetJourney } from '@/components/journey/PlanetJourney';

export const metadata: Metadata = {
  title: 'Carbonexo — Your choices shape tomorrow',
  description: 'Track your footprint, see where carbon comes from on a live Earth, and reduce your impact with simple swaps.',
};

/** Marketing landing page. The app entry point (/) redirects to /login; this
 *  page stays reachable directly at /welcome.
 *
 *  The living-planet journey (components/journey) replaces the six-chapter
 *  scroll story. The chapter components remain in the tree, unmounted, so
 *  that change is easy to review or revert. */
export default function Welcome() {
  return <PlanetJourney />;
}
