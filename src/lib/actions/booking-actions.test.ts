import { beforeEach, describe, expect, it } from 'vitest';
import { getRepositories, resetRepositoriesForTests } from '@/lib/repositories';
import {
  createBookingFromSelectionsAction,
  createBookingFromStyleAction,
  listAvailableSlotsForSelectionsAction,
  listAvailableSlotsForStyleAction,
  quoteCatalogSelectionsAction,
} from './booking-actions';

const selections = [{ catalogItemId: 'basic_manicure_service', quantity: 1 }];

describe('catalog-backed booking actions', () => {
  beforeEach(() => {
    resetRepositoriesForTests();
  });

  it('uses the selected technician quote for both the offered slot and persisted booking', async () => {
    const days = await listAvailableSlotsForSelectionsAction(selections);
    const slot = days.flatMap((day) => day.slots).find((candidate) => candidate.technician.id === 'tech-mei');

    expect(slot).toBeDefined();
    expect(slot?.quote).toMatchObject({ price: 28, duration: 45 });

    const created = await createBookingFromSelectionsAction({
      selections,
      technicianId: slot!.technician.id,
      date: slot!.date,
      time: slot!.time,
      styleImageUrl: 'https://example.com/custom.png',
      notes: '',
    });

    expect(created.quote).toMatchObject({ price: 28, duration: 45 });
    const items = await getRepositories().intervalBookings.listItems(created.id);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      catalogItemId: 'basic_manicure_service',
      priceCents: 2800,
      durationMin: 45,
    });
  });

  it('quotes catalog selections server-side without accepting client totals', async () => {
    await expect(quoteCatalogSelectionsAction(selections)).resolves.toMatchObject({
      totalPriceCents: 2800,
    });
    await expect(
      quoteCatalogSelectionsAction([{ catalogItemId: 'basic_manicure_service', quantity: -4 }]),
    ).rejects.toThrow('invalid_quantity');
  });

  it('books an in-memory published style through its curated catalog breakdown', async () => {
    const days = await listAvailableSlotsForStyleAction('rose-cat-eye');
    const slot = days.flatMap((day) => day.slots).find((candidate) => candidate.technician.id === 'tech-mei');
    expect(slot?.quote).toMatchObject({ price: 28, duration: 45 });

    const created = await createBookingFromStyleAction({
      styleId: 'rose-cat-eye',
      technicianId: slot!.technician.id,
      date: slot!.date,
      time: slot!.time,
      notes: '',
    });
    expect(created.styleTitle).toBe('Rose Cat Eye Shine');
    expect(created.quote).toMatchObject({ price: 28, duration: 45 });
  });
});
