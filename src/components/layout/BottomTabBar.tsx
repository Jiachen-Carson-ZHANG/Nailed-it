'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { UserRole } from '@/domain/nail';
import { getMockSession } from '@/domain/session';
import { useLanguage } from '@/i18n/context';
import type { UiMessageKey } from '@/i18n/messages/ui/zh-CN';
import calendarIcon from '@/landing_assets/calendar.png';
import homeIcon from '@/landing_assets/home.png';
import messageIcon from '@/landing_assets/message.png';
import moneybagIcon from '@/landing_assets/moneybag.png';
import nailIcon from '@/landing_assets/nail.png';
import profileIcon from '@/landing_assets/profile.png';

const tabIconsByRole = {
  customer: {
    '/customer/home': homeIcon,
    '/customer/booking': nailIcon,
    '/customer/messages': messageIcon,
    '/customer/profile': profileIcon
  },
  merchant: {
    '/merchant/calendar': calendarIcon,
    '/merchant/manage': moneybagIcon,
    '/merchant/messages': messageIcon,
    '/merchant/profile': profileIcon
  }
} as const;

const tabLabelKeys: Record<UserRole, Record<string, UiMessageKey>> = {
  customer: {
    '/customer/home': 'nav.customer.home',
    '/customer/booking': 'nav.customer.booking',
    '/customer/messages': 'nav.customer.messages',
    '/customer/profile': 'nav.customer.profile',
  },
  merchant: {
    '/merchant/calendar': 'nav.merchant.calendar',
    '/merchant/manage': 'nav.merchant.manage',
    '/merchant/messages': 'nav.merchant.messages',
    '/merchant/profile': 'nav.merchant.profile',
  },
};

const navigationAriaKeys: Record<UserRole, UiMessageKey> = {
  customer: 'nav.customer.aria',
  merchant: 'nav.merchant.aria',
};

export function BottomTabBar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLanguage();
  const tabs = getMockSession(role).tabs;

  return (
    <nav
      aria-label={t(navigationAriaKeys[role])}
      className="bottom-tab-bar"
      style={{ ['--tab-count' as string]: String(Math.max(tabs.length, 1)) }}
    >
      {tabs.map((tab) => {
        const active = pathname.startsWith(tab.matchPrefix ?? tab.href);
        const tabKey = tab.href as keyof (typeof tabIconsByRole)[typeof role];
        const iconSrc = tabIconsByRole[role][tabKey];
        const labelKey = tabLabelKeys[role][tab.href];
        const localizedLabel = labelKey ? t(labelKey) : tab.label;

        return (
          <Link
            key={tab.href}
            aria-label={localizedLabel}
            className={active ? 'tab-item tab-item-active' : 'tab-item'}
            href={tab.href}
            onClick={tab.forceRemount ? (e) => { e.preventDefault(); router.push(`${tab.href}?t=${Date.now()}`); } : undefined}
          >
            <span aria-hidden="true" className="tab-glyph">
              {iconSrc ? (
                <Image
                  alt=""
                  className="tab-glyph-image"
                  draggable={false}
                  height={16}
                  src={iconSrc}
                  width={16}
                />
              ) : tab.glyph}
            </span>
            <span aria-hidden="true">{localizedLabel}</span>
          </Link>
        );
      })}
    </nav>
  );
}
