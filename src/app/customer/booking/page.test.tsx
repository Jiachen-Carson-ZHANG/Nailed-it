import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { getCustomerBookingDraft } from '@/domain/booking-draft';
import { clearBreakdownResults, getBreakdownResult, saveBreakdownResult } from '@/domain/breakdown-store';
import { getDefaultSettings } from '@/data/glossary-settings-store';
import { LanguageProvider } from '@/i18n/context';
import { buildBreakdownResult } from '@/features/customer/ComponentBreakdownPanel';
import { CustomerBookingContent } from './booking-content';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/customer/booking',
  useSearchParams: () => new URLSearchParams(),
}));

describe('CustomerBookingPage', () => {
  afterEach(() => {
    clearBreakdownResults();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function renderBookingContent(
    ui: React.ReactNode,
    language: 'zh-CN' | 'en' = 'zh-CN',
  ) {
    return render(
      <LanguageProvider initialLanguage={language} role="customer">
        {ui}
      </LanguageProvider>
    );
  }

  it('walks through the three-step booking flow and persists the draft', async () => {
    // Recognition runs against the live endpoint now that the example shortcut is gone; the breakdown
    // panel fetch in step 2 hits the same mock and is handled gracefully if the shape doesn't match.
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

      if (url === '/api/ai/breakdown') {
        return new Response(
          JSON.stringify({
            items: [],
            catalogSelections: [],
            totalPrice: 0,
            totalDuration: 0,
            mode: 'glossary'
          }),
          { headers: { 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      return new Response(
        JSON.stringify({
          recognition: {
            selection: { baseServices: [], nailShape: 'oval', styles: ['french'], addons: [], otherNotes: 'Sample look.' },
            meta: { confidence: 0.9, aiSuggestedQuote: { source: 'ai_suggestion', price: 0, duration: 0 } }
          }
        }),
        { headers: { 'Content-Type': 'application/json' }, status: 200 }
      );
    });

    renderBookingContent(<CustomerBookingContent />);

    // Step 1: Upload — the Analyze CTA only appears once a reference image exists.
    expect(screen.queryByRole('button', { name: 'AI智能识别' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '上传你的美甲参考图' })).toBeInTheDocument();
    expect(screen.getByText('上传')).toBeInTheDocument();
    expect(screen.getByText('识别结果')).toBeInTheDocument();
    expect(screen.getByText('报价')).toBeInTheDocument();

    const file = new File(['fake image bytes'], 'ref.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('选择美甲参考图'), { target: { files: [file] } });

    await waitFor(() => expect(screen.getByRole('button', { name: 'AI智能识别' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'AI智能识别' }));

    // Step 2: Result — style detected
    await screen.findByRole('heading', { name: '款式识别结果' });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /查看我的报价/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /查看我的报价/i }));

    // Step 3: Quote
    expect(screen.getByRole('heading', { name: '你的报价' })).toBeInTheDocument();

    const nextLink = screen.getByRole('link', { name: '下一步：选择时间' });
    expect(nextLink).toHaveAttribute('href', '/customer/booking/confirm');

    nextLink.addEventListener('click', (event) => event.preventDefault(), { once: true });
    fireEvent.click(nextLink);

    expect(getCustomerBookingDraft()).toMatchObject({
      recognition: {
        selection: {
          otherNotes: expect.any(String)
        }
      }
    });
  });

  it('keeps the quote CTA hidden until a quote result exists', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

      if (url === '/api/ai/breakdown') {
        return new Response(
          JSON.stringify({
            items: [],
            catalogSelections: [],
            totalPrice: 0,
            totalDuration: 0,
            mode: 'glossary'
          }),
          { headers: { 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      return new Response(
        JSON.stringify({
          recognition: {
            selection: { baseServices: [], nailShape: 'oval', styles: ['french'], addons: [], otherNotes: 'Sample look.' },
            meta: { confidence: 0.9, aiSuggestedQuote: { source: 'ai_suggestion', price: 0, duration: 0 } }
          }
        }),
        { headers: { 'Content-Type': 'application/json' }, status: 200 }
      );
    });

    renderBookingContent(<CustomerBookingContent />);

    const file = new File(['fake image bytes'], 'ref.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('选择美甲参考图'), { target: { files: [file] } });

    await waitFor(() => expect(screen.getByRole('button', { name: 'AI智能识别' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'AI智能识别' }));

    await screen.findByRole('heading', { name: '款式识别结果' });
    expect(screen.queryByRole('button', { name: /查看我的报价/i })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /查看我的报价/i })).toBeInTheDocument();
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

    renderBookingContent(<CustomerBookingContent />);

    const file = new File(['fake image bytes'], 'french.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('选择美甲参考图'), {
      target: { files: [file] }
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'AI智能识别' })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'AI智能识别' }));

    // Should advance to step 2 with API result (description text is intentionally no longer shown)
    await screen.findByRole('heading', { name: '款式识别结果' });

    expect(fetch).toHaveBeenCalledWith(
      '/api/ai/recognize-nail-style',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
    );

    const request = vi.mocked(fetch).mock.calls.at(-1)?.[1] as RequestInit | undefined;
    expect(JSON.parse(String(request?.body))).toMatchObject({
      imageBase64: expect.any(String),
      language: 'zh-CN',
      mimeType: 'image/png',
    });
  });

  it('opens a published style on its frozen quote without rerunning image analysis', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    renderBookingContent(
      <CustomerBookingContent
        prefillStyleId="published-style"
        prefillImageUrl="https://example.com/published.jpg"
        prefillTitle="Published style"
        prefillDescription="Merchant-reviewed configuration"
        prefillPreviewQuote={{ source: 'style_preview', price: 88, duration: 90 }}
      />,
    );

    expect(screen.getByRole('heading', { name: '你的报价' })).toBeInTheDocument();
    expect(screen.getByText(/merchant-reviewed configuration/i)).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();

    const nextLink = screen.getByRole('link', { name: '下一步：选择时间' });
    nextLink.addEventListener('click', (event) => event.preventDefault(), { once: true });
    fireEvent.click(nextLink);
    expect(getCustomerBookingDraft()).toMatchObject({ styleId: 'published-style' });
  });

  it('does not inflate a cached full-cover quote with implied helper structures when the booking page rehydrates it', async () => {
    const settingsById = new Map(getDefaultSettings().map((setting) => [setting.id, setting]));
    const cachedBreakdown = buildBreakdownResult(
      null,
      new Set(['nail_tip_full_cover']),
      null,
      null,
      null,
      new Set(),
      new Set(),
      new Set(),
      new Set(),
      new Map(),
      settingsById,
    );
    saveBreakdownResult(cachedBreakdown);

    renderBookingContent(<CustomerBookingContent skipToResult />);

    await waitFor(() => {
      expect(getBreakdownResult()?.catalogSelections).toEqual(cachedBreakdown.catalogSelections);
      expect(getBreakdownResult()?.totalPrice).toBe(cachedBreakdown.totalPrice);
    });
  });

  it('keeps pure texture signals editable in the color effects bucket when the booking page rehydrates a cached result', async () => {
    const settingsById = new Map(getDefaultSettings().map((setting) => [setting.id, setting]));
    const cachedBreakdown = buildBreakdownResult(
      null,
      new Set(),
      null,
      null,
      'texture_matte',
      new Set(),
      new Set(),
      new Set(),
      new Set(),
      new Map(),
      settingsById,
    );
    saveBreakdownResult(cachedBreakdown);

    renderBookingContent(<CustomerBookingContent skipToResult />);

    await waitFor(() => {
      const persistedSelections = getBreakdownResult()?.catalogSelections ?? [];
      expect(screen.getByRole('button', { name: '磨砂感' })).toHaveAttribute('aria-pressed', 'true');
      expect(persistedSelections).toContainEqual({ catalogItemId: 'texture_matte', quantity: 1 });
      expect(persistedSelections).not.toContainEqual({ catalogItemId: 'matte_top', quantity: 1 });
    });
  });

  it('renders booking copy in English after switching language', async () => {
    renderBookingContent(<CustomerBookingContent />, 'en');

    expect(screen.getByRole('heading', { name: 'Upload your nail reference' })).toBeInTheDocument();
    expect(screen.getByText('Upload')).toBeInTheDocument();
    expect(screen.getByText('Style result')).toBeInTheDocument();
    expect(screen.getByText('Quote')).toBeInTheDocument();
    expect(screen.getByText('Upload or take photo')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'New nail design' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open profile' })).toBeInTheDocument();
  });

  it('renders updated booking action copy in Chinese', async () => {
    renderBookingContent(<CustomerBookingContent />);

    expect(screen.getByText('上传或拍照')).toBeInTheDocument();

    const file = new File(['fake image bytes'], 'ref.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('选择美甲参考图'), { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole('link', { name: '试戴款式' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'AI智能识别' })).toBeEnabled();
    });
  });

  it('hides the uploaded-image helper copy after a photo is selected', async () => {
    const { container } = renderBookingContent(<CustomerBookingContent />);

    const file = new File(['fake image bytes'], 'ref.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('选择美甲参考图'), { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'AI智能识别' })).toBeEnabled();
    });

    expect(container.querySelector('.image-uploader-copy')).toBeNull();
  });

  it('hides the uploaded-image helper copy in English after a photo is selected', async () => {
    const { container } = renderBookingContent(<CustomerBookingContent />, 'en');

    const file = new File(['fake image bytes'], 'ref.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Choose nail reference photo'), { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Analyze my photo' })).toBeEnabled();
    });

    expect(container.querySelector('.image-uploader-copy')).toBeNull();
  });

  it('uses the provided example image when the user taps the example shortcut', async () => {
    renderBookingContent(
      <CustomerBookingContent defaultExampleImageUrl="https://example.com/melissa-8265.jpg" />
    );

    fireEvent.click(screen.getByRole('button', { name: '试试示例图' }));

    await waitFor(() => {
      expect(screen.getByAltText('Uploaded nail reference')).toHaveAttribute(
        'src',
        'https://example.com/melissa-8265.jpg',
      );
    });
  });

  it('runs live recognition for the example image instead of using mock recognition', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          recognition: {
            selection: {
              baseServices: [],
              nailShape: 'almond',
              styles: ['french'],
              addons: [],
              otherNotes: 'Live recognition for example image.',
            },
            meta: {
              confidence: 0.95,
              aiSuggestedQuote: {
                source: 'ai_suggestion',
                price: 0,
                duration: 0,
              },
            },
          },
        }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        },
      ),
    );

    renderBookingContent(
      <CustomerBookingContent defaultExampleImageUrl="data:image/png;base64,ZmFrZQ==" />
    );

    fireEvent.click(screen.getByRole('button', { name: '试试示例图' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'AI智能识别' })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'AI智能识别' }));

    await screen.findByRole('heading', { name: '款式识别结果' });

    expect(fetch).toHaveBeenCalledWith(
      '/api/ai/recognize-nail-style',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const request = vi.mocked(fetch).mock.calls.at(-1)?.[1] as RequestInit | undefined;
    expect(JSON.parse(String(request?.body))).toMatchObject({
      imageBase64: 'ZmFrZQ==',
      mimeType: 'image/png',
      language: 'zh-CN',
    });
  });

  it('sends the current language with the live recognition request', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          recognition: {
            selection: { baseServices: [], nailShape: 'oval', styles: ['french'], addons: [], otherNotes: 'English note.' },
            meta: { confidence: 0.9, aiSuggestedQuote: { source: 'ai_suggestion', price: 0, duration: 0 } }
          }
        }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200
        }
      )
    );

    renderBookingContent(<CustomerBookingContent />, 'en');
    const file = new File(['fake image bytes'], 'french.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Choose nail reference photo'), {
      target: { files: [file] }
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Analyze my photo' })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Analyze my photo' }));
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/ai/recognize-nail-style', expect.anything());
    });

    const request = vi.mocked(fetch).mock.calls.find(
      (call) => call[0] === '/api/ai/recognize-nail-style',
    )?.[1] as RequestInit | undefined;
    expect(JSON.parse(String(request?.body))).toMatchObject({ language: 'en' });
  });
});
