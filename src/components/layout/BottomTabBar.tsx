'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { UserRole } from '@/domain/nail';

type TabItem = {
  glyph: string;
  href: string;
  label: string;
};

const customerTabs: TabItem[] = [
  { href: '/customer/home', label: 'Home', glyph: '⌂' },
  { href: '/customer/booking', label: 'Book', glyph: '✦' },
  { href: '/customer/messages', label: 'Messages', glyph: '✉' },
  { href: '/customer/profile', label: 'Me', glyph: '◉' }
];

const merchantTabs: TabItem[] = [
  { href: '/merchant/calendar', label: 'Calendar', glyph: '◫' },
  { href: '/merchant/manage', label: 'Manage', glyph: '⚙' },
  { href: '/merchant/messages', label: 'Messages', glyph: '✉' },
  { href: '/merchant/profile', label: 'Me', glyph: '◉' }
];

export function BottomTabBar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const tabs = role === 'customer' ? customerTabs : merchantTabs;

  return (
    <nav aria-label={`${role} navigation`} className="bottom-tab-bar">
      {tabs.map((tab) => {
        // 中文注释：这里用 startsWith 保持后续子路由也能点亮对应 tab，比如 /customer/messages/123。
        const active = pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            className={active ? 'tab-item tab-item-active' : 'tab-item'}
            href={tab.href}
          >
            <span aria-hidden="true" className="tab-glyph">
              {tab.glyph}
            </span>
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
