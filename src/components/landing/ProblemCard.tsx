import type { ReactNode } from 'react';

import styles from './LandingPage.module.css';

type ProblemCardProps = {
  title: string;
  bullets: readonly string[];
  icon: ReactNode;
};

export function ProblemCard({ title, bullets, icon }: ProblemCardProps) {
  return (
    <article className={styles.problemCard}>
      <div
        aria-hidden="true"
        className={styles.problemIconWrap}
      >
        {icon}
      </div>
      <div className={styles.problemCardBody}>
        <h3 className={styles.problemCardTitle}>{title}</h3>
        <ul className={styles.problemList}>
          {bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      </div>
    </article>
  );
}
