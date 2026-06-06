import Link from 'next/link';
import type { ReactNode } from 'react';
import { BrandLogo } from './BrandLogo';

type TopBarProps = {
  brandHref?: string;
  rightSlot?: ReactNode;
  subtitle?: string;
  title?: string;
};

export function TopBar({ brandHref = '/', rightSlot, subtitle }: TopBarProps) {
  return (
    <header className="top-bar">
      <div className="top-bar-inner">
        <div className="top-bar-row">
          <Link className="top-brand" href={brandHref}>
            <BrandLogo />
          </Link>
          {rightSlot ? <div className="top-bar-right">{rightSlot}</div> : null}
        </div>
        {subtitle ? <p className="top-subtitle">{subtitle}</p> : null}
      </div>
    </header>
  );
}
