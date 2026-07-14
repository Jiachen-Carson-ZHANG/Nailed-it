'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type NailLoadingScreenProps = {
  done: boolean;
  onTransitionEnd: () => void;
};

const LOADING_PHRASES = [
  '正在为你的手涂上第一层色彩…',
  '正在调和你的专属色调…',
  '正在点缀闪耀的细节…',
  '马上就要完成啦…',
];

const PRINTS = ['💅', '🌸', '✨', '🌷', '💎', '🎀', '🪷', '⭐'];

export function NailLoadingScreen({ done, onTransitionEnd }: NailLoadingScreenProps) {
  const [phraseIdx, setPhraseIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setPhraseIdx((i) => (i + 1) % LOADING_PHRASES.length), 3500);
    return () => clearInterval(id);
  }, []);

  const [leaving, setLeaving] = useState(false);
  const finishedRef = useRef(false);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onTransitionEnd();
  }, [onTransitionEnd]);

  useEffect(() => {
    if (!done) return;
    const pause = window.setTimeout(() => setLeaving(true), 450);
    const safety = window.setTimeout(finish, 1150);
    return () => { window.clearTimeout(pause); window.clearTimeout(safety); };
  }, [done, finish]);

  const handleExitAnimEnd = (e: React.AnimationEvent) => {
    if (e.animationName === 'nailLoadingExit') finish();
  };

  return (
    <div
      className={`nail-loading${leaving ? ' is-leaving' : ''}`}
      role="status"
      aria-label="正在生成美甲效果图"
      aria-live="polite"
      onAnimationEnd={handleExitAnimEnd}
    >
      {/* Floating background prints */}
      <div className="nail-loading-prints" aria-hidden="true">
        {PRINTS.map((emoji, i) => (
          <span
            key={emoji}
            className="nail-loading-print"
            style={{
              '--i': i,
              left: `${10 + (i * 11) % 80}%`,
              top: `${15 + (i * 17) % 60}%`,
            } as React.CSSProperties}
          >
            {emoji}
          </span>
        ))}
      </div>

      <div className="nail-loading-status">
        <span className="nail-loading-eyebrow">NAIL STUDIO</span>
        <h1 className="nail-loading-title">拼贴小屋</h1>
        <p key={phraseIdx} className="nail-loading-phrase">{LOADING_PHRASES[phraseIdx]}</p>
        <div className="nail-loading-bar" aria-hidden="true">
          <div className="nail-loading-bar-fill" />
        </div>
      </div>
    </div>
  );
}
