import type { Metadata, Viewport } from 'next';
import { Barlow, Azeret_Mono } from 'next/font/google';
import './globals.css';

const barlow = Barlow({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-barlow',
  display: 'swap',
});

const azeretMono = Azeret_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-azeret-mono',
  display: 'swap',
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Vendra — Know what you agreed',
    template: '%s · Vendra',
  },
  description:
    'Vendra keeps the quote, agreed terms, delivery and outcome of every supplier deal together, so your shop can check the history before buying again.',
  applicationName: 'Vendra',
  openGraph: {
    type: 'website',
    siteName: 'Vendra',
    title: 'Vendra — Know what you agreed',
    description:
      'A private, evidence-backed supplier deal memory for independent retailers.',
    url: siteUrl,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vendra — Know what you agreed',
    description:
      'A private, evidence-backed supplier deal memory for independent retailers.',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#F4F6F4',
  colorScheme: 'light',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${barlow.variable} ${azeretMono.variable}`} suppressHydrationWarning>
      <head>
        {/*
          The app shell disables smooth scrolling so a route change that moves
          focus to the page heading is instantaneous.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "document.documentElement.dataset.surface = location.pathname.startsWith('/app') || location.pathname.startsWith('/sign-in') || location.pathname.startsWith('/onboarding') ? 'app' : 'marketing';",
          }}
        />
      </head>
      <body className="font-body text-[var(--text-primary)] antialiased">{children}</body>
    </html>
  );
}