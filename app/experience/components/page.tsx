import type { Metadata } from 'next';
import { ComponentGallery } from './ComponentGallery';

/** Component gallery with SAMPLE fixtures — the Storybook-style preview for
 *  components/visualizations. Not linked from the app. */
export const metadata: Metadata = {
  title: 'Carbonexo — Visualization components (preview)',
  robots: { index: false, follow: false },
};

export default function ComponentsPreviewPage() {
  return <ComponentGallery />;
}
