'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { UserRole } from '@/domain/nail';
import { getMockSession } from '@/domain/session';
import { useLanguage } from '@/i18n/context';
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

const localizedTabLabels = {
  customer: {
    '/customer/home': { 'zh-CN': '首页', en: 'Home' },
    '/customer/booking': { 'zh-CN': '预约', en: 'Book' },
    '/customer/messages': { 'zh-CN': '消息', en: 'Messages' },
    '/customer/profile': { 'zh-CN': '我的', en: 'Me' },
  },
  merchant: {
    '/merchant/calendar': { 'zh-CN': '日历', en: 'Calendar' },
    '/merchant/manage': { 'zh-CN': '管理', en: 'Manage' },
    '/merchant/messages': { 'zh-CN': '消息', en: 'Messages' },
    '/merchant/profile': { 'zh-CN': '我的', en: 'Me' },
  },
} as const;

const navigationLabels = {
  customer: { 'zh-CN': '顾客导航', en: 'Customer navigation' },
  merchant: { 'zh-CN': '商家导航', en: 'Merchant navigation' },
} as const;

export function BottomTabBar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const router = useRouter();
  const { language } = useLanguage();
  const tabs = getMockSession(role).tabs;

  return (
    <nav
      aria-label={navigationLabels[role][language]}
      className="bottom-tab-bar"
      style={{ ['--tab-count' as string]: String(Math.max(tabs.length, 1)) }}
    >
      {tabs.map((tab) => {
        const active = pathname.startsWith(tab.matchPrefix ?? tab.href);
        // 中文注释：用稳定路由 key 做映射，避免未来调整英文 label 时把 icon/文案联动搞断。
        const tabKey = tab.href as keyof (typeof tabIconsByRole)[typeof role];
        const iconSrc = tabIconsByRole[role][tabKey];
        const localizedLabel = localizedTabLabels[role][tabKey][language];

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
