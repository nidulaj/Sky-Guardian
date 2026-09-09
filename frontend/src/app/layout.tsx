import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SkyGuardian AI - Multi-Agent Disruption Risk Platform',
  description: 'Predict the disruption. Protect the journey. Proactive AI-driven flight disruption risk and recovery analysis.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
