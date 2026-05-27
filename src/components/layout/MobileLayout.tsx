import type { ReactNode } from 'react';
import Link from 'next/link';
import type { UserRole } from '@/domain/nail';
import { getCustomerProfilePath, getMockSession } from '@/domain/session';
import { BottomTabBar } from './BottomTabBar';
import { TopBar } from './TopBar';

type MobileLayoutProps = {
  brandHref?: string;
  children: ReactNode;
  role: UserRole;
  showTabs?: boolean;
  subtitle?: string;
  title?: string;
};

export function MobileLayout({
  brandHref,
  children,
  role,
  showTabs = true,
  subtitle,
  title
}: MobileLayoutProps) {
  const session = getMockSession(role);
  const rightSlot =
    role === 'customer' ? (
      <Link aria-label="Open profile" className="top-bar-avatar" href={getCustomerProfilePath()}>
        M
      </Link>
    ) : null;

  return (
    <div className="mobile-shell">
      <TopBar
        brandHref={brandHref ?? session.brandHref}
        rightSlot={rightSlot}
        subtitle={subtitle}
        title={title}
      />
      <main className={showTabs ? 'mobile-content mobile-content-with-tabs' : 'mobile-content'}>
        {children}
      </main>
      {showTabs ? <BottomTabBar role={role} /> : null}
    </div>
  );
}
