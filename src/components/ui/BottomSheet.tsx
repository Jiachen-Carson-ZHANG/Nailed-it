import type { ReactNode } from 'react';
import { Button } from './Button';

type BottomSheetProps = {
  children: ReactNode;
  onClose: () => void;
  open: boolean;
  title: string;
};

export function BottomSheet({ children, onClose, open, title }: BottomSheetProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="sheet-backdrop" role="presentation">
      <section aria-label={title} aria-modal="true" className="bottom-sheet" role="dialog">
        <div className="sheet-header">
          <div className="sheet-handle" aria-hidden="true" />
          <div className="sheet-header-row">
            <h2>{title}</h2>
            <Button aria-label="Close" size="compact" variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
        <div className="sheet-body">{children}</div>
      </section>
    </div>
  );
}
