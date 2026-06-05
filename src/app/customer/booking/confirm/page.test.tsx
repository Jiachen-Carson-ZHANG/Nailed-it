import { StrictMode } from 'react';
import { act } from '@testing-library/react';
import { beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { clearCustomerBookingDraft, saveCustomerBookingDraft } from '@/domain/booking-draft';
import { mockAIResult } from '@/mock/ai';
import { resetOperationsStoreForTests } from '@/mock/operations-store';
import { resetRepositoriesForTests } from '@/lib/repositories';
import CustomerBookingConfirmPage from './page';

vi.mock('next/navigation', () => ({
  usePathname: () => '/customer/booking/confirm'
}));

describe('CustomerBookingConfirmPage', () => {
  beforeEach(() => {
    clearCustomerBookingDraft();
    resetOperationsStoreForTests();
    // The confirm write now goes through the repository-backed booking action; reset the
    // in-memory bundle so each test starts with no DB bookings (no cross-test overlap).
    resetRepositoriesForTests();
  });

  it('shows the empty state when no draft is available', () => {
    render(<CustomerBookingConfirmPage />);

    expect(screen.getByText(/no style selected yet/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /start booking/i })).toHaveAttribute(
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

    expect(screen.getByText(/your booking summary/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/edited note carried into confirmation/i)).toBeInTheDocument();
    expect(screen.getByText(/estimated: sgd 123 · 88 min/i)).toBeInTheDocument();
  });

  it('consumes the draft so a later fresh visit falls back to the empty state', async () => {
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
    expect(firstRender.getByText(/your booking summary/i)).toBeInTheDocument();

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    firstRender.unmount();

    render(<CustomerBookingConfirmPage />);
    expect(screen.getByText(/no style selected yet/i)).toBeInTheDocument();
  });

  it('still shows the draft on the first valid visit inside StrictMode', () => {
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

    render(
      <StrictMode>
        <CustomerBookingConfirmPage />
      </StrictMode>
    );

    expect(screen.getByText(/your booking summary/i)).toBeInTheDocument();
    expect(screen.getByText(/estimated: sgd 123 · 88 min/i)).toBeInTheDocument();
  });

  it('lets the customer pick a technician-backed slot and auto-confirms the appointment', async () => {
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

    expect(screen.getByRole('button', { name: /10:00 .* mei chen/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /10:00 .* mei chen/i }));
    expect(confirmButton).toBeEnabled();

    await user.click(confirmButton);

    expect(await screen.findByRole('status')).toHaveTextContent(/confirmed with mei chen/i);
    expect(confirmButton).toBeDisabled();
    expect(confirmButton).toHaveTextContent(/appointment confirmed/i);
    const messagesLink = screen.getByRole('link', { name: /open booking messages/i });
    expect(messagesLink.getAttribute('href')).toMatch(/^\/customer\/messages\/conv-booking-/);
  });

  it('keeps low confidence bookings in pending review before quote confirmation', async () => {
    const user = userEvent.setup();

    saveCustomerBookingDraft({
      estimate: {
        source: 'pricing_rules',
        price: 123,
        duration: 88
      },
      imageUrl: 'https://example.com/reference.png',
      recognition: {
        meta: {
          ...mockMeta(),
          confidence: 0.61
        },
        selection: mockSelection()
      }
    });

    render(<CustomerBookingConfirmPage />);

    await user.click(screen.getByRole('button', { name: /10:00 .* mei chen/i }));
    const confirmButton = screen.getByRole('button', { name: /confirm appointment/i });
    await user.click(confirmButton);

    expect(await screen.findByRole('status')).toHaveTextContent(/pending review with mei chen/i);
    expect(confirmButton).toBeDisabled();
    expect(confirmButton).toHaveTextContent(/pending review/i);
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
