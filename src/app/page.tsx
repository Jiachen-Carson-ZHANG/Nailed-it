import Link from 'next/link';
import { getMockSession } from '@/domain/session';

const customerPath = getMockSession('customer').homePath;
const merchantPath = getMockSession('merchant').homePath;

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
        <Link className="role-card role-card-primary" href={customerPath}>
          <span className="eyebrow">Customer</span>
          <strong>Find styles and book</strong>
          <p>Upload a nail photo, get an instant style estimate, and book your appointment in minutes.</p>
        </Link>
        <Link className="role-card role-card-secondary" href={merchantPath}>
          <span>Merchant</span>
          <strong>Manage prices and bookings</strong>
          <p>View your daily schedule, manage pricing, and stay on top of every booking — all in one place.</p>
        </Link>
      </section>
    </main>
  );
}
