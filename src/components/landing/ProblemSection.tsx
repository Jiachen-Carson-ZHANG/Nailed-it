import Image from 'next/image';

import choiceImage from '../../../docs/assets/choice.PNG?url';
import moneyImage from '../../../docs/assets/money.PNG?url';
import { CalendarIconSvg } from './CalendarIconSvg';
import { ProblemCard } from './ProblemCard';
import { problemCards } from './landing-content';

const problemIcons = [
  <Image key="pricing" src={moneyImage} alt="" width={220} height={220} priority unoptimized />,
  <Image
    key="selection"
    src={choiceImage}
    alt=""
    width={220}
    height={220}
    priority
    unoptimized
  />,
  <CalendarIconSvg key="booking" />
] as const;

export function ProblemSection() {
  return (
    <section aria-label="Problem">
      <h2>好看的款式背后，是低效的预约流程</h2>
      <div>
        {problemCards.map((card, index) => (
          <ProblemCard
            key={card.key}
            title={card.title}
            bullets={card.bullets}
            icon={problemIcons[index]}
          />
        ))}
      </div>
    </section>
  );
}
