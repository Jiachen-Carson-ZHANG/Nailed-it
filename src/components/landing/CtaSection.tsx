import Link from 'next/link';

import styles from './LandingPage.module.css';
import { landingRoutes } from './landing-content';

export function CtaSection() {
  return (
    <section
      aria-label="CTA"
      className={`${styles.section} ${styles.cta}`}
    >
      <h2 className={styles.ctaTitle}>准备好让美甲预约更智能了吗？</h2>
      <p className={styles.ctaSubtitle}>选择你的身份，进入 Nailed-it 的智能预约体验。</p>
      <div className={styles.ctaActions}>
        <Link
          href={landingRoutes.customer}
          className={`${styles.buttonBase} ${styles.ctaCustomerButton}`}
        >
          Try as User
        </Link>
        <Link
          href={landingRoutes.merchant}
          className={`${styles.buttonBase} ${styles.ctaMerchantButton}`}
        >
          Try as Merchant
        </Link>
      </div>
    </section>
  );
}
