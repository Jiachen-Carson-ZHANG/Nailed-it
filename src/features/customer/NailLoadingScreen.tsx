'use client';

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
  // done / onTransitionEnd wired in a later task
  void done;
  void onTransitionEnd;
  return (
    <div className="nail-loading" role="status" aria-label="正在生成美甲效果图" aria-live="polite">
      <BgPrintLayer />
      {/* PolishGame — later task */}
      {/* LoadingStatus — later task */}
    </div>
  );
}
