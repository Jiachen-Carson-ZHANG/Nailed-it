import { act, fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { getCustomerBookingDraft } from '@/domain/booking-draft';
import CustomerBookingPage from './page';

vi.mock('next/navigation', () => ({
  usePathname: () => '/customer/booking'
}));

describe('CustomerBookingPage', () => {
  it('runs the mock recognition flow and shows a live estimate with a confirm CTA', async () => {
    vi.useFakeTimers();

    render(<CustomerBookingPage />);

    const recognizeButton = screen.getByRole('button', { name: /smart recognition/i });
    expect(recognizeButton).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /upload or take photo/i }));
    expect(screen.getByRole('button', { name: /smart recognition/i })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: /smart recognition/i }));
    expect(screen.getByText(/ai is recognizing the style/i)).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(700);
    });

    expect(screen.getByRole('dialog', { name: /ai recognition result/i })).toBeInTheDocument();
    expect(screen.getByText(/live estimate/i)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Edited note carried into confirmation.' }
    });

    const nextLink = screen.getByRole('link', { name: /next: choose time/i });
    expect(nextLink).toHaveAttribute('href', '/customer/booking/confirm');

    fireEvent.click(nextLink);

    expect(getCustomerBookingDraft()).toMatchObject({
      recognition: {
        selection: {
          otherNotes: 'Edited note carried into confirmation.'
        }
      }
    });

    vi.useRealTimers();
  });
});
