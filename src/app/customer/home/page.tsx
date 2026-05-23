import Link from 'next/link';

export default function CustomerHomePlaceholderPage() {
  return (
    <main className="landing-page">
      <section className="landing-hero" aria-labelledby="customer-home-title">
        <span className="eyebrow">Customer placeholder</span>
        <h1 id="customer-home-title">Customer home is ready for Task 2</h1>
        <p className="subtitle">
          This temporary route keeps the landing-page entry working while the customer experience
          is implemented in the next task.
        </p>
      </section>

      <section className="role-panel" aria-label="Customer placeholder actions">
        <Link className="role-card" href="/">
          <span>Back</span>
          <strong>Return to landing</strong>
          <p>Use the scaffold entry screen to switch between product roles.</p>
        </Link>
      </section>
    </main>
  );
}
