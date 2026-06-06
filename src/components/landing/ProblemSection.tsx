import Image from 'next/image';

import choiceImage from '@/landing_assets/choice.PNG?url';
import moneyImage from '@/landing_assets/money.PNG?url';
import { CalendarIconSvg } from './CalendarIconSvg';
import styles from './LandingPage.module.css';
import { ProblemCard } from './ProblemCard';
import { problemCards } from './landing-content';

const problemIconsByKey = {
  pricing: <Image src={moneyImage} alt="" width={220} height={220} unoptimized />,
  selection: <Image src={choiceImage} alt="" width={220} height={220} unoptimized />,
  booking: <CalendarIconSvg />
} as const;

export function ProblemSection() {
  return (
    <section
      aria-label="Problem"
      className={`${styles.section} ${styles.problem}`}
    >
      <div className={styles.sectionContent}>
        <h2 className={styles.problemTitle}>好看的款式背后，是低效的预约流程</h2>
        <div className={styles.problemGrid}>
          {problemCards.map((card) => (
            <ProblemCard
              key={card.key}
              title={card.title}
              bullets={card.bullets}
              icon={problemIconsByKey[card.key]}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
