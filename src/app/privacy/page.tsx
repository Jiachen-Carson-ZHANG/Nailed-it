import Link from 'next/link';

const policySections = [
  {
    title: 'What Nailed-it does',
    body:
      'Nailed-it is an MVP for AI-assisted nail salon booking. Customers can upload a nail reference image and, if they choose, connect Pinterest to select their own boards or Pins as style references.'
  },
  {
    title: 'Pinterest access',
    body:
      'Pinterest connection is optional. In this MVP, Nailed-it requests read-only access to boards and Pins so a customer can choose a reference image for style recognition, estimate preparation, and appointment booking.'
  },
  {
    title: 'What we do not do',
    body:
      'Nailed-it does not collect Pinterest passwords, does not ask for Pinterest session cookies, does not scrape Pinterest, and does not post to Pinterest in this MVP.'
  },
  {
    title: 'How reference data is used',
    body:
      'A selected reference image may be sent to the app recognition workflow to extract nail-style attributes such as base service, shape, length, design details, confidence, and notes. Pricing, duration, availability, and booking decisions are computed by Nailed-it app logic.'
  },
  {
    title: 'Storage and retention',
    body:
      'The current MVP uses local demo state for booking and message continuity. It is not a production account system. If production storage is added later, this policy must be updated before launch.'
  },
  {
    title: 'Disconnecting Pinterest',
    body:
      'Users can disconnect Pinterest by revoking Nailed-it access in their Pinterest account settings. The MVP may also be used without connecting Pinterest by uploading a reference image directly.'
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
          This page explains how the Nailed-it MVP handles reference images, booking demo data,
          and optional Pinterest OAuth access.
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
            For privacy questions during the MVP review, use the contact email submitted in the
            Pinterest developer application.
          </p>
        </article>
      </section>

      <Link className="button button-secondary" href="/">
        Back to app
      </Link>
    </main>
  );
}
