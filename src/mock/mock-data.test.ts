import { describe, expect, it } from 'vitest';
import {
  getCustomerBookingConfirmPath,
  getCustomerBookingPath,
  getCustomerStylePath,
  getMerchantBookingPath,
  getMerchantManagePath,
  getMockSession,
  getRouteIntent
} from '@/domain/session';
import { defaultPricingRules } from './pricing';
import { availableSlots, mockBookings } from './bookings';
import { getStyleDefinitionById, getTrendingStyles } from './styles';

describe('mock data coherence', () => {
  it('does not expose already-booked times as available slots', () => {
    const occupiedKeys = new Set<string>();

    for (const booking of mockBookings) {
      occupiedKeys.add(`${booking.date}-${booking.time}-${booking.technician.id}`);
    }

    for (const day of availableSlots) {
      for (const slot of day.slots) {
        expect(occupiedKeys.has(`${day.date}-${slot.time}-${slot.technician.id}`)).toBe(false);
      }
    }
  });

  it('keeps bookings linked to the shared style source of truth', () => {
    const style = getStyleDefinitionById('rose-cat-eye');
    const booking = mockBookings.find((item) => item.id === 'booking-001');

    expect(style).toBeDefined();
    expect(booking).toBeDefined();
    expect(booking?.styleTitle).toBe(style?.title);
    expect(booking?.styleImageUrl).toBe(style?.imageUrl);
    expect(booking?.recognition).toEqual(style?.recognition);
  });

  it('keeps every booking tied to a technician snapshot', () => {
    expect(mockBookings.every((booking) => booking.technician.name.length > 0)).toBe(true);
  });

  it('uses explicit review status instead of generic pending for active bookings', () => {
    const statuses = new Set<string>(mockBookings.map((booking) => booking.status));

    expect(statuses.has('pending')).toBe(false);
  });

  it('recomputes preview quotes from the pricing rules provided at read time', () => {
    const defaultCard = getTrendingStyles().find((style) => style.id === 'rose-cat-eye');
    const updatedRules = defaultPricingRules.map((rule) =>
      rule.id === 'style-cat-eye' ? { ...rule, price: rule.price + 9 } : rule
    );
    const updatedCard = getTrendingStyles(updatedRules).find((style) => style.id === 'rose-cat-eye');

    expect(defaultCard).toBeDefined();
    expect(updatedCard).toBeDefined();
    expect(updatedCard?.previewQuote.price).toBe((defaultCard?.previewQuote.price ?? 0) + 9);
  });

  it('models route selection through a mock session object', () => {
    expect(getMockSession('customer')).toMatchObject({
      role: 'customer',
      brandHref: '/customer/home',
      homePath: '/customer/home'
    });
    expect(getMockSession('customer').tabs).toHaveLength(4);
    expect(getCustomerBookingPath()).toBe('/customer/booking');
    expect(getCustomerBookingConfirmPath()).toBe('/customer/booking/confirm');
    expect(getCustomerStylePath('rose-cat-eye')).toBe('/customer/style/rose-cat-eye');
    expect(getRouteIntent('customer', 'booking')).toMatchObject({
      key: 'booking',
      href: '/customer/booking',
      status: 'available'
    });
    expect(getRouteIntent('customer', 'messages')).toMatchObject({
      key: 'messages',
      href: '/customer/messages',
      status: 'available'
    });
    expect(getRouteIntent('customer', 'profile')).toMatchObject({
      key: 'profile',
      href: '/customer/profile',
      status: 'available'
    });
    expect(getMockSession('merchant')).toMatchObject({
      role: 'merchant',
      brandHref: '/merchant/calendar',
      homePath: '/merchant/calendar'
    });
    expect(getMerchantBookingPath('booking-001')).toBe('/merchant/booking/booking-001');
    expect(getMerchantManagePath()).toBe('/merchant/manage');
    // 5 merchant tabs since the Insights tab (📊 /merchant/insights) was added.
    expect(getMockSession('merchant').tabs).toHaveLength(5);
    expect(getRouteIntent('merchant', 'messages')).toMatchObject({
      key: 'messages',
      href: '/merchant/messages',
      status: 'available'
    });
    expect(getRouteIntent('merchant', 'profile')).toMatchObject({
      key: 'profile',
      href: '/merchant/profile',
      status: 'available'
    });
  });

  it('keeps discovery facets typed so UI tags do not mix concerns in one raw string list', () => {
    const style = getStyleDefinitionById('rose-cat-eye');

    expect(style).toBeDefined();
    expect(style?.discoveryFacets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'style', label: 'Cat eye' }),
        expect.objectContaining({ kind: 'addon', label: 'Rhinestone' }),
        expect.objectContaining({ kind: 'mood', label: 'Sweet' })
      ])
    );
  });
});
