import type { ReactNode } from 'react';
import Link from 'next/link';
import type { UserRole } from '@/domain/nail';
import {
  getCustomerProfilePath,
  getMerchantProfilePath,
  getMockSession,
  homePathForRole
} from '@/domain/session';
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
  const otherRole: UserRole = role === 'customer' ? 'merchant' : 'customer';
  const switchLabel = role === 'customer' ? 'Merchant' : 'Customer';
  const profilePath = role === 'customer' ? getCustomerProfilePath() : getMerchantProfilePath();
  const avatarInitial = role === 'customer' ? 'M' : 'N';
  const rightSlot = (
    <>
      <Link
        aria-label={`Switch to ${switchLabel.toLowerCase()} view`}
        className="role-switch-pill"
        href={homePathForRole(otherRole)}
      >
        {switchLabel} ↗
      </Link>
      <Link aria-label="Open profile" className="top-bar-avatar" href={profilePath}>
        {avatarInitial}
      </Link>
    </>
  );

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
