type LoadingStateProps = {
  body: string;
  title: string;
};

export function LoadingState({ body, title }: LoadingStateProps) {
  return (
    <section aria-live="polite" className="loading-state">
      <span className="loading-dot" />
      <strong>{title}</strong>
      <p>{body}</p>
    </section>
  );
}
