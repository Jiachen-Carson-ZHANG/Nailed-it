'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Dialog } from '@/components/ui/Dialog';
import { Tooltip } from '@/components/ui/Tooltip';

const sections = [
  { id: 'colors', label: 'Colors + contrast' },
  { id: 'spacing', label: 'Spacing scale' },
  { id: 'radius', label: 'Radius scale' },
  { id: 'type', label: 'Type scale' },
  { id: 'motion', label: 'Motion' },
  { id: 'states', label: 'Edge states' },
  { id: 'copy', label: 'Content style' },
  { id: 'personas', label: 'Personas' },
  { id: 'competitor', label: 'Competitor patterns' },
  { id: 'radix', label: 'Radix primitives' }
];

const colors = [
  { token: '--color-bg', value: '#fff8f7', label: 'Page bg' },
  { token: '--color-surface', value: 'rgba(255,255,255,0.88)', label: 'Card surface' },
  { token: '--color-surface-strong', value: '#ffffff', label: 'Solid card' },
  { token: '--color-border', value: 'rgba(46,31,43,0.08)', label: 'Hairline border' },
  { token: '--color-text', value: '#24181f', label: 'Body text', textPair: true },
  { token: '--color-muted', value: '#6c5a65', label: 'Secondary text', textPair: true },
  { token: '--color-accent', value: '#ec5d7b', label: 'Primary brand', textPair: true, contrast: '3.7:1 ✗ body / ✓ large' },
  { token: '--color-accent-strong', value: '#c73963', label: 'Pressed accent', textPair: true, contrast: '5.6:1 ✓ body' },
  { token: '--color-accent-soft', value: '#ffe4eb', label: 'Chip selected' },
  { token: '--color-overlay', value: 'rgba(34,25,28,0.26)', label: 'Modal scrim' }
];

const proposedColors = [
  { token: '--color-success', value: '#2e8b6c', label: 'Confirm / OK', textPair: true, contrast: '~4.6:1 ✓ body' },
  { token: '--color-warning', value: '#d97706', label: 'Caution', textPair: true, contrast: '~3.9:1 ✗ body / ✓ large' },
  { token: '--color-danger', value: '#b91c1c', label: 'Destructive', textPair: true, contrast: '~6.5:1 ✓ body' }
];

const spacingScale = [
  { token: '--space-1', rem: '0.25rem', px: 4, use: 'icon ↔ label' },
  { token: '--space-2', rem: '0.5rem', px: 8, use: 'compact padding' },
  { token: '--space-3', rem: '0.75rem', px: 12, use: 'default gap' },
  { token: '--space-4', rem: '1rem', px: 16, use: 'card padding' },
  { token: '--space-5', rem: '1.5rem', px: 24, use: 'section rhythm' },
  { token: '--space-6', rem: '2rem', px: 32, use: 'page top/bottom' },
  { token: '--space-7', rem: '3rem', px: 48, use: 'hero spacing' }
];

const radiusScale = [
  { token: '--radius-sm', value: '0.25rem', px: 4, use: 'tags' },
  { token: '--radius-md', value: '0.5rem', px: 8, use: 'default cards/buttons' },
  { token: '--radius-lg', value: '1.25rem', px: 20, use: 'sheet, modal, hero' },
  { token: '--radius-pill', value: '999px', px: 999, use: 'chip, avatar' }
];

const typeScale = [
  { token: '--text-xs', size: '0.75rem', weight: 600, use: 'eyebrow' },
  { token: '--text-sm', size: '0.875rem', weight: 500, use: 'helper text' },
  { token: '--text-base', size: '1rem', weight: 500, use: 'body' },
  { token: '--text-md', size: '1.125rem', weight: 600, use: 'card title' },
  { token: '--text-lg', size: '1.375rem', weight: 700, use: 'page subtitle' },
  { token: '--text-xl', size: '1.75rem', weight: 800, use: 'page title' },
  { token: '--text-hero', size: '2.5rem', weight: 800, use: 'hero / landing' }
];

const motionDurations = [
  { token: '--motion-fast', ms: 120, use: 'button press' },
  { token: '--motion-base', ms: 200, use: 'card transition, chip select' },
  { token: '--motion-slow', ms: 320, use: 'bottom sheet, page transition' }
];

const states = [
  { id: 'happy', label: 'Happy', tone: 'normal' },
  { id: 'loading', label: 'Loading', tone: 'normal' },
  { id: 'empty', label: 'Empty', tone: 'normal' },
  { id: 'error', label: 'Error', tone: 'danger' },
  { id: 'partial', label: 'Partial', tone: 'warning' },
  { id: 'stale', label: 'Stale', tone: 'warning' },
  { id: 'permission', label: 'Permission denied', tone: 'danger' },
  { id: 'offline', label: 'Offline', tone: 'warning' }
] as const;

const copyExamples = [
  { before: 'Booking flow', after: 'Book this look', why: 'engineering jargon' },
  { before: 'Submit', after: 'Confirm booking', why: 'generic UI label' },
  { before: 'An error occurred while processing your request', after: 'Could not load. Try again.', why: 'verbosity + hedging' },
  { before: 'Awesome! Your booking is being processed!', after: 'Booked. See it in My bookings.', why: 'marketing filler' },
  { before: 'Please kindly upload your photo', after: 'Upload a nail photo', why: 'pleasantry + filler' }
];

const personas = [
  { id: 'P1', name: 'Yuki', age: 26, segment: 'Trend-chaser (primary)', jtbd: 'Pick a look from Xiaohongshu, see if it works on me, book before payday', signal: 'cares about look match, not price' },
  { id: 'P2', name: 'Mira', age: 33, segment: 'Time-poor professional', jtbd: 'Book in lunch break, no scrolling, repeat last set', signal: 'cares about speed + reliability' },
  { id: 'P3', name: 'Linlin', age: 21, segment: 'Budget student', jtbd: 'Find cheap matching set with friend group', signal: 'price-first, multi-customer' },
  { id: 'M1', name: 'Auntie Wang', age: 38, segment: 'Salon owner-operator', jtbd: 'Catch booking, set price, manage day on phone', signal: 'one-handed, no laptop' }
];

const competitorPatterns = [
  { source: 'Joey static (component-breakdown)', pattern: 'Quotation breakdown table — color-coded badges (length/shape/color/style) + per-style subtotal + grand total', verdict: 'steal' },
  { source: 'Joey static', pattern: '2-input ritual — hand + style side-by-side, disabled CTA until both filled', verdict: 'steal (port to vertical mobile)' },
  { source: 'Joey static', pattern: 'Free-mode toggle — let AI identify components freely', verdict: 'steal as chip toggle' },
  { source: '美团 Meituan', pattern: 'Floating booking footer fixed on style detail', verdict: 'verify with real screenshot first' },
  { source: '小红书 Xiaohongshu', pattern: 'Waterfall grid with mixed-height image cards', verdict: 'already partially used' },
  { source: '河狸家 Helijia', pattern: 'Technician profile card before time-select', verdict: 'verify with real screenshot first' }
];

export default function DevPlaygroundPage() {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [pressedFast, setPressedFast] = useState(false);
  const [pressedBase, setPressedBase] = useState(false);
  const [pressedSlow, setPressedSlow] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const transitionScale = (ms: number) => `transform ${reducedMotion ? 0 : ms}ms cubic-bezier(0.22, 0.61, 0.36, 1)`;

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '1.5rem 1rem 4rem', fontFamily: 'Inter, -apple-system, sans-serif', color: '#24181f' }}>
      <header style={{ marginBottom: '1.5rem' }}>
        <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#ec5d7b', margin: 0 }}>Dev playground</p>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0.25rem 0 0.5rem' }}>Design system, copy, states, personas — at a glance</h1>
        <p style={{ fontSize: 14, color: '#6c5a65', margin: 0 }}>
          Single-page visual reference for everything in <code>docs/architecture/</code>. Not shipped to production — local + branch deploy only.
        </p>
      </header>

      <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: '2rem', padding: '0.75rem', background: '#fff', border: '1px solid rgba(46,31,43,0.08)', borderRadius: 8 }}>
        {sections.map((s) => (
          <a key={s.id} href={`#${s.id}`} style={{ fontSize: 12, padding: '0.35rem 0.6rem', background: '#ffe4eb', borderRadius: 999, color: '#c73963', fontWeight: 600 }}>
            {s.label}
          </a>
        ))}
      </nav>

      <Section id="colors" title="1. Colors + contrast">
        <p style={muted}>Audited 2026-05-26. Contrast values vs <code>--color-bg #fff8f7</code>.</p>
        <SubHeading>Current tokens</SubHeading>
        <div style={swatchGrid}>
          {colors.map((c) => (
            <ColorSwatch key={c.token} {...c} />
          ))}
        </div>
        <SubHeading>Proposed additions (status colors)</SubHeading>
        <div style={swatchGrid}>
          {proposedColors.map((c) => (
            <ColorSwatch key={c.token} {...c} />
          ))}
        </div>
        <Callout>
          <strong>Action:</strong> add 3 status colors. Body copy in <code>--color-accent</code> currently fails 4.5:1 — confirm no source uses it for prose. Primary button text on accent passes only at weight ≥ 600 + size ≥ 14px.
        </Callout>
      </Section>

      <Section id="spacing" title="2. Spacing scale (4pt)">
        <p style={muted}>Current globals.css drifts across 13 values. Proposed scale collapses to 7.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {spacingScale.map((s) => (
            <div key={s.token} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <code style={{ width: 110, fontSize: 12 }}>{s.token}</code>
              <span style={{ width: 60, fontSize: 12, color: '#6c5a65' }}>{s.px}px</span>
              <div style={{ width: s.px, height: 14, background: '#ec5d7b', borderRadius: 2 }} />
              <span style={{ fontSize: 12, color: '#6c5a65' }}>{s.use}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section id="radius" title="3. Radius scale">
        <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
          {radiusScale.map((r) => (
            <div key={r.token} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 64, height: 64, background: '#ec5d7b', borderRadius: r.value }} />
              <code style={{ fontSize: 11 }}>{r.token}</code>
              <span style={{ fontSize: 11, color: '#6c5a65' }}>{r.value}</span>
              <span style={{ fontSize: 11, color: '#6c5a65', textAlign: 'center' }}>{r.use}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section id="type" title="4. Type scale">
        <p style={muted}>System font stack (Inter + apple system). Weights: 500/600/700/800 only.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {typeScale.map((t) => (
            <div key={t.token} style={{ display: 'flex', alignItems: 'baseline', gap: 12, borderBottom: '1px dashed #f0d8df', paddingBottom: 6 }}>
              <code style={{ width: 110, fontSize: 12, color: '#6c5a65' }}>{t.token}</code>
              <span style={{ fontSize: t.size, fontWeight: t.weight, lineHeight: 1.3 }}>The quick brown fox</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#6c5a65' }}>{t.size} / w{t.weight} — {t.use}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section id="motion" title="5. Motion">
        <p style={muted}>Tap each button to feel the duration. Toggle reduced motion to verify override.</p>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 16 }}>
          <input type="checkbox" checked={reducedMotion} onChange={(e) => setReducedMotion(e.target.checked)} />
          Simulate <code>prefers-reduced-motion: reduce</code>
        </label>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {motionDurations.map((m, i) => {
            const pressed = [pressedFast, pressedBase, pressedSlow][i];
            const setPressed = [setPressedFast, setPressedBase, setPressedSlow][i];
            return (
              <button
                key={m.token}
                onMouseDown={() => setPressed(true)}
                onMouseUp={() => setPressed(false)}
                onMouseLeave={() => setPressed(false)}
                onTouchStart={() => setPressed(true)}
                onTouchEnd={() => setPressed(false)}
                style={{
                  padding: '1rem 1.25rem',
                  background: '#ec5d7b',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                  transform: pressed ? 'scale(0.96)' : 'scale(1)',
                  transition: transitionScale(m.ms),
                  opacity: pressed ? 0.85 : 1
                }}
              >
                {m.token} ({m.ms}ms)
                <div style={{ fontSize: 11, opacity: 0.85, fontWeight: 500, marginTop: 4 }}>{m.use}</div>
              </button>
            );
          })}
        </div>
      </Section>

      <Section id="states" title="6. Edge states (8 per route)">
        <p style={muted}>Every route should be designed for all 8. Sample card below.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {states.map((s) => (
            <StateCard key={s.id} state={s} />
          ))}
        </div>
      </Section>

      <Section id="copy" title="7. Content style — banned-word before / after">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {copyExamples.map((c, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 140px', gap: 12, padding: 12, background: '#fff', borderRadius: 8, border: '1px solid rgba(46,31,43,0.08)' }}>
              <div>
                <div style={{ fontSize: 10, color: '#b91c1c', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Before</div>
                <div style={{ fontSize: 14, textDecoration: 'line-through', color: '#6c5a65' }}>{c.before}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#2e8b6c', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>After</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{c.after}</div>
              </div>
              <div style={{ fontSize: 11, color: '#6c5a65', alignSelf: 'center' }}>{c.why}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="personas" title="8. Personas">
        <p style={muted}>Hypothesized — pending hallway validation. Reject any feature that serves none.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {personas.map((p) => (
            <div key={p.id} style={{ padding: 14, background: '#fff', borderRadius: 8, border: '1px solid rgba(46,31,43,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#ec5d7b' }}>{p.id}</span>
                <strong style={{ fontSize: 16 }}>{p.name}</strong>
                <span style={{ fontSize: 12, color: '#6c5a65' }}>· {p.age}</span>
              </div>
              <div style={{ fontSize: 12, color: '#6c5a65', marginTop: 2 }}>{p.segment}</div>
              <div style={{ fontSize: 13, marginTop: 8 }}><strong>JTBD:</strong> {p.jtbd}</div>
              <div style={{ fontSize: 12, color: '#6c5a65', marginTop: 6, fontStyle: 'italic' }}>{p.signal}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="competitor" title="9. Competitor patterns to steal / verify">
        <p style={muted}>Joey's static prototype is on <code>feat/component-breakdown</code> branch — verified by direct read. 美团 / 河狸家 / 小红书 patterns are unverified until real screenshots captured.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {competitorPatterns.map((c, i) => {
            const isSteal = c.verdict.startsWith('steal');
            return (
              <div key={i} style={{ padding: 10, background: '#fff', borderRadius: 8, border: '1px solid rgba(46,31,43,0.08)', display: 'grid', gridTemplateColumns: '160px 1fr 130px', gap: 10, alignItems: 'center' }}>
                <code style={{ fontSize: 11 }}>{c.source}</code>
                <span style={{ fontSize: 13 }}>{c.pattern}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: isSteal ? '#2e8b6c' : '#d97706' }}>{c.verdict}</span>
              </div>
            );
          })}
        </div>
      </Section>

      <Section id="primitives" title="10. Existing UI primitives in use">
        <p style={muted}>Component import demos — these will be replaced/wrapped by shadcn/ui + Radix after ADR.</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <Button variant="primary">Primary CTA</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="primary" disabled>Disabled</Button>
        </div>
        <div style={{ marginTop: 16 }}>
          <EmptyState title="No bookings yet" body="Pick a style to get started." />
        </div>
      </Section>

      <Section id="radix" title="11. Radix primitives (ADR-0002)">
        <p style={muted}>Installed 2026-05-26. Headless + accessible. Styled with existing semantic CSS classes — no Tailwind.</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <Tooltip content="AI confidence is the model's self-rated certainty for this style match. Higher = more reliable price." side="top">
            <button style={{ padding: '0.6rem 0.9rem', background: '#fff', border: '1px solid rgba(46,31,43,0.12)', borderRadius: 8, fontSize: 13, cursor: 'help' }}>
              Hover/tap: Tooltip demo (UI-E16 fix)
            </button>
          </Tooltip>
          <Button variant="primary" onClick={() => setDialogOpen(true)}>Open Dialog</Button>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          title="Cancellation policy"
          description="Bookings cancelled within 24h forfeit deposit."
        >
          <p style={{ margin: '0 0 0.75rem' }}>Demo of <code>@radix-ui/react-dialog</code> — focus trap, escape-to-close, scrim, ARIA wired automatically.</p>
          <Button variant="primary" onClick={() => setDialogOpen(false)}>Got it</Button>
        </Dialog>
        <p style={{ marginTop: 16, fontSize: 12, color: '#6c5a65' }}>Available wrappers: <code>Tooltip</code>, <code>Dialog</code>. Next to add when audit findings call for them: <code>DropdownMenu</code> (UI-E21 status chips), <code>Tabs</code>, <code>BottomSheet</code> (vaul).</p>
      </Section>

      <footer style={{ marginTop: 48, fontSize: 12, color: '#6c5a65', textAlign: 'center' }}>
        Edit <code>src/app/dev/page.tsx</code> to update this view. Source of truth still lives in <code>docs/architecture/</code>.
      </footer>
    </main>
  );
}

const muted = { fontSize: 13, color: '#6c5a65', marginTop: 0, marginBottom: 16 } as const;
const swatchGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 } as const;

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ marginBottom: 48, scrollMarginTop: 16 }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 12px', borderBottom: '2px solid #ec5d7b', paddingBottom: 6 }}>{title}</h2>
      {children}
    </section>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', color: '#6c5a65', margin: '20px 0 8px' }}>{children}</h3>;
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 14, padding: 12, background: '#ffe4eb', borderRadius: 8, fontSize: 13, color: '#24181f' }}>
      {children}
    </div>
  );
}

function ColorSwatch({ token, value, label, textPair, contrast }: { token: string; value: string; label: string; textPair?: boolean; contrast?: string }) {
  const onAccent = textPair && (token === '--color-text' || token === '--color-muted');
  return (
    <div style={{ background: '#fff', border: '1px solid rgba(46,31,43,0.08)', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ background: value, height: 64, display: 'grid', placeItems: 'center', color: onAccent ? value : '#fff', fontSize: 12, fontWeight: 600 }}>
        {textPair ? <span style={{ color: onAccent ? value : '#fff', mixBlendMode: 'normal' }}>Aa</span> : null}
      </div>
      <div style={{ padding: 8 }}>
        <code style={{ fontSize: 11, display: 'block' }}>{token}</code>
        <div style={{ fontSize: 11, color: '#6c5a65', marginTop: 2 }}>{value}</div>
        <div style={{ fontSize: 12, marginTop: 4 }}>{label}</div>
        {contrast ? <div style={{ fontSize: 10, color: '#6c5a65', marginTop: 2 }}>{contrast}</div> : null}
      </div>
    </div>
  );
}

function StateCard({ state }: { state: { id: string; label: string; tone: string } }) {
  const palette: Record<string, { bg: string; text: string; border: string }> = {
    normal: { bg: '#fff', text: '#24181f', border: 'rgba(46,31,43,0.08)' },
    warning: { bg: '#fff7ed', text: '#d97706', border: 'rgba(217,119,6,0.25)' },
    danger: { bg: '#fef2f2', text: '#b91c1c', border: 'rgba(185,28,28,0.25)' }
  };
  const tone = palette[state.tone] ?? palette.normal;
  const content: Record<string, { title: string; body: string }> = {
    happy: { title: 'Trending sets', body: '24 styles match your last quote.' },
    loading: { title: 'Loading…', body: 'Fetching styles' },
    empty: { title: 'No matches yet', body: 'Try a different color.' },
    error: { title: 'Could not load', body: 'Try again.' },
    partial: { title: 'Showing 12 of 24', body: 'Some styles unavailable.' },
    stale: { title: 'Cached results', body: 'Refresh for live data.' },
    permission: { title: 'Camera blocked', body: 'Allow camera in settings.' },
    offline: { title: 'No connection', body: 'Reconnect to load styles.' }
  };
  const c = content[state.id] ?? { title: state.label, body: '' };
  return (
    <div style={{ padding: 12, background: tone.bg, border: `1px solid ${tone.border}`, borderRadius: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: tone.text, marginBottom: 6 }}>{state.label}</div>
      <strong style={{ fontSize: 14, display: 'block', color: tone.text }}>{c.title}</strong>
      <p style={{ fontSize: 12, color: '#6c5a65', margin: '4px 0 0' }}>{c.body}</p>
    </div>
  );
}
