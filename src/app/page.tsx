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
      <section className={styles.hero} aria-labelledby="landing-title">
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>Nailed-it</p>
          <h1 id="landing-title" className={styles.title}>
            让美甲预约更智能
          </h1>
          <p className={styles.deck}>
            基于AI拆解美甲款式图片，集合报价、预约、款式库的智能全链运营系统
          </p>
          <p className={styles.valueLine}>少沟通、多成交</p>
          <div className={styles.ctaGroup}>
            <Link className={styles.primaryCta} href={customerPath}>
              <span className={styles.ctaLabel}>用户入口</span>
              <strong>上传参考图，开始选款预约</strong>
            </Link>
            <Link className={styles.secondaryCta} href={merchantPath}>
              <span className={styles.ctaLabel}>商家入口</span>
              <strong>管理价目、排班与款式沉淀</strong>
            </Link>
          </div>
        </div>

        <div className={styles.heroArt} aria-hidden="true">
          <Image
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 42vw, 100vw"
            src="/landing/hero-shadow.png"
          />
          <Image
            alt=""
            priority
            src="/landing/logo.png"
            width={180}
            height={180}
          />
          <Image
            alt=""
            priority
            src="/landing/hero-icon.png"
            width={320}
            height={320}
          />
        </div>
      </section>

      <section className={styles.problemSection} aria-labelledby="problem-title">
        <div className={styles.sectionHeading}>
          <p className={styles.sectionEyebrow}>商家入口</p>
          <h2 id="problem-title">好看的款式背后，是低效的预约流程</h2>
        </div>
        <div className={styles.problemGrid}>
          {landingProblemCards.map((card) => (
            <article key={card.label} className={styles.problemCard}>
              <h3>{card.label}</h3>
              <p>{card.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.capabilitySection} aria-label="核心能力">
        {landingCapabilities.map((capability) => (
          <article key={capability.title} className={styles.capabilityCard}>
            <p className={styles.capabilityOverline}>{capability.title}</p>
            <h2>{capability.summary}</h2>
            <p>{capability.body}</p>
          </article>
        ))}
      </section>

      <section className={styles.outcomeSection} aria-label="价值总结">
        {landingOutcomeLines.map((line) => (
          <p key={line} className={styles.outcomePill}>
            {line}
          </p>
        ))}
      </section>

      <section className={styles.closingSection} aria-label="再次进入产品">
        <Link
          aria-label="去体验智能预约流程"
          className={styles.primaryCta}
          href={customerPath}
        >
          <span className={styles.ctaLabel}>用户入口</span>
          <strong>去体验智能预约流程</strong>
        </Link>
        <Link
          aria-label="去查看运营与管理视图"
          className={styles.secondaryCta}
          href={merchantPath}
        >
          <span className={styles.ctaLabel}>商家入口</span>
          <strong>去查看运营与管理视图</strong>
        </Link>
      </section>
    </main>
  );
}
