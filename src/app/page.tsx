import Link from 'next/link';
import { getMockSession } from '@/domain/session';

const roleCards = [
  {
    href: getMockSession('customer').homePath,
    label: 'Customer',
    title: 'Find styles and book',
    description: 'Upload a nail photo, get an instant style estimate, and book your appointment in minutes.'
  },
  {
    href: getMockSession('merchant').homePath,
    label: 'Merchant',
    title: 'Manage prices and bookings',
    description: 'View your daily schedule, manage pricing, and stay on top of every booking — all in one place.'
  }
] as const;

export default function LandingPage() {
  return (
    <main className="landing-page">
      <section className="landing-hero" aria-labelledby="landing-title">
        <span className="eyebrow">AI nail booking</span>
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
