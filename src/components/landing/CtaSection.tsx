import Link from 'next/link';

import { landingRoutes } from './landing-content';

export function CtaSection() {
  return (
    <section aria-label="CTA">
      <h2>准备好让美甲预约更智能了吗？</h2>
      <p>选择你的身份，进入 Nailed-it 的智能预约体验。</p>
      <div>
        <Link href={landingRoutes.customer}>Try as User</Link>
        <Link href={landingRoutes.merchant}>Try as Merchant</Link>
      </div>
    </section>
  );
}
