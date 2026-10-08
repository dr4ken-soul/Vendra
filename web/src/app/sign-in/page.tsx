import { Suspense } from 'react';
import type { Metadata } from 'next';
import { SignInForm } from '@/components/auth/SignInForm';

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
};

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[var(--bg-primary)]" />}>
      <SignInForm />
    </Suspense>
  );
}