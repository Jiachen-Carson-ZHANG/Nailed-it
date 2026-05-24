'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Button } from './Button';

type BottomSheetProps = {
  children: ReactNode;
  onClose: () => void;
  open: boolean;
  title: string;
};

export function BottomSheet({ children, onClose, open, title }: BottomSheetProps) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="sheet-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
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
