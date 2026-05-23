import Link from 'next/link';

const roleCards = [
  {
    href: '/customer/home',
    label: 'Customer',
    title: 'Find styles and book',
    description: 'Upload a reference, review the AI breakdown, and move straight into a booking flow.'
  },
  {
    href: '/merchant/calendar',
    label: 'Merchant',
    title: 'Manage prices and bookings',
    description: 'Keep pricing rules, appointment demand, and daily scheduling in one mobile workspace.'
  }
] as const;

export default function LandingPage() {
  return (
    <main className="landing-page">
      <section className="landing-hero" aria-labelledby="landing-title">
        <span className="eyebrow">Mobile nail workflow</span>
        <div className="brand-mark" aria-hidden="true">
          N
        </div>
        <h1 id="landing-title">Nailed-it</h1>
        <p className="tagline">AI nail booking assistant</p>
        <p className="subtitle">
          Upload a style reference, review a structured estimate, and step into booking or
          merchant scheduling with the same product shell.
        </p>
      </section>

      <section className="role-panel" aria-label="Choose role">
        {roleCards.map((role) => (
          <Link key={role.href} className="role-card" href={role.href}>
            <span>{role.label}</span>
            <strong>{role.title}</strong>
            <p>{role.description}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
