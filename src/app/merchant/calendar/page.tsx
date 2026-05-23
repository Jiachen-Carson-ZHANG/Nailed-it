import Link from 'next/link';

export default function MerchantCalendarPlaceholderPage() {
  return (
    <main className="landing-page">
      <section className="landing-hero" aria-labelledby="merchant-calendar-title">
        <span className="eyebrow">Merchant placeholder</span>
        <h1 id="merchant-calendar-title">Merchant calendar is ready for Task 2</h1>
        <p className="subtitle">
          This temporary route prevents a dead-end from the landing page while the scheduling
          workspace is still being built.
        </p>
      </section>

      <section className="role-panel" aria-label="Merchant placeholder actions">
        <Link className="role-card" href="/">
          <span>Back</span>
          <strong>Return to landing</strong>
          <p>Go back to the scaffold entry page and continue from there.</p>
        </Link>
      </section>
    </main>
  );
}
