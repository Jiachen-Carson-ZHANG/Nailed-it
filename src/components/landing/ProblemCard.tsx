import type { ReactNode } from 'react';

type ProblemCardProps = {
  title: string;
  bullets: readonly string[];
  icon: ReactNode;
};

export function ProblemCard({ title, bullets, icon }: ProblemCardProps) {
  return (
    <article>
      <div aria-hidden="true">{icon}</div>
      <div>
        <h3>{title}</h3>
        <ul>
          {bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      </div>
    </article>
  );
}
