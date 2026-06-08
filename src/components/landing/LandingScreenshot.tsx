import type { StaticImageData } from 'next/image';

import styles from './LandingPage.module.css';

type LandingScreenshotProps = {
  alt: string;
  src: StaticImageData;
  variant?: 'solution' | 'journey';
};

export function LandingScreenshot({
  alt,
  src,
  variant = 'journey'
}: LandingScreenshotProps) {
  return (
    <div
      className={styles.screenshotFrame}
      data-variant={variant}
    >
      <img
        alt={alt}
        className={styles.screenshotImage}
        src={typeof src === 'string' ? src : src.src}
      />
    </div>
  );
}
