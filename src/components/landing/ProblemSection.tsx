import Image from 'next/image';

import choiceImage from '../../../docs/assets/choice.PNG?url';
import moneyImage from '../../../docs/assets/money.PNG?url';
import { CalendarIconSvg } from './CalendarIconSvg';
import { ProblemCard } from './ProblemCard';
import { problemCards } from './landing-content';

const problemIconsByKey = {
  pricing: <Image src={moneyImage} alt="" width={220} height={220} unoptimized />,
  selection: <Image src={choiceImage} alt="" width={220} height={220} unoptimized />,
  booking: <CalendarIconSvg />
} as const;

export function ProblemSection() {
  return (
    <section aria-label="Problem">
      <h2>好看的款式背后，是低效的预约流程</h2>
      <div>
        {problemCards.map((card) => (
          <ProblemCard
            key={card.key}
            title={card.title}
            bullets={card.bullets}
            icon={problemIconsByKey[card.key]}
          />
        ))}
      </div>
    </section>
  );
}
