import { describe, it, expect, beforeEach } from 'vitest';
import type { Booking, BookingConversationThread, BookingMessage, PricingItem } from '@/domain/nail';
import type { Merchant, MerchantPricing } from '@/domain/merchant';
import { mockBookings } from '@/mock/bookings';
import { seedConversationThreads } from '@/mock/conversations';
import { defaultPricingRules } from '@/mock/pricing';
import { mockTechnicians } from '@/mock/technicians';
import { styleDefinitions } from '@/mock/styles';
import { catalogItems } from '@/mock/catalog';
import { mockMerchants } from '@/mock/merchants';
import { createMemoryBookingRepository } from './booking-repository';
import { createMemoryConversationRepository } from './conversation-repository';
import { createMemoryPricingRepository } from './pricing-repository';
import { createMemoryTechnicianRepository } from './technician-repository';
import { createMemoryStyleRepository } from './style-repository';
import { createMemoryCatalogRepository } from './catalog-repository';
import { createMemoryMerchantRepository } from './merchant-repository';
import { createMemoryMerchantPricingRepository } from './merchant-pricing-repository';
import {
  createMemoryBlockedTimeRepository,
  createMemoryStaffItemDurationRepository,
  createMemoryWorkingPlanRepository,
} from './scheduling-repository';
import { createMemoryIntervalBookingRepository } from './interval-booking-repository';
import { mockBlockedTimes, mockWorkingPlans } from '@/mock/scheduling';
import {
  mockBookingItems,
  mockIntervalBookings,
  mockStaffItemDurations,
} from '@/mock/interval-bookings';
import type { IntervalBooking } from '@/domain/booking';

// ─── BookingRepository ────────────────────────────────────────────────────────

describe('createMemoryBookingRepository', () => {
  it('list() returns all seed bookings', async () => {
    const repo = createMemoryBookingRepository();
    const result = await repo.list();
    expect(result).toHaveLength(mockBookings.length);
    expect(result[0].id).toBe(mockBookings[0].id);
  });

  it('getById() returns booking when found', async () => {
    const repo = createMemoryBookingRepository();
    const booking = await repo.getById('booking-001');
    expect(booking).not.toBeNull();
    expect(booking?.id).toBe('booking-001');
  });

  it('getById() returns null when not found', async () => {
    const repo = createMemoryBookingRepository();
    const result = await repo.getById('nonexistent');
    expect(result).toBeNull();
  });

  it('insert() appends and returns the booking', async () => {
    const repo = createMemoryBookingRepository();
    const newBooking: Booking = {
      ...mockBookings[0],
      id: 'booking-new',
      customerName: 'Test Customer',
    };
    const inserted = await repo.insert(newBooking);
    expect(inserted.id).toBe('booking-new');

    const all = await repo.list();
    expect(all).toHaveLength(mockBookings.length + 1);
    expect(all.find((b) => b.id === 'booking-new')).toBeDefined();
  });

  it('updateStatus() changes status and returns updated booking', async () => {
    const repo = createMemoryBookingRepository();
    const updated = await repo.updateStatus('booking-001', 'confirmed');
    expect(updated).not.toBeNull();
    expect(updated?.status).toBe('confirmed');

    const fetched = await repo.getById('booking-001');
    expect(fetched?.status).toBe('confirmed');
  });

  it('updateStatus() returns null when id not found', async () => {
    const repo = createMemoryBookingRepository();
    const result = await repo.updateStatus('nonexistent', 'confirmed');
    expect(result).toBeNull();
  });

  it('list() mutation isolation: mutating returned object does not affect internal state', async () => {
    const repo = createMemoryBookingRepository();
    const [first] = await repo.list();
    first.customerName = 'MUTATED';
    const [refetched] = await repo.list();
    expect(refetched.customerName).not.toBe('MUTATED');
  });

  it('getById() mutation isolation: mutating returned object does not affect internal state', async () => {
    const repo = createMemoryBookingRepository();
    const booking = await repo.getById('booking-001');
    booking!.customerName = 'MUTATED';
    const refetched = await repo.getById('booking-001');
    expect(refetched?.customerName).not.toBe('MUTATED');
  });

  it('insert() mutation isolation: mutating input does not affect stored booking', async () => {
    const repo = createMemoryBookingRepository();
    const newBooking: Booking = { ...mockBookings[0], id: 'booking-iso' };
    await repo.insert(newBooking);
    newBooking.customerName = 'MUTATED';
    const stored = await repo.getById('booking-iso');
    expect(stored?.customerName).not.toBe('MUTATED');
  });
});

// ─── ConversationRepository ───────────────────────────────────────────────────

describe('createMemoryConversationRepository', () => {
  it('list() returns all seed threads', async () => {
    const repo = createMemoryConversationRepository();
    const result = await repo.list();
    expect(result).toHaveLength(seedConversationThreads.length);
    expect(result[0].id).toBe(seedConversationThreads[0].id);
  });

  it('getById() returns thread when found', async () => {
    const repo = createMemoryConversationRepository();
    const thread = await repo.getById('conv-melissa');
    expect(thread).not.toBeNull();
    expect(thread?.bookingId).toBe('booking-001');
  });

  it('getById() returns null when not found', async () => {
    const repo = createMemoryConversationRepository();
    const result = await repo.getById('nonexistent');
    expect(result).toBeNull();
  });

  it('insert() appends and returns the thread', async () => {
    const repo = createMemoryConversationRepository();
    const newThread: BookingConversationThread = {
      id: 'conv-new',
      bookingId: 'booking-001',
      customerName: 'Test',
      merchantName: 'Studio',
      relatedBookingTime: 'Today 10:00',
      messages: [],
    };
    const inserted = await repo.insert(newThread);
    expect(inserted.id).toBe('conv-new');

    const all = await repo.list();
    expect(all).toHaveLength(seedConversationThreads.length + 1);
  });

  it('appendMessage() appends message and returns updated thread', async () => {
    const repo = createMemoryConversationRepository();
    const message: BookingMessage = {
      id: 'msg-new',
      authorRole: 'customer',
      body: 'Hello!',
      sentAt: '14:00',
    };
    const updated = await repo.appendMessage('conv-melissa', message);
    expect(updated).not.toBeNull();
    expect(updated?.messages).toHaveLength(2);
    expect(updated?.messages[1].id).toBe('msg-new');
  });

  it('appendMessage() returns null when threadId not found', async () => {
    const repo = createMemoryConversationRepository();
    const message: BookingMessage = {
      id: 'msg-x',
      authorRole: 'customer',
      body: 'Hi',
      sentAt: '10:00',
    };
    const result = await repo.appendMessage('nonexistent', message);
    expect(result).toBeNull();
  });

  it('list() mutation isolation: mutating returned object does not affect internal state', async () => {
    const repo = createMemoryConversationRepository();
    const [first] = await repo.list();
    first.customerName = 'MUTATED';
    const [refetched] = await repo.list();
    expect(refetched.customerName).not.toBe('MUTATED');
  });
});

// ─── PricingRepository ────────────────────────────────────────────────────────

describe('createMemoryPricingRepository', () => {
  it('list() returns all seed pricing rules', async () => {
    const repo = createMemoryPricingRepository();
    const result = await repo.list();
    expect(result).toHaveLength(defaultPricingRules.length);
    expect(result[0].id).toBe(defaultPricingRules[0].id);
  });

  it('replaceAll() swaps contents and returns new rules', async () => {
    const repo = createMemoryPricingRepository();
    const newRules: PricingItem[] = [
      { id: 'base-removal', category: 'base', target: 'removal', price: 99, duration: 10, enabled: true },
    ];
    const replaced = await repo.replaceAll(newRules);
    expect(replaced).toHaveLength(1);
    expect(replaced[0].price).toBe(99);

    const listed = await repo.list();
    expect(listed).toHaveLength(1);
    expect(listed[0].price).toBe(99);
  });

  it('replaceAll() mutation isolation: mutating input does not affect stored rules', async () => {
    const repo = createMemoryPricingRepository();
    const newRules: PricingItem[] = [
      { id: 'base-removal', category: 'base', target: 'removal', price: 50, duration: 10, enabled: true },
    ];
    await repo.replaceAll(newRules);
    newRules[0].price = 999;
    const listed = await repo.list();
    expect(listed[0].price).toBe(50);
  });
});

// ─── TechnicianRepository ─────────────────────────────────────────────────────

describe('createMemoryTechnicianRepository', () => {
  it('list() returns all seed technicians', async () => {
    const repo = createMemoryTechnicianRepository();
    const result = await repo.list();
    expect(result).toHaveLength(mockTechnicians.length);
    expect(result[0].id).toBe(mockTechnicians[0].id);
  });

  it('list() mutation isolation: mutating returned object does not affect internal state', async () => {
    const repo = createMemoryTechnicianRepository();
    const [first] = await repo.list();
    first.name = 'MUTATED';
    const [refetched] = await repo.list();
    expect(refetched.name).not.toBe('MUTATED');
  });
});

// ─── StyleRepository ──────────────────────────────────────────────────────────

describe('createMemoryStyleRepository', () => {
  it('list() returns all seed styles', async () => {
    const repo = createMemoryStyleRepository();
    const result = await repo.list();
    expect(result).toHaveLength(styleDefinitions.length);
    expect(result[0].id).toBe(styleDefinitions[0].id);
  });

  it('getById() returns style when found', async () => {
    const repo = createMemoryStyleRepository();
    const style = await repo.getById('rose-cat-eye');
    expect(style).not.toBeNull();
    expect(style?.title).toBe('Rose Cat Eye Shine');
  });

  it('getById() returns null when not found', async () => {
    const repo = createMemoryStyleRepository();
    const result = await repo.getById('nonexistent');
    expect(result).toBeNull();
  });

  it('list() mutation isolation: mutating returned object does not affect internal state', async () => {
    const repo = createMemoryStyleRepository();
    const [first] = await repo.list();
    first.title = 'MUTATED';
    const [refetched] = await repo.list();
    expect(refetched.title).not.toBe('MUTATED');
  });
});

// ─── CatalogRepository ───────────────────────────────────────────────────────

describe('catalog repository', () => {
  it('list() returns 112 items', async () => {
    const repo = createMemoryCatalogRepository();
    const result = await repo.list();
    expect(result).toHaveLength(112);
  });

  it('getById() returns item when found', async () => {
    const repo = createMemoryCatalogRepository();
    const item = await repo.getById('basic_manicure_service');
    expect(item).not.toBeNull();
    expect(item?.id).toBe('basic_manicure_service');
  });

  it('getById() returns null when not found', async () => {
    const repo = createMemoryCatalogRepository();
    const result = await repo.getById('nope');
    expect(result).toBeNull();
  });

  it('listByType() returns 41 billable_component items', async () => {
    const repo = createMemoryCatalogRepository();
    const result = await repo.listByType('billable_component');
    expect(result).toHaveLength(41);
    expect(result.every((item) => item.type === 'billable_component')).toBe(true);
  });

  it('mutation isolation: mutating a returned item does not affect internal state', async () => {
    const repo = createMemoryCatalogRepository();
    const [first] = await repo.list();
    const originalName = first.nameZh;
    first.nameZh = 'MUTATED';
    const [refetched] = await repo.list();
    expect(refetched.nameZh).toBe(originalName);
  });
});

// ─── MerchantRepository + MerchantPricingRepository ──────────────────────────

describe('merchant + merchant_pricing', () => {
  it('merchant list() returns all seed merchants', async () => {
    const repo = createMemoryMerchantRepository();
    const result = await repo.list();
    expect(result).toHaveLength(mockMerchants.length);
    expect(result[0].id).toBe(mockMerchants[0].id);
  });

  it('merchant getById() returns merchant when found', async () => {
    const repo = createMemoryMerchantRepository();
    const found = await repo.getById('merchant-nailed-it');
    expect(found).not.toBeNull();
    expect(found?.name).toBe('Nailed-it Studio');
  });

  it('merchant getById() returns null when not found', async () => {
    const repo = createMemoryMerchantRepository();
    const result = await repo.getById('nonexistent-merchant');
    expect(result).toBeNull();
  });

  it('merchant list() mutation isolation', async () => {
    const repo = createMemoryMerchantRepository();
    const [first] = await repo.list();
    first.name = 'MUTATED';
    const [refetched] = await repo.list();
    expect(refetched.name).not.toBe('MUTATED');
  });

  it('merchantPricing listByMerchant() filters by merchantId', async () => {
    const seed: MerchantPricing[] = [
      { merchantId: 'merchant-a', catalogItemId: 'item-1', priceCents: 100, durationMin: 30, pricingUnit: 'fixed', enabled: true },
      { merchantId: 'merchant-b', catalogItemId: 'item-2', priceCents: 200, durationMin: 45, pricingUnit: 'per_set', enabled: true },
    ];
    const repo = createMemoryMerchantPricingRepository(seed);
    const resultA = await repo.listByMerchant('merchant-a');
    expect(resultA).toHaveLength(1);
    expect(resultA[0].catalogItemId).toBe('item-1');

    const resultB = await repo.listByMerchant('merchant-b');
    expect(resultB).toHaveLength(1);
    expect(resultB[0].catalogItemId).toBe('item-2');
  });

  it('merchantPricing upsertMany() inserts new rows', async () => {
    const repo = createMemoryMerchantPricingRepository();
    const rows: MerchantPricing[] = [
      { merchantId: 'merchant-1', catalogItemId: 'cat-a', priceCents: 500, durationMin: 20, pricingUnit: 'fixed', enabled: true },
    ];
    const returned = await repo.upsertMany(rows);
    expect(returned).toHaveLength(1);
    expect(returned[0].priceCents).toBe(500);

    const listed = await repo.listByMerchant('merchant-1');
    expect(listed).toHaveLength(1);
  });

  it('merchantPricing upsertMany() updates same composite key, length stays same', async () => {
    const repo = createMemoryMerchantPricingRepository();
    const row: MerchantPricing = { merchantId: 'merchant-1', catalogItemId: 'cat-a', priceCents: 500, durationMin: 20, pricingUnit: 'fixed', enabled: true };
    await repo.upsertMany([row]);
    await repo.upsertMany([{ ...row, priceCents: 999 }]);

    const listed = await repo.listByMerchant('merchant-1');
    expect(listed).toHaveLength(1);
    expect(listed[0].priceCents).toBe(999);
  });

  it('merchantPricing mutation isolation: mutating returned row does not affect state', async () => {
    const seed: MerchantPricing[] = [
      { merchantId: 'merchant-1', catalogItemId: 'cat-a', priceCents: 300, durationMin: null, pricingUnit: 'per_finger', enabled: true },
    ];
    const repo = createMemoryMerchantPricingRepository(seed);
    const [row] = await repo.listByMerchant('merchant-1');
    row.priceCents = 9999;
    const [refetched] = await repo.listByMerchant('merchant-1');
    expect(refetched.priceCents).toBe(300);
  });
});

// ─── WorkingPlanRepository + BlockedTimeRepository ───────────────────────────

describe('working_plan + blocked_time', () => {
  it('workingPlans list() returns all seed plans', async () => {
    const repo = createMemoryWorkingPlanRepository();
    const result = await repo.list();
    expect(result).toHaveLength(mockWorkingPlans.length);
  });

  it('workingPlans listByTechnician() filters by technician', async () => {
    const repo = createMemoryWorkingPlanRepository();
    const mei = await repo.listByTechnician('tech-mei');
    expect(mei.length).toBeGreaterThan(0);
    expect(mei.every((p) => p.technicianId === 'tech-mei')).toBe(true);
  });

  it('workingPlans mutation isolation', async () => {
    const repo = createMemoryWorkingPlanRepository();
    const [first] = await repo.list();
    first.openMin = -999;
    const [refetched] = await repo.list();
    expect(refetched.openMin).not.toBe(-999);
  });

  it('blockedTimes list() returns all seed blocks', async () => {
    const repo = createMemoryBlockedTimeRepository();
    const result = await repo.list();
    expect(result).toHaveLength(mockBlockedTimes.length);
  });

  it('blockedTimes listByTechnician() filters by technician', async () => {
    const repo = createMemoryBlockedTimeRepository();
    const mei = await repo.listByTechnician('tech-mei');
    expect(mei.every((b) => b.technicianId === 'tech-mei')).toBe(true);
  });

  it('blockedTimes mutation isolation', async () => {
    const repo = createMemoryBlockedTimeRepository();
    const [first] = await repo.list();
    if (first) {
      first.reason = 'MUTATED';
      const [refetched] = await repo.list();
      expect(refetched.reason).not.toBe('MUTATED');
    }
  });

  it('blockedTimes listByTechnicianInRange returns only overlapping blocks', async () => {
    const repo = createMemoryBlockedTimeRepository();
    // Mei is blocked 2026-06-08 15:00–17:00 (+08:00).
    const overlapping = await repo.listByTechnicianInRange(
      'tech-mei',
      '2026-06-08T16:00:00+08:00',
      '2026-06-08T18:00:00+08:00',
    );
    expect(overlapping.map((b) => b.id)).toContain('block-mei-training');
    const disjoint = await repo.listByTechnicianInRange(
      'tech-mei',
      '2026-06-08T18:00:00+08:00',
      '2026-06-08T19:00:00+08:00',
    );
    expect(disjoint).toEqual([]);
  });
});

// ─── StaffItemDurationRepository ─────────────────────────────────────────────

describe('staff_item_duration', () => {
  it('list() returns all seed rows for a technician', async () => {
    const repo = createMemoryStaffItemDurationRepository();
    const mei = await repo.listByTechnician('tech-mei');
    expect(mei.length).toBeGreaterThan(0);
    expect(mei.every((s) => s.technicianId === 'tech-mei')).toBe(true);
  });

  it('seed matches mock length per technician', async () => {
    const repo = createMemoryStaffItemDurationRepository();
    const lina = await repo.listByTechnician('tech-lina');
    expect(lina).toHaveLength(
      mockStaffItemDurations.filter((s) => s.technicianId === 'tech-lina').length,
    );
  });
});

// ─── IntervalBookingRepository ───────────────────────────────────────────────

describe('interval booking', () => {
  function bookingAt(
    overrides: Partial<IntervalBooking> & { id: string; technicianId: string; startAt: string; endAt: string },
  ): IntervalBooking {
    return {
      merchantId: 'merchant-nailed-it',
      customerName: 'Test',
      styleTitle: '',
      styleImageUrl: '',
      durationMin: 60,
      status: 'confirmed',
      notes: '',
      ...overrides,
    };
  }

  it('getById returns a seeded booking', async () => {
    const repo = createMemoryIntervalBookingRepository();
    const b = await repo.getById('booking-int-001');
    expect(b?.technicianId).toBe('tech-lina');
  });

  it('listByTechnicianInRange returns overlapping non-cancelled bookings', async () => {
    const repo = createMemoryIntervalBookingRepository();
    const hits = await repo.listByTechnicianInRange(
      'tech-lina',
      '2026-06-09T11:00:00+08:00',
      '2026-06-09T12:00:00+08:00',
    );
    expect(hits.map((b) => b.id)).toContain('booking-int-001');
  });

  it('listItems returns the items for a booking', async () => {
    const repo = createMemoryIntervalBookingRepository();
    const items = await repo.listItems('booking-int-001');
    expect(items.map((i) => i.id)).toContain('bitem-001');
  });

  it('create inserts when there is no conflict', async () => {
    const repo = createMemoryIntervalBookingRepository([], []);
    const created = await repo.create(
      bookingAt({ id: 'b1', technicianId: 'tech-mei', startAt: '2026-06-09T10:00:00+08:00', endAt: '2026-06-09T11:00:00+08:00' }),
      [],
    );
    expect(created.id).toBe('b1');
  });

  it('create throws booking_overlap for an overlapping same-technician interval', async () => {
    const repo = createMemoryIntervalBookingRepository([], []);
    await repo.create(
      bookingAt({ id: 'b1', technicianId: 'tech-mei', startAt: '2026-06-09T10:00:00+08:00', endAt: '2026-06-09T11:00:00+08:00' }),
      [],
    );
    await expect(
      repo.create(
        bookingAt({ id: 'b2', technicianId: 'tech-mei', startAt: '2026-06-09T10:30:00+08:00', endAt: '2026-06-09T11:30:00+08:00' }),
        [],
      ),
    ).rejects.toThrow('booking_overlap');
  });

  it('create allows the same interval for a different technician', async () => {
    const repo = createMemoryIntervalBookingRepository([], []);
    await repo.create(
      bookingAt({ id: 'b1', technicianId: 'tech-mei', startAt: '2026-06-09T10:00:00+08:00', endAt: '2026-06-09T11:00:00+08:00' }),
      [],
    );
    const other = await repo.create(
      bookingAt({ id: 'b2', technicianId: 'tech-lina', startAt: '2026-06-09T10:00:00+08:00', endAt: '2026-06-09T11:00:00+08:00' }),
      [],
    );
    expect(other.id).toBe('b2');
  });

  it('cancelling a booking releases the interval for rebooking', async () => {
    const repo = createMemoryIntervalBookingRepository([], []);
    await repo.create(
      bookingAt({ id: 'b1', technicianId: 'tech-mei', startAt: '2026-06-09T10:00:00+08:00', endAt: '2026-06-09T11:00:00+08:00' }),
      [],
    );
    await repo.setStatus('b1', 'cancelled');
    const released = await repo.listByTechnicianInRange(
      'tech-mei',
      '2026-06-09T10:00:00+08:00',
      '2026-06-09T11:00:00+08:00',
    );
    expect(released).toEqual([]);
    const rebooked = await repo.create(
      bookingAt({ id: 'b2', technicianId: 'tech-mei', startAt: '2026-06-09T10:00:00+08:00', endAt: '2026-06-09T11:00:00+08:00' }),
      [],
    );
    expect(rebooked.id).toBe('b2');
  });

  it('mutation isolation: mutating a returned booking does not affect state', async () => {
    const repo = createMemoryIntervalBookingRepository();
    const b = await repo.getById('booking-int-001');
    b!.customerName = 'MUTATED';
    const refetched = await repo.getById('booking-int-001');
    expect(refetched?.customerName).not.toBe('MUTATED');
  });

  it('create rejects an inverted interval (mirrors the DB end_at>start_at CHECK)', async () => {
    const repo = createMemoryIntervalBookingRepository([], []);
    await expect(
      repo.create(
        bookingAt({ id: 'bad', technicianId: 'tech-mei', startAt: '2026-06-09T11:00:00+08:00', endAt: '2026-06-09T10:00:00+08:00' }),
        [],
      ),
    ).rejects.toThrow('invalid_interval');
  });

  it('create rejects a zero-length interval', async () => {
    const repo = createMemoryIntervalBookingRepository([], []);
    await expect(
      repo.create(
        bookingAt({ id: 'zero', technicianId: 'tech-mei', startAt: '2026-06-09T10:00:00+08:00', endAt: '2026-06-09T10:00:00+08:00' }),
        [],
      ),
    ).rejects.toThrow('invalid_interval');
  });
});

// ─── getRepositories / resetRepositoriesForTests ──────────────────────────────

describe('getRepositories singleton and resetRepositoriesForTests', () => {
  it('resetRepositoriesForTests causes next call to rebuild from fresh seeds', async () => {
    const { getRepositories, resetRepositoriesForTests } = await import('../index');

    resetRepositoriesForTests();
    const bundle1 = getRepositories();
    await bundle1.bookings.updateStatus('booking-001', 'cancelled');

    resetRepositoriesForTests();
    const bundle2 = getRepositories();
    const booking = await bundle2.bookings.getById('booking-001');
    expect(booking?.status).toBe('pending_review');
  });
});
