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

const BOTTLE_COLORS = [
  ['#ec5d7b', '#c73963'], // 粉
  ['#e6c9a8', '#c99a63'], // 裸
  ['#e5484d', '#b91c1c'], // 红
  ['#a78bda', '#7c5bd0'], // 紫
];

function PolishGame() {
  const [fill, setFill] = useState(0);        // 0..100
  const [colorIdx, setColorIdx] = useState(0);
  const [shake, setShake] = useState(false);
  const [flash, setFlash] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  const onPoke = () => {
    if (fill >= 100) return; // already full & flashing — ignore extra pokes (no timer stacking)

    setShake(true);
    timers.current.push(window.setTimeout(() => setShake(false), 220));

    const next = fill + 12;
    if (next >= 100) {
      setFill(100);
      setFlash(true);
      timers.current.push(window.setTimeout(() => {
        setFlash(false);
        setFill(0);
        setColorIdx((c) => (c + 1) % BOTTLE_COLORS.length);
      }, 500));
    } else {
      setFill(next);
    }
  };

  const [top, bottom] = BOTTLE_COLORS[colorIdx];

  return (
    <button
      type="button"
      className={`nail-loading-bottle nail-loading-bottle-btn${shake ? ' is-shaking' : ''}${flash ? ' is-flashing' : ''}`}
      onClick={onPoke}
      aria-label="点击摇一摇指甲油"
    >
      <span className="nail-loading-bottle-cap" aria-hidden="true" />
      <span className="nail-loading-bottle-body" aria-hidden="true">
        <span
          className="nail-loading-bottle-fill"
          style={{ height: `${fill}%`, backgroundImage: `linear-gradient(180deg, ${top}, ${bottom})` }}
        />
      </span>
    </button>
  );
}

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

  useEffect(() => {
    if (done) onTransitionEnd();
  }, [done, onTransitionEnd]);

  return (
    <div className="nail-loading" role="status" aria-label="正在生成美甲效果图" aria-live="polite">
      <BgPrintLayer />
      <PolishGame />
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
