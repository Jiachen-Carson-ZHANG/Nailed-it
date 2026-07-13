import { describe, expect, it } from 'vitest';
import { createMemoryRepositoryBundle } from '../repositories';
import type { RepositoryBundle } from '../repositories/types';
import { createMemoryMerchantRepository } from '../repositories/memory/merchant-repository';
import { createMemoryTechnicianRepository } from '../repositories/memory/technician-repository';
import { createMemoryWorkingPlanRepository } from '../repositories/memory/scheduling-repository';
import { createAvailabilityService } from './availability-service';
import { createBookingService } from './booking-service';
import { createQuoteService } from './quote-service';
import { demoMerchantId } from '@/mock/merchants';
import type { Merchant } from '@/domain/merchant';
import type { Technician } from '@/domain/nail';
import type { Weekday, WorkingPlanDay } from '@/domain/scheduling';

const DATE = '2026-06-16'; // a Tuesday — all three seed technicians work
const WEEKDAY = new Date(Date.UTC(2026, 5, 16)).getUTCDay() as Weekday;

async function pickDurationItem(bundle: RepositoryBundle) {
  const catalog = await bundle.catalog.list();
  const item = catalog.find((c) => c.affectsBookingDuration === 'yes' && c.billable !== 'no');
  if (!item) throw new Error('fixture: no duration-bearing billable catalog item');
  return item;
}

async function priceItem(bundle: RepositoryBundle, merchantId: string, catalogItemId: string) {
  await bundle.merchantPricing.upsertMany([
    { merchantId, catalogItemId, priceCents: 5000, durationMin: 60, pricingUnit: 'fixed', enabled: true },
  ]);
}

describe('bookingService.createBooking', () => {
  it('creates a booking, then rejects an overlapping one for the same technician (gate 1)', async () => {
    const bundle = createMemoryRepositoryBundle();
    const item = await pickDurationItem(bundle);
    await priceItem(bundle, demoMerchantId, item.id);
    const svc = createBookingService(bundle);

    const created = await svc.createBooking({
      merchantId: demoMerchantId,
      technicianId: 'tech-anna', // no staff duration override, so duration is deterministic
      customerName: 'A',
      styleTitle: '',
      styleImageUrl: '',
      date: DATE,
      time: '15:00',
      selections: [{ catalogItemId: item.id, quantity: 1 }],
    });
    expect(created.id).toMatch(/^booking-/);
    expect(created.durationMin).toBe(60);
    expect(created.startAt).toBe(new Date(Date.parse('2026-06-16T15:00:00+08:00')).toISOString());

    await expect(
      svc.createBooking({
        merchantId: demoMerchantId,
        technicianId: 'tech-anna',
        customerName: 'B',
        styleTitle: '',
        styleImageUrl: '',
        date: DATE,
        time: '15:30',
        selections: [{ catalogItemId: item.id, quantity: 1 }],
      }),
    ).rejects.toThrow('booking_overlap');
  });

  it('cancelling a booking frees the interval for rebooking (gate 4)', async () => {
    const bundle = createMemoryRepositoryBundle();
    const item = await pickDurationItem(bundle);
    await priceItem(bundle, demoMerchantId, item.id);
    const svc = createBookingService(bundle);
    const args = {
      merchantId: demoMerchantId,
      technicianId: 'tech-anna',
      customerName: 'A',
      styleTitle: '',
      styleImageUrl: '',
      date: DATE,
      time: '16:00',
      selections: [{ catalogItemId: item.id, quantity: 1 }],
    };

    const first = await svc.createBooking(args);
    await expect(svc.createBooking({ ...args, customerName: 'B' })).rejects.toThrow('booking_overlap');
    await svc.cancel(first.id);
    const rebooked = await svc.createBooking({ ...args, customerName: 'C' });
    expect(rebooked.id).toMatch(/^booking-/);
  });

  it('createBookingFromSnapshot bridges a flat estimate into an interval booking', async () => {
    const bundle = createMemoryRepositoryBundle();
    const svc = createBookingService(bundle);
    const created = await svc.createBookingFromSnapshot({
      merchantId: demoMerchantId,
      technicianId: 'tech-anna',
      customerName: 'A',
      styleTitle: 'Custom AI reference',
      styleImageUrl: '',
      date: DATE,
      time: '15:00',
      estimate: { price: 88, duration: 75 },
    });
    expect(created.durationMin).toBe(75);
    const items = await bundle.intervalBookings.listItems(created.id);
    expect(items).toHaveLength(1);
    expect(items[0].catalogItemId).toBeNull();
    expect(items[0].priceCents).toBe(8800);

    // The snapshot path still enforces the overlap guarantee.
    await expect(
      svc.createBookingFromSnapshot({
        merchantId: demoMerchantId,
        technicianId: 'tech-anna',
        customerName: 'B',
        styleTitle: '',
        styleImageUrl: '',
        date: DATE,
        time: '15:30',
        estimate: { price: 88, duration: 75 },
      }),
    ).rejects.toThrow('booking_overlap');
  });

  it('createBookingWithThreadFromSelections prices catalog selections into relational items + a thread', async () => {
    const bundle = createMemoryRepositoryBundle();
    const item = await pickDurationItem(bundle);
    await priceItem(bundle, demoMerchantId, item.id);
    const svc = createBookingService(bundle);

    const created = await svc.createBookingWithThreadFromSelections(
      {
        merchantId: demoMerchantId,
        technicianId: 'tech-anna',
        customerName: 'A',
        styleTitle: 'Curated style',
        styleImageUrl: '',
        date: DATE,
        time: '15:00',
        selections: [{ catalogItemId: item.id, quantity: 1 }],
        status: 'pending_review',
      },
      (booking) => ({
        id: `conv-${booking.id}`,
        bookingId: booking.id,
        customerName: 'A',
        merchantName: 'Nailed-it Studio',
        relatedBookingTime: `${DATE} 15:00`,
        customerLanguage: 'zh-CN',
        messages: [],
      }),
    );

    expect(created.status).toBe('pending_review');
    const items = await bundle.intervalBookings.listItems(created.id);
    // Real catalog id + per-line price (not a null-id snapshot).
    expect(items).toHaveLength(1);
    expect(items[0].catalogItemId).toBe(item.id);
    expect(items[0].priceCents).toBe(5000);
    // The thread committed atomically alongside the booking.
    const thread = await bundle.conversations.getById(`conv-${created.id}`);
    expect(thread?.bookingId).toBe(created.id);
  });

  it('createBookingFromSnapshot rejects another merchant’s technician (tenant guard)', async () => {
    const bundle = createMemoryRepositoryBundle();
    const svc = createBookingService(bundle);
    await expect(
      svc.createBookingFromSnapshot({
        merchantId: demoMerchantId,
        technicianId: 'tech-not-here',
        customerName: 'A',
        styleTitle: '',
        styleImageUrl: '',
        date: DATE,
        time: '15:00',
        estimate: { price: 50, duration: 60 },
      }),
    ).rejects.toThrow('technician_not_in_merchant');
  });

  it('a merchant-required item with no price fails closed (gate 3)', async () => {
    const bundle = createMemoryRepositoryBundle();
    const catalog = await bundle.catalog.list();
    // A merchant-required item with NO platform default price is the genuinely-unresolved case
    // (items that now carry a default_price resolve via the catalog default instead).
    const required = catalog.find(
      (c) => c.merchantPriceRequired === 'yes' && c.billable !== 'no' && c.defaultPriceCents === null,
    );
    if (!required) throw new Error('fixture: no merchant-required catalog item without a default price');
    const svc = createBookingService(bundle);
    await expect(
      svc.createBooking({
        merchantId: demoMerchantId,
        technicianId: 'tech-mei',
        customerName: 'A',
        styleTitle: '',
        styleImageUrl: '',
        date: DATE,
        time: '15:00',
        selections: [{ catalogItemId: required.id, quantity: 1 }],
      }),
    ).rejects.toThrow('unresolved_pricing');
  });
});

describe('tenant isolation (gate 2)', () => {
  function tenantBundle(): RepositoryBundle {
    const merchants: Merchant[] = [
      { id: 'm-a', name: 'A', timezone: 'Asia/Singapore', currency: 'CNY' },
      { id: 'm-b', name: 'B', timezone: 'Asia/Singapore', currency: 'CNY' },
    ];
    const technicians: Technician[] = [
      { id: 't-a', merchantId: 'm-a', name: 'A1', initials: 'A1', title: '', active: true },
      { id: 't-b', merchantId: 'm-b', name: 'B1', initials: 'B1', title: '', active: true },
    ];
    const plans: WorkingPlanDay[] = [
      { technicianId: 't-a', weekday: WEEKDAY, openMin: 600, closeMin: 1140, breaks: [] },
      { technicianId: 't-b', weekday: WEEKDAY, openMin: 600, closeMin: 1140, breaks: [] },
    ];
    return {
      ...createMemoryRepositoryBundle(),
      merchants: createMemoryMerchantRepository(merchants),
      technicians: createMemoryTechnicianRepository(technicians),
      workingPlans: createMemoryWorkingPlanRepository(plans),
    };
  }

  it('availability never returns another merchant’s technician', async () => {
    const svc = createAvailabilityService(tenantBundle());
    const techs = await svc.findAvailable({ merchantId: 'm-a', date: DATE, time: '12:00', durationMin: 60 });
    expect(techs.map((t) => t.id)).toEqual(['t-a']);
  });

  it('booking another merchant’s technician is rejected', async () => {
    const svc = createBookingService(tenantBundle());
    await expect(
      svc.createBooking({
        merchantId: 'm-a',
        technicianId: 't-b',
        customerName: 'x',
        styleTitle: '',
        styleImageUrl: '',
        date: DATE,
        time: '12:00',
        selections: [],
      }),
    ).rejects.toThrow('technician_not_in_merchant');
  });
});

describe('quoteService', () => {
  // mockStaffItemDurations: tech-mei / basic_manicure_service = 45 (overrides the merchant default).
  const itemId = 'basic_manicure_service';

  it('multiplies price by quantity and prefers a per-staff duration override', async () => {
    const bundle = createMemoryRepositoryBundle();
    await bundle.merchantPricing.upsertMany([
      { merchantId: demoMerchantId, catalogItemId: itemId, priceCents: 5000, durationMin: 60, pricingUnit: 'fixed', enabled: true },
    ]);
    const quote = await createQuoteService(bundle).buildQuote({
      merchantId: demoMerchantId,
      technicianId: 'tech-mei',
      selections: [{ catalogItemId: itemId, quantity: 2 }],
    });
    const line = quote.lines.find((l) => l.catalogItemId === itemId);
    expect(line?.quantity).toBe(2);
    expect(line?.linePriceCents).toBe(10000); // 5000 × 2
    expect(line?.durationMin).toBe(45); // staff override beats merchant default 60
  });

  it('uses the merchant/catalog duration when no technician override applies', async () => {
    const bundle = createMemoryRepositoryBundle();
    await bundle.merchantPricing.upsertMany([
      { merchantId: demoMerchantId, catalogItemId: itemId, priceCents: 5000, durationMin: 60, pricingUnit: 'fixed', enabled: true },
    ]);
    const quote = await createQuoteService(bundle).buildQuote({
      merchantId: demoMerchantId,
      selections: [{ catalogItemId: itemId, quantity: 1 }],
    });
    expect(quote.lines[0]?.durationMin).toBe(60);
  });

  it('scales per_finger duration by quantity (5 painted nails take 5x one nail)', async () => {
    // gradient: per_finger, catalog default price 500, default duration 20, affects booking duration.
    const bundle = createMemoryRepositoryBundle();
    const quote = await createQuoteService(bundle).buildQuote({
      merchantId: demoMerchantId,
      selections: [{ catalogItemId: 'gradient', quantity: 3 }],
    });
    const line = quote.lines.find((l) => l.catalogItemId === 'gradient');
    expect(line?.linePriceCents).toBe(1500); // 500 × 3
    expect(line?.durationMin).toBe(60); // 20 × 3 — duration scales for per_finger
    expect(quote.totalDurationMin).toBe(60);
  });

  it('does NOT scale a per_set/fixed duration by quantity', async () => {
    const bundle = createMemoryRepositoryBundle();
    await bundle.merchantPricing.upsertMany([
      { merchantId: demoMerchantId, catalogItemId: itemId, priceCents: 5000, durationMin: 60, pricingUnit: 'fixed', enabled: true },
    ]);
    const quote = await createQuoteService(bundle).buildQuote({
      merchantId: demoMerchantId,
      selections: [{ catalogItemId: itemId, quantity: 3 }],
    });
    const line = quote.lines.find((l) => l.catalogItemId === itemId);
    expect(line?.linePriceCents).toBe(15000); // 5000 × 3
    expect(line?.durationMin).toBe(60); // fixed unit — duration counted once, NOT 180
  });

  it('forces a per-set selection to one before pricing', async () => {
    const bundle = createMemoryRepositoryBundle();
    const quote = await createQuoteService(bundle).buildQuote({
      merchantId: demoMerchantId,
      selections: [{ catalogItemId: 'cat_eye', quantity: 3 }],
    });
    const line = quote.lines.find((l) => l.catalogItemId === 'cat_eye');
    expect(line?.pricingUnit).toBe('per_set');
    expect(line?.quantity).toBe(1);
    expect(line?.linePriceCents).toBe(1000);
  });

  it('fails closed on invalid browser-supplied quantities', async () => {
    const bundle = createMemoryRepositoryBundle();
    const service = createQuoteService(bundle);

    await expect(
      service.buildQuote({
        merchantId: demoMerchantId,
        selections: [{ catalogItemId: itemId, quantity: -1 }],
      }),
    ).rejects.toThrow('invalid_quantity');

    await expect(
      service.buildQuote({
        merchantId: demoMerchantId,
        selections: [{ catalogItemId: itemId, quantity: Number.NaN }],
      }),
    ).rejects.toThrow('invalid_quantity');

    await expect(
      service.buildQuote({
        merchantId: demoMerchantId,
        selections: [{ catalogItemId: itemId, quantity: 101 }],
      }),
    ).rejects.toThrow('invalid_quantity');
  });
});
