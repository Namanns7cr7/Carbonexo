import type { Metadata } from 'next';
import { PlanetJourney } from '@/components/journey/PlanetJourney';
import { RedirectIfSignedIn } from '@/components/app/RedirectIfSignedIn';

export const metadata: Metadata = {
  title: 'Carbonexo — Your choices shape tomorrow',
  description: 'Track your footprint, see where carbon comes from on a live Earth, and reduce your impact with simple swaps.',
};

/** Home page: the living-planet landing, served here directly (it used to sit
 *  behind a client redirect to /welcome, which now redirects back here).
 *  Signed-in visitors go on to the app; sign-out lands here.
 *
 *  The living-planet journey (components/journey) replaces the six-chapter
 *  scroll story. The chapter components remain in the tree, unmounted, so
 *  that change is easy to review or revert. */
export default function Home() {
  return (
    <>
      <RedirectIfSignedIn />
      <PlanetJourney />
    </>
  );
}
