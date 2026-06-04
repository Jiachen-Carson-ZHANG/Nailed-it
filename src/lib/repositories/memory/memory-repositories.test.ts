import { describe, it, expect, beforeEach } from 'vitest';
import type { Booking, BookingConversationThread, BookingMessage, PricingItem } from '@/domain/nail';
import { mockBookings } from '@/mock/bookings';
import { seedConversationThreads } from '@/mock/conversations';
import { defaultPricingRules } from '@/mock/pricing';
import { mockTechnicians } from '@/mock/technicians';
import { styleDefinitions } from '@/mock/styles';
import { createMemoryBookingRepository } from './booking-repository';
import { createMemoryConversationRepository } from './conversation-repository';
import { createMemoryPricingRepository } from './pricing-repository';
import { createMemoryTechnicianRepository } from './technician-repository';
import { createMemoryStyleRepository } from './style-repository';

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
