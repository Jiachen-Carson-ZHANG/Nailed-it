import Link from 'next/link';

const policySections = [
  {
    title: 'What Nailed-it does',
    body:
      'Nailed-it is an AI-assisted nail salon booking app. Customers can upload a nail reference image and, if they choose, connect Pinterest to select their own boards or Pins as style references.'
  },
  {
    title: 'Pinterest access',
    body:
      'Pinterest connection is optional. Nailed-it requests read-only access to boards and Pins so a customer can choose a reference image for style recognition, estimate preparation, and appointment booking.'
  },
  {
    title: 'What we do not do',
    body:
      'Nailed-it does not collect Pinterest passwords, does not ask for Pinterest session cookies, does not scrape Pinterest, and does not post to Pinterest.'
  },
  {
    title: 'How reference data is used',
    body:
      'A selected reference image may be sent to the style recognition service to extract nail attributes such as base service, shape, length, design details, and notes. Pricing, duration, availability, and booking decisions are computed by Nailed-it.'
  },
  {
    title: 'Storage and retention',
    body:
      'Bookings and messages are stored in Nailed-it’s database to keep your appointments and conversations in sync across the customer and merchant views. We do not share this data with third parties.'
  },
  {
    title: 'Disconnecting Pinterest',
    body:
      'Disconnect Pinterest at any time by revoking Nailed-it access in your Pinterest account settings. The app works fully without Pinterest — just upload a reference image directly.'
  }
] as const;

export default function PrivacyPage() {
  return (
    <main className="landing-page">
      <section className="landing-hero" aria-labelledby="privacy-title">
        <span className="eyebrow">Privacy Policy</span>
        <div className="brand-mark" aria-hidden="true">
          N
        </div>
        <h1 id="privacy-title">Privacy Policy</h1>
        <p className="tagline">Last updated: May 26, 2026</p>
        <p className="subtitle">
          This page explains how Nailed-it handles your reference images, booking data,
          and optional Pinterest access.
        </p>
      </section>

      <section className="role-panel" aria-label="Privacy policy details">
        {policySections.map((section) => (
          <article className="role-card" key={section.title}>
            <span>{section.title}</span>
            <p>{section.body}</p>
          </article>
        ))}

        <article className="role-card">
          <span>Contact</span>
          <p>
            For privacy questions, contact{' '}
            <a href="mailto:toughcookiezang@gmail.com">toughcookiezang@gmail.com</a>.
          </p>
        </article>
      </section>

      <footer className="privacy-footer">
        <Link className="button button-ghost" href="/">
          ← Back to Nailed-it
        </Link>
      </footer>
    </main>
  );
}
