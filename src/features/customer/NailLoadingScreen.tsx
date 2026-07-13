'use client';

type NailLoadingScreenProps = {
  done: boolean;
  onTransitionEnd: () => void;
};

export function NailLoadingScreen({ done, onTransitionEnd }: NailLoadingScreenProps) {
  // done / onTransitionEnd wired in a later task
  void done;
  void onTransitionEnd;
  return (
    <div className="nail-loading" role="status" aria-label="正在生成美甲效果图" aria-live="polite">
      {/* BgPrintLayer — later task */}
      {/* PolishGame — later task */}
      {/* LoadingStatus — later task */}
    </div>
  );
}
