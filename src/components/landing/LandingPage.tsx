import { CtaSection } from './CtaSection';
import { HeroSection } from './HeroSection';
import { landingSerif } from './fonts';
import { ProblemSection } from './ProblemSection';

export default function LandingPage() {
  return (
    <main className={`${landingSerif.className} ${landingSerif.variable}`}>
      <HeroSection />
      <ProblemSection />
      <section aria-label="Solution" />
      <section aria-label="Why It Works" />
      <CtaSection />
    </main>
  );
}
