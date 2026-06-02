'use client';

import { useEffect, useRef, useState } from 'react';

import { whyItWorksLines } from './landing-content';
import { LoopArrowGraphic } from './LoopArrowGraphic';

const RAW_PROGRESS_MAX = 0.999999;
const STEP_PROGRESS_START = 0.18;
const STEP_PROGRESS_END = 0.82;
const VISUALLY_HIDDEN_STYLES = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0
} as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getStepFromProgress(progress: number, stepCount: number) {
  const calibratedProgress = clamp(
    (progress - STEP_PROGRESS_START) / (STEP_PROGRESS_END - STEP_PROGRESS_START),
    0,
    RAW_PROGRESS_MAX
  );
  const safeStepCount = Math.max(stepCount, 1);
  const nextStep = Math.floor(calibratedProgress * safeStepCount);

  return Math.min(safeStepCount - 1, nextStep);
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
      // 中文注释：先算出 section 的基础曝光进度，再交给显式阈值做 4 段步进映射。
      const progress = clamp(scrollDistance / scrollRange, 0, RAW_PROGRESS_MAX);
      const nextStep = getStepFromProgress(progress, whyItWorksLines.length);

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
    <section ref={sectionRef} aria-labelledby="why-it-works-heading">
      <h2
        id="why-it-works-heading"
        style={VISUALLY_HIDDEN_STYLES}
      >
        Why It Works
      </h2>
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
