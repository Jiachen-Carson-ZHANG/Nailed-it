'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { UserRole } from '@/domain/nail';
import { getMockSession } from '@/domain/session';

const BOOKING_PATH = '/customer/booking';

export function BottomTabBar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const router = useRouter();
  const tabs = getMockSession(role).tabs;

  return (
    <nav
      aria-label={`${role} navigation`}
      className="bottom-tab-bar"
      style={{ ['--tab-count' as string]: String(Math.max(tabs.length, 1)) }}
    >
      {tabs.map((tab) => {
        const active = pathname.startsWith(tab.matchPrefix ?? tab.href);
        const isBooking = tab.href === BOOKING_PATH && role === 'customer';

        function handleBookingClick(e: React.MouseEvent) {
          e.preventDefault();
          router.push(`${BOOKING_PATH}?t=${Date.now()}`);
        }

        return (
          <Link
            key={tab.href}
            aria-label={tab.label}
            className={active ? 'tab-item tab-item-active' : 'tab-item'}
            href={tab.href}
            onClick={isBooking ? handleBookingClick : undefined}
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
