import Image from 'next/image';
import Link from 'next/link';
import { getMockSession } from '@/domain/session';
import {
  landingCapabilities,
  landingOutcomeLines,
  landingProblemCards
} from './landing-content';
import styles from './page.module.css';

const customerPath = getMockSession('customer').homePath;
const merchantPath = getMockSession('merchant').homePath;

export default function LandingPage() {
  return (
    <main className={styles.page}>
      <section className={`${styles.section} ${styles.hero}`} aria-labelledby="landing-title">
        <div className={styles.heroBody}>
          <p className={styles.heroDeck}>AI nail booking assistant</p>
          <h1 id="landing-title" className={styles.heroTitle}>
            让美甲预约更智能
          </h1>
          <p className={styles.heroValueLine}>少沟通、多成交</p>
          <p className={styles.heroDescription}>
            从试戴选款、AI 识图、快速报价到沉淀图册，把灵感、沟通和预约流程整合成一个更顺手的体验。
          </p>
          <div className={styles.ctaGroup}>
            <Link className={styles.ctaPrimary} href={customerPath}>
              用户入口
            </Link>
            <Link className={styles.ctaSecondary} href={merchantPath}>
              商家入口
            </Link>
          </div>
        </div>
        <div className={styles.heroArt} aria-label="Landing hero art">
          <Image
            className={styles.heroArtImage}
            src="/landing/logo.png"
            alt="Nailed-it logo"
            width={240}
            height={118}
            priority
          />
          <Image
            className={styles.heroArtImage}
            src="/landing/hero-icon.png"
            alt="Nail style illustration"
            width={220}
            height={294}
            priority
          />
          <Image
            className={styles.heroArtImage}
            src="/landing/hero-shadow.png"
            alt="Decorative shadow"
            width={320}
            height={39}
            priority
          />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="landing-problem-title">
        <h2 id="landing-problem-title" className={styles.sectionTitle}>
          好看的款式背后，是低效的预约流程
        </h2>
        <div className={styles.cardGrid}>
          {landingProblemCards.map((card) => (
            <article key={card.label} className={styles.card}>
              <h3 className={styles.cardLabel}>{card.label}</h3>
              <p className={styles.cardBody}>{card.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="landing-capabilities-title">
        <h2 id="landing-capabilities-title" className={styles.sectionTitle}>
          用一套体验，接住用户灵感到预约的全过程
        </h2>
        <div className={styles.cardGrid}>
          {landingCapabilities.map((capability) => (
            <article key={capability.title} className={styles.card}>
              <h3 className={styles.cardTitle}>{capability.title}</h3>
              <p className={styles.cardSummary}>{capability.summary}</p>
              <p className={styles.cardBody}>{capability.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="landing-outcomes-title">
        <h2 id="landing-outcomes-title" className={styles.sectionTitle}>
          一次上新，不止解决一次预约
        </h2>
        <ul className={styles.outcomeList}>
          {landingOutcomeLines.map((line) => (
            <li key={line} className={styles.outcomeItem}>
              {line}
            </li>
          ))}
        </ul>
      </section>

      <section className={`${styles.section} ${styles.closing}`} aria-labelledby="landing-closing-title">
        <h2 id="landing-closing-title" className={styles.sectionTitle}>
          现在就开始体验更顺手的美甲预约流程
        </h2>
        <p className={styles.sectionIntro}>
          用户可以先试戴、再预约；商家可以先沉淀款式、再持续转化。
        </p>
        <div className={styles.ctaGroup}>
          <Link className={styles.ctaPrimary} href={customerPath}>
            开始试戴预约
          </Link>
          <Link className={styles.ctaSecondary} href={merchantPath}>
            进入商家工作台
          </Link>
        </div>
      </section>
    </main>
  );
}
