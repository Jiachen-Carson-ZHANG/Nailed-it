import type { UserRole } from './nail';

export const defaultMockRole: UserRole = 'customer';

export function homePathForRole(role: UserRole): string {
  return role === 'customer' ? '/customer/home' : '/merchant/calendar';
}

export function isCustomerPath(pathname: string): boolean {
  return pathname.startsWith('/customer');
}

export function isMerchantPath(pathname: string): boolean {
  return pathname.startsWith('/merchant');
}
