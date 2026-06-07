import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { LanguageProvider } from '@/i18n/context';
import { resetRepositoriesForTests } from '@/lib/repositories';
import { createBookingAction } from '@/lib/actions/booking-actions';
import { mockAIResult } from '@/mock/ai';
import MerchantCalendarPage from './page';

vi.mock('next/navigation', () => ({
  usePathname: () => '/merchant/calendar',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn()
  })
}));

describe('MerchantCalendarPage', () => {
  async function renderPage() {
    render(
      <LanguageProvider initialLanguage="en" role="merchant">
        <MerchantCalendarPage />
      </LanguageProvider>
    );
    await act(async () => {
      await vi.runAllTimersAsync();
    });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-06T12:00:00Z'));
    // The calendar now reads bookings from the repository-backed booking service; reset the
    // in-memory bundle so each test starts from the derived demo seed (booking-001..004).
    resetRepositoriesForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the live current date button and month view by default', async () => {
    await renderPage();

    expect(
      screen.getByRole('heading', { name: /appointment calendar/i })
    ).toBeInTheDocument();

    expect(screen.getByRole('button', { name: '2026/06/06' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /month/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /day/i })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('region', { name: /june 2026 — spots left per day/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /sat, 6 jun/i })).not.toBeInTheDocument();
  });

  it('switches to the day view for the selected calendar date', async () => {
    await renderPage();

    fireEvent.change(screen.getByLabelText(/choose calendar date/i), {
      target: { value: '2026-05-24' }
    });
    fireEvent.click(screen.getByRole('button', { name: /24 may, \d+ spots left/i }));
    fireEvent.click(screen.getByRole('tab', { name: /day/i }));

    expect(
      screen.getByRole('heading', { name: /sun.*24 may.*\d+ spots left/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /11:00 · zoe wong/i })).toHaveAttribute(
      'href',
      '/merchant/booking/booking-003'
    );
    expect(screen.queryByRole('region', { name: /may 2026 — spots left per day/i })).not.toBeInTheDocument();
  });

  it('changes the visible month and day schedule when the date input changes', async () => {
    await renderPage();

    fireEvent.change(screen.getByLabelText(/choose calendar date/i), {
      target: { value: '2026-05-23' }
    });

    expect(screen.getByRole('button', { name: '2026/05/23' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /may 2026 — spots left per day/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /day/i }));

    expect(
      screen.getByRole('heading', { name: /sat.*23 may.*\d+ spots left/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /14:00 · melissa tan/i })).toHaveAttribute(
      'href',
      '/merchant/booking/booking-001'
    );
  });

  it('shows the empty state for a live date with no bookings', async () => {
    await renderPage();

    fireEvent.click(screen.getByRole('tab', { name: /day/i }));

    expect(
      screen.getByRole('heading', { name: /sat.*6 jun.*\d+ spots left/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/no bookings yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /·/i })).not.toBeInTheDocument();
  });

  it('shows a newly created booking once it is written through the booking service', async () => {
    // tech-anna is free on 2026-05-23 (her seed booking is on 05-24) and opens at 11:00; create-time
    // availability enforces working hours. Identity is server-derived to the demo customer (Melissa).
    await createBookingAction({
      technicianId: 'tech-anna',
      recognition: mockAIResult,
      styleTitle: 'Custom AI reference',
      styleImageUrl: '',
      date: '2026-05-23',
      time: '11:00',
      notes: 'from confirm flow'
    });

    await renderPage();

    fireEvent.change(screen.getByLabelText(/choose calendar date/i), {
      target: { value: '2026-05-23' }
    });
    fireEvent.click(screen.getByRole('button', { name: /23 may, \d+ spots left/i }));
    fireEvent.click(screen.getByRole('tab', { name: /day/i }));

    const schedule = screen.getByRole('region', { name: /schedule for 2026-05-23/i });
    expect(within(schedule).getByRole('link', { name: /11:00 · melissa tan/i })).toBeInTheDocument();
  });
});
