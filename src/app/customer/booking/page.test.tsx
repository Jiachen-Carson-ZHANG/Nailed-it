import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { getCustomerBookingDraft } from '@/domain/booking-draft';
import { CustomerBookingContent } from './booking-content';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/customer/booking',
  useSearchParams: () => new URLSearchParams(),
}));

describe('CustomerBookingPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('walks through the two-step booking flow and persists the draft', async () => {
    render(<CustomerBookingContent />);

    // Step 1: Upload — the Analyze CTA only appears once a reference image exists.
    expect(screen.queryByRole('button', { name: /analyze my photo/i })).not.toBeInTheDocument();

    const file = new File(['fake image bytes'], 'ref.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText(/choose nail reference photo/i), { target: { files: [file] } });

    await waitFor(() => expect(screen.getByRole('button', { name: /analyze my photo/i })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /analyze my photo/i }));

    // Step 2: Result — style detected, Book time link present
    await screen.findByRole('heading', { name: /style detected/i });

    const bookLink = screen.getByRole('link', { name: /book time/i });
    expect(bookLink).toHaveAttribute('href', '/customer/booking/confirm');

    fireEvent.click(bookLink);

    expect(getCustomerBookingDraft()).toMatchObject({
      recognition: {
        selection: {
          otherNotes: expect.any(String)
        }
      }
    });
  });

  it('advances to step 2 without calling the recognition API', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    render(<CustomerBookingContent />);

    const file = new File(['fake image bytes'], 'french.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText(/choose nail reference photo/i), {
      target: { files: [file] }
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /analyze my photo/i })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: /analyze my photo/i }));

    await screen.findByRole('heading', { name: /style detected/i });
    expect(fetchSpy).not.toHaveBeenCalledWith(
      '/api/ai/recognize-nail-style',
      expect.anything()
    );
  });

  it('opens a published style directly on the breakdown without rerunning image analysis', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(
      <CustomerBookingContent
        prefillStyleId="published-style"
        prefillImageUrl="https://example.com/published.jpg"
        prefillTitle="Published style"
        prefillDescription="Merchant-reviewed configuration"
        prefillPreviewQuote={{ source: 'style_preview', price: 88, duration: 90 }}
      />,
    );

    expect(screen.getByRole('heading', { name: /published style/i })).toBeInTheDocument();
    expect(screen.getByText(/merchant-reviewed configuration/i)).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('link', { name: /book time/i }));
    expect(getCustomerBookingDraft()).toMatchObject({ styleId: 'published-style' });
  });
});
