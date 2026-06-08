import Image from 'next/image';
import Link from 'next/link';

import heroImage from '@/landing_assets/hero_icon.PNG?url';
import logoImage from '@/landing_assets/logo.PNG?url';
import { MerchantEntryLink } from './MerchantEntryLink';
import styles from './LandingPage.module.css';
import { landingRoutes } from './landing-content';

export function HeroSection() {
  return (
    <section
      aria-label="Hero"
      className={`${styles.section} ${styles.hero}`}
    >
      <div className={styles.heroCopy}>
        <Image
          src={logoImage}
          alt=""
          width={240}
          height={84}
          unoptimized
          className={styles.heroLogo}
        />
        <h1 className={styles.heroTitle}>少沟通，多成交</h1>
        <p className={styles.heroSubtitle}>
          让美甲预约更智能：基于 AI 拆解美甲款式图片，集合报价、预约、款式库的智能全链运营系统
        </p>
        <div className={styles.heroActions}>
          <MerchantEntryLink className={`${styles.buttonBase} ${styles.heroMerchantButton}`}>
            商家入口
          </MerchantEntryLink>
          <Link
            href={landingRoutes.customer}
            className={`${styles.buttonBase} ${styles.heroCustomerButton}`}
          >
            用户入口
          </Link>
        </div>
      </div>
      <div className={styles.heroVisual}>
        <div className={styles.heroShadow} aria-hidden="true" />
        <Image
          src={heroImage}
          alt=""
          width={640}
          height={640}
          priority
          unoptimized
          className={styles.heroIllustration}
        />
      </div>
    </section>
  );
}
