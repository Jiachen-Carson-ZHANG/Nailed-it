import styles from './LandingPage.module.css';

export function PhoneMockup() {
  return (
    <div
      className={styles.phoneMockup}
      aria-hidden="true"
    >
      <div className={styles.phoneNotch} />
      <div className={styles.phoneScreen} />
      <div className={styles.phoneFooterLine} />
      <div className={styles.phoneFooterDot} />
    </div>
  );
}
