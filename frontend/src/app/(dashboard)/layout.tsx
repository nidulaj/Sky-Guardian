import React from 'react';
import SiteHeader from '@/components/ui/SiteHeader';
import SiteFooter from '@/components/ui/SiteFooter';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-5 focus:py-3 focus:text-sm focus:text-sand-50"
      >
        Skip to content
      </a>
      <SiteHeader variant="solid" section="app" />
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-5 sm:px-8 py-10 sm:py-14 focus:outline-none">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
