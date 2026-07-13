'use client';

import { useEffect, useRef, useState } from 'react';
import { computeFakeProgress } from './loading-progress';

type NailLoadingScreenProps = {
  done: boolean;
  onTransitionEnd: () => void;
};

// 10 prints scattered around the edges (avoid the central game zone).
// [emoji, top%, left%, sizeRem, delaySec]
const PRINTS: [string, number, number, number, number][] = [
  ['💅', 8,  6,  2.2, 0],
  ['✨', 14, 82, 1.4, 1.1],
  ['🩷', 24, 14, 1.8, 2.3],
  ['⭐', 6,  46, 1.3, 0.6],
  ['🎀', 30, 78, 2.0, 1.7],
  ['✨', 70, 8,  1.5, 3.1],
  ['💅', 82, 84, 2.4, 0.9],
  ['🩷', 88, 30, 1.6, 2.0],
  ['⭐', 64, 88, 1.3, 1.4],
  ['🎀', 76, 50, 1.9, 2.7],
];

const LOADING_PHRASES = [
  '正在为你的手涂上第一层色彩…',
  '正在调和你的专属色调…',
  '正在点缀闪耀的细节…',
  '马上就要完成啦…',
];

function BgPrintLayer() {
  return (
    <div className="nail-loading-prints" aria-hidden="true">
      {PRINTS.map(([emoji, top, left, size, delay], i) => (
        <span
          key={i}
          className="nail-loading-print"
          style={{
            top: `${top}%`,
            left: `${left}%`,
            fontSize: `${size}rem`,
            animationDelay: `${delay}s`,
          }}
        >
          {emoji}
        </span>
      ))}
    </div>
  );
}

export function NailLoadingScreen({ done, onTransitionEnd }: NailLoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [phraseIdx, setPhraseIdx] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  // rAF progress loop — only mutates one width value, no setInterval DOM thrash
  useEffect(() => {
    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const elapsed = now - startRef.current;
      const next = Math.round(computeFakeProgress(elapsed, done) * 10) / 10;
      setProgress((prev) => (prev === next ? prev : next));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [done]);

  // phrase rotation every 3.5s
  useEffect(() => {
    // 3500ms must match the nailPhraseFade CSS animation duration (3.5s)
    const id = setInterval(() => {
      setPhraseIdx((i) => (i + 1) % LOADING_PHRASES.length);
    }, 3500);
    return () => clearInterval(id);
  }, []);

  void onTransitionEnd; // wired in a later task

  return (
    <div className="nail-loading" role="status" aria-label="正在生成美甲效果图" aria-live="polite">
      <BgPrintLayer />
      {/* PolishGame — later task */}
      <div className="nail-loading-status">
        <span className="nail-loading-eyebrow">NAIL STUDIO</span>
        <h1 className="nail-loading-title">拼贴小屋</h1>
        <p key={phraseIdx} className="nail-loading-phrase">{LOADING_PHRASES[phraseIdx]}</p>
        <div className="nail-loading-bar" aria-hidden="true">
          <div className="nail-loading-bar-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
}
