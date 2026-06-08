import Image from 'next/image';
import Link from 'next/link';

import logoImage from '@/landing_assets/logo.PNG?url';
import { MerchantEntryLink } from './MerchantEntryLink';
import styles from './LandingPage.module.css';
import { landingRoutes } from './landing-content';

export function CtaSection() {
  return (
    <section
      aria-label="CTA"
      className={`${styles.section} ${styles.cta}`}
    >
      <div className={`${styles.sectionContent} ${styles.ctaContent}`}>
        <Image
          src={logoImage}
          alt="Nailed-it"
          width={240}
          height={84}
          unoptimized
          className={styles.ctaLogo}
        />
        <p className={styles.ctaSlogan}>少沟通，多成交</p>
        <h2 className={styles.ctaTitle}>准备好让美甲预约更智能了吗？</h2>
        <p className={styles.ctaSubtitle}>选择你的身份，进入 Nailed-it 的智能预约体验。</p>
        <div className={styles.ctaActions}>
          <MerchantEntryLink className={`${styles.buttonBase} ${styles.ctaMerchantButton}`}>
            商家入口
          </MerchantEntryLink>
          <Link
            href={landingRoutes.customer}
            className={`${styles.buttonBase} ${styles.ctaCustomerButton}`}
          >
            用户入口
          </Link>
        </div>
      </div>
    </section>
  );
}
