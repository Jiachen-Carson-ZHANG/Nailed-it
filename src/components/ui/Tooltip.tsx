'use client';

import * as RT from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';

type TooltipProps = {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  delayMs?: number;
};

export function Tooltip({ content, children, side = 'top', delayMs = 200 }: TooltipProps) {
  return (
    <RT.Provider delayDuration={delayMs}>
      <RT.Root>
        <RT.Trigger asChild>{children}</RT.Trigger>
        <RT.Portal>
          <RT.Content className="tooltip-content" side={side} sideOffset={6}>
            {content}
            <RT.Arrow className="tooltip-arrow" />
          </RT.Content>
        </RT.Portal>
      </RT.Root>
    </RT.Provider>
  );
}
