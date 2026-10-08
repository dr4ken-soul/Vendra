import { Suspense } from 'react';
import type { Metadata } from 'next';
import { OnboardingFlow } from '@/components/auth/OnboardingFlow';

export const metadata: Metadata = {
  title: 'Set up your shop',
  robots: { index: false, follow: false },
};

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[var(--bg-primary)]" />}>
      <OnboardingFlow />
    </Suspense>
  );
}