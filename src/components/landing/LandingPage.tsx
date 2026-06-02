import { CtaSection } from './CtaSection';
import { HeroSection } from './HeroSection';
import { landingSerif } from './fonts';
import { ProblemSection } from './ProblemSection';
import { SolutionSection } from './SolutionSection';

export default function LandingPage() {
  return (
    <main className={`${landingSerif.className} ${landingSerif.variable}`}>
      <HeroSection />
      <ProblemSection />
      <SolutionSection />
      <section aria-label="Why It Works" />
      <CtaSection />
    </main>
  );
}
