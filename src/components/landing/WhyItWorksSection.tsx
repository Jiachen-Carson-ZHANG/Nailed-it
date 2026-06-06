'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import styles from './LandingPage.module.css';
import { whyItWorksLines } from './landing-content';
import { LoopArrowGraphic } from './LoopArrowGraphic';

const WHY_AUTOPLAY_INTERVAL_MS = 1600;

const whyLinePositions = ['right', 'bottom', 'left', 'top'] as const;

function splitWhyLine(line: string) {
  return line.split('，').map((part) => part.trim());
}

function getNextStep(currentStep: number) {
  return (currentStep + 1) % whyLinePositions.length;
}

function getRotatingPosition(itemIndex: number, activeStep: number) {
  const safeStep = activeStep % whyLinePositions.length;
  const positionIndex = (itemIndex - safeStep + whyLinePositions.length) % whyLinePositions.length;

  return whyLinePositions[positionIndex];
}

export function WhyItWorksSection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const autoplayIntervalRef = useRef<number | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [rotationStep, setRotationStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const whyLineItems = useMemo(
    () =>
      whyItWorksLines.map((line, index) => ({
        key: line,
        itemIndex: index,
        lines: splitWhyLine(line),
        position: getRotatingPosition(index, activeStep)
      })),
    [activeStep]
  );

  useEffect(() => {
    const section = sectionRef.current;

    if (!section) {
      return;
    }

    if (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setActiveStep(0);
      setRotationStep(0);
      return;
    }

    if (typeof IntersectionObserver !== 'function') {
      setActiveStep(0);
      setRotationStep(0);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) {
          return;
        }

        if (entry.isIntersecting) {
          setIsAnimating(true);

          if (autoplayIntervalRef.current !== null) {
            return;
          }

          autoplayIntervalRef.current = window.setInterval(() => {
            setActiveStep((currentStep) => getNextStep(currentStep));
            // 中文注释：单独累计旋转步数，避免 270deg 回到 0deg 时出现反向补间。
            setRotationStep((currentStep) => currentStep + 1);
          }, WHY_AUTOPLAY_INTERVAL_MS);

          return;
        }

        setIsAnimating(false);

        if (autoplayIntervalRef.current !== null) {
          window.clearInterval(autoplayIntervalRef.current);
          autoplayIntervalRef.current = null;
        }
      },
      {
        threshold: 0.42
      }
    );

    observer.observe(section);

    return () => {
      observer.disconnect();
      if (autoplayIntervalRef.current !== null) {
        window.clearInterval(autoplayIntervalRef.current);
        autoplayIntervalRef.current = null;
      }
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      aria-labelledby="why-it-works-heading"
      className={`${styles.section} ${styles.why}`}
      data-active-step={activeStep}
      data-animated={isAnimating}
      data-rotation-step={rotationStep}
    >
      <div className={`${styles.sectionContent} ${styles.whyContent}`}>
        <h2
          id="why-it-works-heading"
          className={styles.hiddenHeading}
        >
          Why It Works
        </h2>
        <p className={styles.whyTitle}>
          Nailed-it 不只是预约入口，而是一套
          <br />
          从选款到成交、从服务到复购的美甲运营闭环
        </p>
        <div className={styles.whyOrbit}>
          <LoopArrowGraphic rotationStep={rotationStep} />
          {whyLineItems.map((item, index) => (
            <p
              key={item.key}
              className={styles.whyLine}
              data-active={index === activeStep}
              data-line-index={item.itemIndex}
              data-position={item.position}
              data-step={index}
            >
              {item.lines.map((part) => (
                <span key={part}>{part}</span>
              ))}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
