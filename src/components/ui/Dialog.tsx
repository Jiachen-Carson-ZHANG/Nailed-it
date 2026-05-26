'use client';

import * as RD from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  ariaLabel?: string;
};

export function Dialog({ open, onOpenChange, title, description, children, ariaLabel }: DialogProps) {
  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="dialog-overlay" />
        <RD.Content className="dialog-content" aria-label={ariaLabel}>
          <RD.Title className="dialog-title">{title}</RD.Title>
          {description ? <RD.Description className="dialog-description">{description}</RD.Description> : null}
          <div className="dialog-body">{children}</div>
          <RD.Close aria-label="Close" className="dialog-close">
            ×
          </RD.Close>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
