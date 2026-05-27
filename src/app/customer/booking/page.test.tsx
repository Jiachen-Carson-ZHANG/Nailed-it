import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { getCustomerBookingDraft } from '@/domain/booking-draft';
import CustomerBookingPage from './page';

vi.mock('next/navigation', () => ({
  usePathname: () => '/customer/booking'
}));

describe('CustomerBookingPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('walks through the three-step booking flow and persists the draft', async () => {
    vi.useFakeTimers();

    render(<CustomerBookingPage />);

    // Step 1: Upload
    const recognizeButton = screen.getByRole('button', { name: /analyze my photo/i });
    expect(recognizeButton).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /try with example/i }));
    expect(screen.getByRole('button', { name: /analyze my photo/i })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: /analyze my photo/i }));
    expect(screen.getByText(/ai is recognizing the style/i)).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(700);
    });

    // Step 2: Result — style detected
    expect(screen.getByRole('heading', { name: /style detected/i })).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Edited note carried into confirmation.' }
    });

    fireEvent.click(screen.getByRole('button', { name: /see my quote/i }));

    // Step 3: Quote
    expect(screen.getByRole('heading', { name: /your quote/i })).toBeInTheDocument();

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

    render(<CustomerBookingPage />);

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
});
