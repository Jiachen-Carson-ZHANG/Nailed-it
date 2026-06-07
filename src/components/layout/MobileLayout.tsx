'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import type { UserRole } from '@/domain/nail';
import {
  getCustomerBookingPath,
  getCustomerProfilePath,
  getMerchantProfilePath,
  getMockSession
} from '@/domain/session';
import { useLanguage } from '@/i18n/context';
import { BottomTabBar } from './BottomTabBar';
import { TopBar } from './TopBar';
import { ResetLink } from '@/components/ui/ResetLink';

type MobileLayoutProps = {
  brandHref?: string;
  children: ReactNode;
  role: UserRole;
  showTabs?: boolean;
  subtitle?: string;
  title?: string;
  wide?: boolean;
};

export function MobileLayout({
  brandHref,
  children,
  role,
  showTabs = true,
  subtitle,
  title,
  wide = false,
}: MobileLayoutProps) {
  const { t } = useLanguage();
  const session = getMockSession(role);
  const profilePath = role === 'customer' ? getCustomerProfilePath() : getMerchantProfilePath();
  const avatarInitial = role === 'customer' ? 'M' : 'N';
  const newNailDesignLabel = role === 'customer' ? t('layout.newNailDesign') : null;
  const openProfileLabel = t('layout.openProfile');
  const rightSlot = (
    <>
      {role === 'customer' && newNailDesignLabel ? (
        <ResetLink aria-label={newNailDesignLabel} className="top-bar-cta" href={getCustomerBookingPath()}>
          <span aria-hidden="true">＋ </span>
          {newNailDesignLabel}
        </ResetLink>
      ) : null}
      <Link aria-label={openProfileLabel} className="top-bar-avatar" href={profilePath}>
        {avatarInitial}
      </Link>
    </>
  );

  return (
    <div className={wide ? 'mobile-shell mobile-shell-workspace' : 'mobile-shell'}>
      <TopBar
        brandHref={brandHref ?? session.brandHref}
        rightSlot={rightSlot}
        subtitle={subtitle}
        title={title}
      />
      <main
        className={[
          'mobile-content',
          showTabs && 'mobile-content-with-tabs',
          wide && 'mobile-content-workspace',
        ].filter(Boolean).join(' ')}
      >
        {children}
      </main>
      {showTabs ? <BottomTabBar role={role} /> : null}
    </div>
  );
}
