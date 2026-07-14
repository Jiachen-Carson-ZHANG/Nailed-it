'use client';

import { useCallback, useRef, type ReactNode } from 'react';
import Link from 'next/link';
import type { UserRole } from '@/domain/nail';
import {
  getCustomerHandMatchPath,
  getCustomerProfilePath,
  getMerchantProfilePath,
  getMockSession
} from '@/domain/session';
import { useLanguage } from '@/i18n/context';
import { LanguageSwitcher } from '@/features/shared/LanguageSwitcher';
import { BottomTabBar } from './BottomTabBar';
import { TopBar } from './TopBar';
import { ResetLink } from '@/components/ui/ResetLink';

type MobileLayoutProps = {
  brandHref?: string;
  children: ReactNode;
  mainClassName?: string;
  role: UserRole;
  showTabs?: boolean;
  subtitle?: string;
  title?: string;
  wide?: boolean;
};

export function MobileLayout({
  brandHref,
  children,
  mainClassName,
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

  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    const el = e.currentTarget;
    el.classList.add('is-scrolling');
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => el.classList.remove('is-scrolling'), 1200);
  }, []);

  const rightSlot = (
    <>
      {role === 'customer' && newNailDesignLabel ? (
        <ResetLink aria-label={newNailDesignLabel} className="top-bar-cta" href={getCustomerHandMatchPath()}>
          <span aria-hidden="true">＋ </span>
          {newNailDesignLabel}
        </ResetLink>
      ) : null}
      <LanguageSwitcher />
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
          mainClassName,
        ].filter(Boolean).join(' ')}
        onScroll={handleScroll}
      >
        {children}
      </main>
      {showTabs ? <BottomTabBar role={role} /> : null}
    </div>
  );
}
