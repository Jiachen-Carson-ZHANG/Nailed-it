'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { UserRole } from '@/domain/nail';
import { getMockSession } from '@/domain/session';

export function BottomTabBar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const tabs = getMockSession(role).tabs;

  return (
    <nav
      aria-label={`${role} navigation`}
      className="bottom-tab-bar"
      style={{ ['--tab-count' as string]: String(Math.max(tabs.length, 1)) }}
    >
      {tabs.map((tab) => {
        // 中文注释：这里用 startsWith 保持后续子路由也能点亮对应 tab，比如 /customer/messages/123。
        const active = pathname.startsWith(tab.matchPrefix ?? tab.href);

        return (
          <Link
            key={tab.href}
            aria-label={tab.label}
            className={active ? 'tab-item tab-item-active' : 'tab-item'}
            href={tab.href}
          >
            <span aria-hidden="true" className="tab-glyph">
              {tab.glyph}
            </span>
            <span aria-hidden="true">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
