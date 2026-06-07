import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { getCustomerBookingDraft } from '@/domain/booking-draft';
import { LanguageProvider } from '@/i18n/context';
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

    renderBookingContent(<CustomerBookingContent />);

    // Step 1: Upload — the Analyze CTA only appears once a reference image exists.
    expect(screen.queryByRole('button', { name: 'AI识别' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '上传你的美甲参考图' })).toBeInTheDocument();
    expect(screen.getByText('上传')).toBeInTheDocument();
    expect(screen.getByText('识别结果')).toBeInTheDocument();
    expect(screen.getByText('报价')).toBeInTheDocument();
    expect(screen.getByText('上传或拍照')).toBeInTheDocument();

    const file = new File(['fake image bytes'], 'ref.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('选择美甲参考图'), { target: { files: [file] } });

    await waitFor(() => expect(screen.getByRole('button', { name: 'AI识别' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'AI识别' }));

    // Step 2: Result — style detected
    await screen.findByRole('heading', { name: '款式识别结果' });

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

  it('advances to step 2 without calling the recognition API', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    renderBookingContent(<CustomerBookingContent />);

    const file = new File(['fake image bytes'], 'french.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('选择美甲参考图'), {
      target: { files: [file] }
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'AI识别' })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'AI识别' }));

    // Should advance to step 2 with API result
    await screen.findByRole('heading', { name: '款式识别结果' });
    expect(screen.getAllByText(/thin white french tips from gemini/i).length).toBeGreaterThan(0);

    expect(fetch).toHaveBeenCalledWith(
      '/api/ai/recognize-nail-style',
      expect.anything()
    );

    const request = vi.mocked(fetch).mock.calls.at(-1)?.[1] as RequestInit | undefined;
    expect(JSON.parse(String(request?.body))).toMatchObject({
      imageBase64: expect.any(String),
      language: 'zh-CN',
      mimeType: 'image/png',
    });
  });

  it('opens a published style directly on the breakdown without rerunning image analysis', () => {
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

  it('renders booking copy in English after switching language', async () => {
    renderBookingContent(<CustomerBookingContent />, 'en');

    expect(screen.getByRole('heading', { name: 'Upload your nail reference' })).toBeInTheDocument();
    expect(screen.getByText('Upload or take photo')).toBeInTheDocument();
    expect(screen.getByText('Style result')).toBeInTheDocument();
    expect(screen.getByText('Quote')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'New nail design' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open profile' })).toBeInTheDocument();
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
    await screen.findByText(/english note/i);

    const request = vi.mocked(fetch).mock.calls.at(-1)?.[1] as RequestInit | undefined;
    expect(JSON.parse(String(request?.body))).toMatchObject({ language: 'en' });
  });

  it('shows localized upload actions in Chinese mode', async () => {
    renderBookingContent(<CustomerBookingContent />);

    expect(screen.getByText('上传或拍照')).toBeInTheDocument();

    const file = new File(['fake image bytes'], 'look.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('选择美甲参考图'), {
      target: { files: [file] }
    });

    await waitFor(() => {
      expect(screen.getByRole('link', { name: '试戴款式' })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'AI识别' })).toBeInTheDocument();
  });
});
