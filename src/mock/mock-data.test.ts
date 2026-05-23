import { describe, expect, it } from 'vitest';
import {
  getCustomerBookingConfirmPath,
  getCustomerBookingPath,
  getCustomerStylePath,
  getMockSession,
  getRouteIntent
} from '@/domain/session';
import { defaultPricingRules } from './pricing';
import { availableSlots, mockBookings } from './bookings';
import { getStyleDefinitionById, getTrendingStyles } from './styles';

describe('mock data coherence', () => {
  it('does not expose already-booked times as available slots', () => {
    const occupiedTimesByDate = new Map<string, Set<string>>();

    for (const booking of mockBookings) {
      const occupiedTimes = occupiedTimesByDate.get(booking.date) ?? new Set<string>();
      occupiedTimes.add(booking.time);
      occupiedTimesByDate.set(booking.date, occupiedTimes);
    }

    for (const day of availableSlots) {
      for (const slot of day.slots) {
        expect(occupiedTimesByDate.get(day.date)?.has(slot) ?? false).toBe(false);
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
    expect(getMockSession('customer').tabs).toHaveLength(2);
    expect(getCustomerBookingPath()).toBe('/customer/booking');
    expect(getCustomerBookingConfirmPath()).toBe('/customer/booking/confirm');
    expect(getCustomerStylePath('rose-cat-eye')).toBe('/customer/style/rose-cat-eye');
    expect(getRouteIntent('customer', 'booking')).toMatchObject({
      key: 'booking',
      href: '/customer/booking',
      status: 'available'
    });
    expect(getMockSession('merchant')).toMatchObject({
      role: 'merchant',
      brandHref: '/merchant/calendar',
      homePath: '/merchant/calendar'
    });
    expect(getMockSession('merchant').tabs).toHaveLength(1);
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
