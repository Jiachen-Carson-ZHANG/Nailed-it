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
    const required = catalog.find((c) => c.merchantPriceRequired === 'yes' && c.billable !== 'no');
    if (!required) throw new Error('fixture: no merchant-required catalog item');
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
      { id: 'm-a', name: 'A', timezone: 'Asia/Singapore', currency: 'SGD' },
      { id: 'm-b', name: 'B', timezone: 'Asia/Singapore', currency: 'SGD' },
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
});
