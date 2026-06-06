import Image from 'next/image';

import loopImage from '@/landing_assets/loop.PNG?url';
import styles from './LandingPage.module.css';

type LoopArrowGraphicProps = {
  rotationStep: number;
};

export function LoopArrowGraphic({ rotationStep }: LoopArrowGraphicProps) {
  return (
    <div
      aria-hidden="true"
      className={styles.loopGraphic}
      style={{ ['--why-loop-rotation-step' as string]: rotationStep }}
    >
      <Image
        className={styles.loopImage}
        src={loopImage}
        alt=""
        width={420}
        height={540}
        sizes="(max-width: 768px) 80vw, 420px"
        priority={false}
      />
    </div>
  );
}
