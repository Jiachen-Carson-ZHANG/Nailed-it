import type { UserRole } from './nail';

export const defaultMockRole: UserRole = 'customer';

export type ShellTab = {
  glyph: string;
  href: string;
  label: string;
  matchPrefix?: string;
};

export type MockSession = {
  brandHref: string;
  homePath: string;
  role: UserRole;
  tabs: ShellTab[];
};

type MockSessionTemplate = {
  brandHref: string;
  homePath: string;
  role: UserRole;
  tabs: Array<ShellTab & { available: boolean }>;
};

const mockSessionTemplatesByRole: Record<UserRole, MockSessionTemplate> = {
  customer: {
    role: 'customer',
    brandHref: '/customer/home',
    homePath: '/customer/home',
    tabs: [
      { href: '/customer/home', label: 'Home', glyph: '⌂', available: true },
      { href: '/customer/booking', label: 'Book', glyph: '✦', available: false },
      { href: '/customer/messages', label: 'Messages', glyph: '✉', available: false },
      { href: '/customer/profile', label: 'Me', glyph: '◉', available: false }
    ]
  },
  merchant: {
    role: 'merchant',
    brandHref: '/merchant/calendar',
    homePath: '/merchant/calendar',
    tabs: [
      { href: '/merchant/calendar', label: 'Calendar', glyph: '◫', available: true },
      { href: '/merchant/manage', label: 'Manage', glyph: '⚙', available: false },
      { href: '/merchant/messages', label: 'Messages', glyph: '✉', available: false },
      { href: '/merchant/profile', label: 'Me', glyph: '◉', available: false }
    ]
  }
};

function toMockSession({ tabs, ...template }: MockSessionTemplate): MockSession {
  return {
    ...template,
    tabs: tabs.filter((tab) => tab.available).map(({ available: _available, ...tab }) => tab)
  };
}

export const defaultMockSession: MockSession = toMockSession(
  mockSessionTemplatesByRole[defaultMockRole]
);

export function getMockSession(role: UserRole): MockSession {
  return toMockSession(mockSessionTemplatesByRole[role]);
}

export function homePathForRole(role: UserRole): string {
  return getMockSession(role).homePath;
}

export function isCustomerPath(pathname: string): boolean {
  return pathname.startsWith('/customer');
}

export function isMerchantPath(pathname: string): boolean {
  return pathname.startsWith('/merchant');
}
