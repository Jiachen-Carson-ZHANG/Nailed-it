import { CtaSection } from './CtaSection';
import { HeroSection } from './HeroSection';
import { landingSerif } from './fonts';
import styles from './LandingPage.module.css';
import { ProblemSection } from './ProblemSection';
import { SolutionSection } from './SolutionSection';
import { WhyItWorksSection } from './WhyItWorksSection';

export default function LandingPage() {
  return (
    <main className={`${landingSerif.className} ${landingSerif.variable} ${styles.page}`}>
      <HeroSection />
      <ProblemSection />
      <SolutionSection />
      <WhyItWorksSection />
      <CtaSection />
    </main>
  );
}
