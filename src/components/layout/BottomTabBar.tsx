'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { UserRole } from '@/domain/nail';
import { getMockSession } from '@/domain/session';
import calendarIcon from '@/landing_assets/calendar.png';
import homeIcon from '@/landing_assets/home.png';
import messageIcon from '@/landing_assets/message.png';
import moneybagIcon from '@/landing_assets/moneybag.png';
import nailIcon from '@/landing_assets/nail.png';
import profileIcon from '@/landing_assets/profile.png';

const tabIconsByRole = {
  customer: {
    Home: homeIcon,
    Book: nailIcon,
    Messages: messageIcon,
    Me: profileIcon
  },
  merchant: {
    Calendar: calendarIcon,
    Manage: moneybagIcon,
    Messages: messageIcon,
    Me: profileIcon
  }
} as const;

export function BottomTabBar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const router = useRouter();
  const tabs = getMockSession(role).tabs;

  function handleTabClick(e: React.MouseEvent, tab: (typeof tabs)[number]) {
    const isBookingTab = role === 'customer' && tab.label === 'Book';
    if (!isBookingTab) return;
    e.preventDefault();
    router.push(`${tab.href}?t=${Date.now()}`);
  }

  return (
    <nav
      aria-label={`${role} navigation`}
      className="bottom-tab-bar"
      style={{ ['--tab-count' as string]: String(Math.max(tabs.length, 1)) }}
    >
      {tabs.map((tab) => {
        const active = pathname.startsWith(tab.matchPrefix ?? tab.href);
        // 中文注释：按当前角色和文案做一层稳定映射，避免改动现有 tab 结构或下面的文字。
        const iconSrc = tabIconsByRole[role][tab.label as keyof (typeof tabIconsByRole)[typeof role]];

        return (
          <Link
            key={tab.href}
            aria-label={tab.label}
            className={active ? 'tab-item tab-item-active' : 'tab-item'}
            href={tab.href}
            onClick={(e) => handleTabClick(e, tab)}
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
            <span aria-hidden="true">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
