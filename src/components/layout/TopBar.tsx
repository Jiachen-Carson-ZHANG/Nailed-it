import Link from 'next/link';
import type { ReactNode } from 'react';

type TopBarProps = {
  brandHref?: string;
  rightSlot?: ReactNode;
  subtitle?: string;
  title?: string;
};

export function TopBar({ brandHref = '/', rightSlot, subtitle, title = 'Nailed-it' }: TopBarProps) {
  return (
    <header className="top-bar">
      <div className="top-bar-inner">
        <div className="top-bar-row">
          <Link className="top-brand" href={brandHref}>
            {title}
          </Link>
          {rightSlot ? <div className="top-bar-right">{rightSlot}</div> : null}
        </div>
        {subtitle ? <p className="top-subtitle">{subtitle}</p> : null}
      </div>
    </header>
  );
}
