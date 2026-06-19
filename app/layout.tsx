import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ThemeProvider } from '@/lib/theme-provider';
import { CarbonexoProvider } from '@/lib/store';
import { ServiceWorker } from '@/components/ServiceWorker';

export const metadata: Metadata = {
  title: 'Carbonexo — Track your footprint. Reduce your impact.',
  description:
    'Carbonexo helps you track daily activities, understand your carbon footprint, and reduce emissions through simple actions and personalized AI insights.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Carbonexo' },
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f5ee' },
    { media: '(prefers-color-scheme: dark)', color: '#08110d' },
  ],
};

/**
 * Theme flash guard: set the `.dark` class before React hydrates so the
 * first paint already matches the stored/system preference.
 */
const themeScript = `
(function(){try{
  var s=localStorage.getItem('cx-theme');
  var d=s ? s==='dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  if(d) document.documentElement.classList.add('dark');
}catch(e){}})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeProvider>
          <CarbonexoProvider>{children}</CarbonexoProvider>
        </ThemeProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
