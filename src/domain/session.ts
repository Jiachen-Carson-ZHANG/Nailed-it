import type { UserRole } from './nail';

export const defaultMockRole: UserRole = 'customer';

export type MockSession = {
  role: UserRole;
  homePath: string;
};

const mockSessionsByRole: Record<UserRole, MockSession> = {
  customer: {
    role: 'customer',
    homePath: '/customer/home'
  },
  merchant: {
    role: 'merchant',
    homePath: '/merchant/calendar'
  }
};

export const defaultMockSession: MockSession = mockSessionsByRole[defaultMockRole];

export function getMockSession(role: UserRole): MockSession {
  return mockSessionsByRole[role];
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
