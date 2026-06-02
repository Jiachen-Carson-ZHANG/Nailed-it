'use client';

import { useEffect, useRef, useState } from 'react';

import { whyItWorksLines } from './landing-content';
import { LoopArrowGraphic } from './LoopArrowGraphic';

const LAST_SCROLL_PROGRESS = 0.999999;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function WhyItWorksSection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const section = sectionRef.current;

    if (!section) {
      return;
    }

    if (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    const updateActiveStep = () => {
      const rect = section.getBoundingClientRect();
      const sectionTop = window.scrollY + rect.top;
      const scrollDistance = window.scrollY + window.innerHeight - sectionTop;
      const scrollRange = Math.max(rect.height + window.innerHeight, 1);
      // 中文注释：把当前 section 的滚动曝光度压缩到 0~1，再映射成 4 个离散步骤。
      const progress = clamp(scrollDistance / scrollRange, 0, LAST_SCROLL_PROGRESS);
      const nextStep = Math.min(
        whyItWorksLines.length - 1,
        Math.floor(progress * whyItWorksLines.length)
      );

      setActiveStep((currentStep) => (currentStep === nextStep ? currentStep : nextStep));
    };

    updateActiveStep();
    window.addEventListener('scroll', updateActiveStep, { passive: true });
    window.addEventListener('resize', updateActiveStep);

    return () => {
      window.removeEventListener('scroll', updateActiveStep);
      window.removeEventListener('resize', updateActiveStep);
    };
  }, []);

  return (
    <section ref={sectionRef} aria-label="Why It Works">
      <LoopArrowGraphic />
      <div>
        {whyItWorksLines.map((line, index) => (
          <p
            key={line}
            data-active={index === activeStep}
            data-step={index}
          >
            {line}
          </p>
        ))}
      </div>
    </section>
  );
}
