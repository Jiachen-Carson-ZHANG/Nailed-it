'use client';

import Link from 'next/link';

type Props = {
  /** The recommendation, already localized by the caller. */
  text: string;
  /** Short evidence chip backing the recommendation, e.g. "试戴 29 · 预约 1". */
  evidence: string;
  /** Where the CTA jumps (style editor, upload, etc.). */
  href: string;
  /** Localized CTA label, e.g. "去编辑". */
  cta: string;
};

/** One action-queue item: the insight + its evidence + a deep-link CTA that actually does something. */
export function ActionCard({ text, evidence, href, cta }: Props) {
  return (
    <Link className="insight-action" href={href}>
      <span className="insight-action-body">
        <span className="insight-action-text">{text}</span>
        <span className="insight-action-evidence">{evidence}</span>
      </span>
      <span className="insight-action-cta">{cta} ›</span>
    </Link>
  );
}
