import { SiteNav } from '@/components/marketing/SiteNav';
import { VideoBackground } from '@/components/marketing/VideoBackground';
import {
  DealTimeline,
  FaqSection,
  FinalCta,
  Hero,
  MemoryAndAccess,
  OutcomesLedger,
  ProblemStatement,
  RecallDemo,
  SiteFooter,
} from '@/components/marketing/Sections';

export default function LandingPage() {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-[var(--bg-surface)] focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-[var(--text-primary)] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--accent)]"
      >
        Skip to main content
      </a>

      {/*
        ONE video, mounted once at the page root behind every section including
        the footer. The five stills in /video are generation references.
      */}
      <VideoBackground />
      <SiteNav />

      <main id="main-content" className="relative z-10 isolate">
        <Hero />
        <ProblemStatement />
        <DealTimeline />
        <RecallDemo />
        <OutcomesLedger />
        <MemoryAndAccess />
        <FaqSection />
        <FinalCta />
      </main>

      <SiteFooter />
    </>
  );
}