import { beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { clearCustomerBookingDraft, saveCustomerBookingDraft } from '@/domain/booking-draft';
import { mockAIResult } from '@/mock/ai';
import CustomerBookingConfirmPage from './page';

vi.mock('next/navigation', () => ({
  usePathname: () => '/customer/booking/confirm'
}));

describe('CustomerBookingConfirmPage', () => {
  beforeEach(() => {
    clearCustomerBookingDraft();
  });

  it('shows the empty state when no draft is available', () => {
    render(<CustomerBookingConfirmPage />);

    expect(screen.getByText(/no active booking draft/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to booking/i })).toHaveAttribute(
      'href',
      '/customer/booking'
    );
  });

  it('renders the current booking draft summary instead of reconstructing from mock ai defaults', () => {
    saveCustomerBookingDraft({
      estimate: {
        source: 'pricing_rules',
        price: 123,
        duration: 88
      },
      imageUrl: 'https://example.com/reference.png',
      recognition: {
        meta: mockMeta(),
        selection: {
          ...mockSelection(),
          otherNotes: 'Edited note carried into confirmation.'
        }
      }
    });

    render(<CustomerBookingConfirmPage />);

    expect(screen.getByText(/current ai booking draft/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/edited note carried into confirmation/i)).toBeInTheDocument();
    expect(screen.getByText(/estimated: sgd 123 · 88 min/i)).toBeInTheDocument();
  });

  it('consumes the draft so a later fresh visit falls back to the empty state', () => {
    saveCustomerBookingDraft({
      estimate: {
        source: 'pricing_rules',
        price: 123,
        duration: 88
      },
      imageUrl: 'https://example.com/reference.png',
      recognition: {
        meta: mockMeta(),
        selection: mockSelection()
      }
    });

    const firstRender = render(<CustomerBookingConfirmPage />);
    expect(firstRender.getByText(/current ai booking draft/i)).toBeInTheDocument();

    firstRender.unmount();

    render(<CustomerBookingConfirmPage />);
    expect(screen.getByText(/no active booking draft/i)).toBeInTheDocument();
  });

  it('lets the customer pick a slot and confirm the appointment with a toast', async () => {
    const user = userEvent.setup();

    saveCustomerBookingDraft({
      estimate: {
        source: 'pricing_rules',
        price: 123,
        duration: 88
      },
      imageUrl: 'https://example.com/reference.png',
      recognition: {
        meta: mockMeta(),
        selection: mockSelection()
      }
    });

    render(<CustomerBookingConfirmPage />);

    const confirmButton = screen.getByRole('button', { name: /confirm appointment/i });
    expect(confirmButton).toBeDisabled();

    await user.click(screen.getByRole('button', { name: '10:00' }));
    expect(confirmButton).toBeEnabled();

    await user.click(confirmButton);

    expect(screen.getByRole('status')).toHaveTextContent(/booking request sent to merchant for today at 10:00/i);
  });
});

function mockMeta() {
  return {
    ...mockAIResult.meta
  };
}

function mockSelection() {
  return {
    ...mockAIResult.selection
  };
}
