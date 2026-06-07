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

  it('walks through the three-step booking flow and persists the draft', async () => {
    // Recognition runs against the live endpoint now that the example shortcut is gone; the breakdown
    // panel fetch in step 2 hits the same mock and is handled gracefully if the shape doesn't match.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          recognition: {
            selection: { baseServices: [], nailShape: 'oval', styles: ['french'], addons: [], otherNotes: 'Sample look.' },
            meta: { confidence: 0.9, aiSuggestedQuote: { source: 'ai_suggestion', price: 0, duration: 0 } }
          }
        }),
        { headers: { 'Content-Type': 'application/json' }, status: 200 }
      )
    );

    render(<CustomerBookingContent />);

    // Step 1: Upload — the Analyze CTA only appears once a reference image exists.
    expect(screen.queryByRole('button', { name: /analyze my photo/i })).not.toBeInTheDocument();

    const file = new File(['fake image bytes'], 'ref.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText(/choose nail reference photo/i), { target: { files: [file] } });

    await waitFor(() => expect(screen.getByRole('button', { name: /analyze my photo/i })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /analyze my photo/i }));

    // Step 2: Result — style detected
    await screen.findByRole('heading', { name: /style detected/i });

    fireEvent.click(screen.getByRole('button', { name: /see my quote/i }));

    // Step 3: Quote
    expect(screen.getByRole('heading', { name: /your quote/i })).toBeInTheDocument();

    const nextLink = screen.getByRole('link', { name: /next: choose time/i });
    expect(nextLink).toHaveAttribute('href', '/customer/booking/confirm');

    fireEvent.click(nextLink);

    expect(getCustomerBookingDraft()).toMatchObject({
      recognition: {
        selection: {
          otherNotes: expect.any(String)
        }
      }
    });
  });

  it('sends a selected image to the live recognition API', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          recognition: {
            selection: {
              baseServices: ['extension'],
              nailShape: 'oval',
              styles: ['french'],
              addons: [],
              otherNotes: 'Thin white French tips from Gemini.'
            },
            meta: {
              confidence: 0.91,
              aiSuggestedQuote: {
                source: 'ai_suggestion',
                price: 0,
                duration: 0
              }
            }
          }
        }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200
        }
      )
    );

    render(<CustomerBookingContent />);

    const file = new File(['fake image bytes'], 'french.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText(/choose nail reference photo/i), {
      target: { files: [file] }
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /analyze my photo/i })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: /analyze my photo/i }));

    // Should advance to step 2 with API result
    await screen.findByRole('heading', { name: /style detected/i });
    expect(screen.getAllByText(/thin white french tips from gemini/i).length).toBeGreaterThan(0);

    expect(fetch).toHaveBeenCalledWith(
      '/api/ai/recognize-nail-style',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
    );
  });

  it('opens a published style on its frozen quote without rerunning image analysis', () => {
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

    expect(screen.getByRole('heading', { name: /your quote/i })).toBeInTheDocument();
    expect(screen.getByText(/merchant-reviewed configuration/i)).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('link', { name: /next: choose time/i }));
    expect(getCustomerBookingDraft()).toMatchObject({ styleId: 'published-style' });
  });
});
