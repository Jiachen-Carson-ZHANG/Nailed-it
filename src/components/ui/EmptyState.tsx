type EmptyStateProps = {
  body: string;
  title: string;
};

export function EmptyState({ body, title }: EmptyStateProps) {
  return (
    <section className="empty-state">
      <strong>{title}</strong>
      <p>{body}</p>
    </section>
  );
}
