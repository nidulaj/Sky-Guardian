import SiteFooter from '@/components/ui/SiteFooter';
import Hero from '@/components/landing/Hero';
import Statement from '@/components/landing/Statement';
import HowItWorks from '@/components/landing/HowItWorks';
import Agents from '@/components/landing/Agents';
import RiskEngine from '@/components/landing/RiskEngine';
import BoardingPassCta from '@/components/landing/BoardingPassCta';
import ResponsibleAI from '@/components/landing/ResponsibleAI';

export default function LandingPage() {
  return (
    <>
      <main id="main">
        <Hero />
        <Statement />
        <HowItWorks />
        <Agents />
        <RiskEngine />
        <BoardingPassCta />
        <ResponsibleAI />
      </main>
      <SiteFooter />
    </>
  );
}
