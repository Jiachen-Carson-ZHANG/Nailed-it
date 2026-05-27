import type { ReactNode } from 'react';

type EmptyStateProps = {
  body: string;
  icon?: ReactNode;
  title: string;
};

export function EmptyState({ body, icon, title }: EmptyStateProps) {
  return (
    <section className="empty-state">
      {icon ? (
        <span aria-hidden="true" className="empty-state-icon">
          {icon}
        </span>
      ) : null}
      <strong>{title}</strong>
      <p>{body}</p>
    </section>
  );
}
