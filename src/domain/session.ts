import type { UserRole } from './nail';

export const defaultMockRole: UserRole = 'customer';
export type MockRouteIntentKey = 'booking' | 'messages' | 'profile';
export type MockRouteIntentStatus = 'available' | 'planned';

export type ShellTab = {
  glyph: string;
  href: string;
  label: string;
  matchPrefix?: string;
  forceRemount?: boolean;
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
  booking: '/customer/booking',
  bookingConfirm: '/customer/booking/confirm',
  messages: '/customer/messages',
  profile: '/customer/profile',
  styleDetail: (id: string) => `/customer/style/${id}`,
  messageDetail: (conversationId: string) => `/customer/messages/${conversationId}`,
  tryOn: (styleId?: string) => styleId ? `/customer/try-on?styleId=${styleId}` : '/customer/try-on'
};

const merchantPaths = {
  home: '/merchant/calendar',
  bookingDetail: (id: string) => `/merchant/booking/${id}`,
  manage: '/merchant/manage',
  insights: '/merchant/insights',
  opsBot: '/merchant/messages/ops',
  messages: '/merchant/messages',
  profile: '/merchant/profile',
  styles: '/merchant/styles',
  messageDetail: (conversationId: string) => `/merchant/messages/${conversationId}`,
  styleDetail: (id: string) => `/merchant/styles/${id}/review`,
  agents: '/merchant/agents',
  agentRun: (id: string) => `/merchant/agents/runs/${id}`
};

const mockSessionTemplatesByRole: Record<UserRole, MockSessionTemplate> = {
  customer: {
    role: 'customer',
    brandHref: customerPaths.home,
    homePath: customerPaths.home,
    routeIntents: {
      booking: {
        key: 'booking',
        label: 'Book this look',
        href: customerPaths.booking,
        note: 'Upload your photo to get an instant quote, then pick your time.',
        status: 'available'
      },
      messages: {
        key: 'messages',
        label: 'Messages',
        href: customerPaths.messages,
        note: 'Customer messages expose booking-linked threads from the shared conversation snapshots.',
        status: 'available'
      },
      profile: {
        key: 'profile',
        label: 'Profile',
        href: customerPaths.profile,
        note: 'Customer profile summarizes active bookings and recent history from the shared mock booking source.',
        status: 'available'
      }
    },
    tabs: [
      { href: customerPaths.home, label: 'Home', glyph: '⌂', available: true },
      {
        href: customerPaths.booking,
        label: 'Book',
        glyph: '✦',
        matchPrefix: customerPaths.booking,
        forceRemount: true,
        available: true
      },
      {
        href: customerPaths.messages,
        label: 'Messages',
        glyph: '✉',
        matchPrefix: customerPaths.messages,
        available: true
      },
      {
        href: customerPaths.profile,
        label: 'Me',
        glyph: '◉',
        matchPrefix: customerPaths.profile,
        available: true
      }
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
        href: merchantPaths.messages,
        note: 'Merchant messages stay tied to customer threads and nearby appointment context.',
        status: 'available'
      },
      profile: {
        key: 'profile',
        label: 'Profile',
        href: merchantPaths.profile,
        note: 'Merchant profile summarizes workload, unread demand, and shortcuts to operational controls.',
        status: 'available'
      }
    },
    tabs: [
      { href: merchantPaths.home, label: 'Calendar', glyph: '◫', available: true },
      {
        href: merchantPaths.manage,
        label: 'Manage',
        glyph: '⚙',
        matchPrefix: merchantPaths.manage,
        available: true
      },
      {
        href: merchantPaths.messages,
        label: 'Messages',
        glyph: '✉',
        matchPrefix: merchantPaths.messages,
        available: true
      },
      {
        href: merchantPaths.profile,
        label: 'Me',
        glyph: '◉',
        matchPrefix: merchantPaths.profile,
        available: true
      }
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

export function getCustomerBookingPath(): string {
  return customerPaths.booking;
}

export function getCustomerBookingConfirmPath(): string {
  return customerPaths.bookingConfirm;
}

export function getCustomerMessagesPath(conversationId?: string): string {
  return conversationId ? customerPaths.messageDetail(conversationId) : customerPaths.messages;
}

export function getCustomerProfilePath(): string {
  return customerPaths.profile;
}

/** Deep-link to the customer's profile with one booking pre-opened (no standalone detail route). */
export function getCustomerBookingDetailPath(bookingId: string): string {
  return `${customerPaths.profile}?booking=${encodeURIComponent(bookingId)}`;
}

export function getMerchantBookingPath(id: string): string {
  return merchantPaths.bookingDetail(id);
}

export function getMerchantManagePath(): string {
  return merchantPaths.manage;
}

export function getMerchantInsightsPath(): string {
  return merchantPaths.insights;
}

export function getMerchantOpsBotPath(): string {
  return merchantPaths.opsBot;
}

export function getMerchantMessagesPath(conversationId?: string): string {
  return conversationId ? merchantPaths.messageDetail(conversationId) : merchantPaths.messages;
}

export function getMerchantProfilePath(): string {
  return merchantPaths.profile;
}

/** The merchant's style library (upload + review). Where an approved 上架-new proposal routes the
 *  merchant to supply the image and complete the listing (ADR-0007 §4 gate). */
export function getMerchantStylesPath(): string {
  return merchantPaths.styles;
}

/** The merchant's own view of a published style (the library review/editor page for that style). */
export function getMerchantStylePath(id: string): string {
  return merchantPaths.styleDetail(id);
}

/** The agent-team panel (ADR-0007) + per-run thinking-chain view. */
export function getMerchantAgentsPath(): string {
  return merchantPaths.agents;
}

export function getMerchantAgentRunPath(id: string): string {
  return merchantPaths.agentRun(id);
}

export function getCustomerTryOnPath(styleId?: string): string {
  return customerPaths.tryOn(styleId);
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
