import type { UserRole } from './nail';

export const defaultMockRole: UserRole = 'customer';
export type MockRouteIntentKey = 'booking' | 'messages' | 'profile';
export type MockRouteIntentStatus = 'available' | 'planned';

export type ShellTab = {
  glyph: string;
  href: string;
  label: string;
  matchPrefix?: string;
};

export type MockRouteIntent = {
  href?: string;
  key: MockRouteIntentKey;
  label: string;
  note: string;
  status: MockRouteIntentStatus;
};

export type MockSession = {
  brandHref: string;
  homePath: string;
  role: UserRole;
  routeIntents: Record<MockRouteIntentKey, MockRouteIntent>;
  tabs: ShellTab[];
};

type MockSessionTemplate = {
  brandHref: string;
  homePath: string;
  role: UserRole;
  routeIntents: Record<MockRouteIntentKey, MockRouteIntent>;
  tabs: Array<ShellTab & { available: boolean }>;
};

const customerPaths = {
  home: '/customer/home',
  styleDetail: (id: string) => `/customer/style/${id}`
};

const merchantPaths = {
  home: '/merchant/calendar'
};

const mockSessionTemplatesByRole: Record<UserRole, MockSessionTemplate> = {
  customer: {
    role: 'customer',
    brandHref: customerPaths.home,
    homePath: customerPaths.home,
    routeIntents: {
      booking: {
        key: 'booking',
        label: 'Booking flow',
        note: 'Booking is staged through the shared customer session model and will appear here once enabled.',
        status: 'planned'
      },
      messages: {
        key: 'messages',
        label: 'Messages',
        note: 'Customer messages are still planned in the shared session model.',
        status: 'planned'
      },
      profile: {
        key: 'profile',
        label: 'Profile',
        note: 'Customer profile is still planned in the shared session model.',
        status: 'planned'
      }
    },
    tabs: [
      { href: customerPaths.home, label: 'Home', glyph: '⌂', available: true },
      { href: '/customer/booking', label: 'Book', glyph: '✦', available: false },
      { href: '/customer/messages', label: 'Messages', glyph: '✉', available: false },
      { href: '/customer/profile', label: 'Me', glyph: '◉', available: false }
    ]
  },
  merchant: {
    role: 'merchant',
    brandHref: merchantPaths.home,
    homePath: merchantPaths.home,
    routeIntents: {
      booking: {
        key: 'booking',
        label: 'Booking flow',
        note: 'Merchant booking flow is still planned in the shared session model.',
        status: 'planned'
      },
      messages: {
        key: 'messages',
        label: 'Messages',
        note: 'Merchant messages are still planned in the shared session model.',
        status: 'planned'
      },
      profile: {
        key: 'profile',
        label: 'Profile',
        note: 'Merchant profile is still planned in the shared session model.',
        status: 'planned'
      }
    },
    tabs: [
      { href: merchantPaths.home, label: 'Calendar', glyph: '◫', available: true },
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

export function getCustomerStylePath(id: string): string {
  return customerPaths.styleDetail(id);
}

export function getRouteIntent(role: UserRole, key: MockRouteIntentKey): MockRouteIntent {
  return getMockSession(role).routeIntents[key];
}

export function isCustomerPath(pathname: string): boolean {
  return pathname.startsWith('/customer');
}

export function isMerchantPath(pathname: string): boolean {
  return pathname.startsWith('/merchant');
}
