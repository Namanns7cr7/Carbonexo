import type { Metadata } from 'next';
import { ExperienceLanding } from '@/components/experience';

/** Preview of the cinematic landing. A new route — it does not replace / or /welcome.
 *  Integration into the public landing is a separate, reviewed step
 *  (docs/experience-integration.md). */
export const metadata: Metadata = {
  title: 'Carbonexo — Living Earth (preview)',
  robots: { index: false, follow: false },
};

export default function ExperiencePreviewPage() {
  return <ExperienceLanding />;
}
