import { StrictMode } from 'react';
import { act } from '@testing-library/react';
import { beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { clearCustomerBookingDraft, saveCustomerBookingDraft } from '@/domain/booking-draft';
import { LanguageProvider } from '@/i18n/context';
import { mockAIResult } from '@/mock/ai';
import { resetRepositoriesForTests } from '@/lib/repositories';
import CustomerBookingConfirmPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/customer/booking/confirm'
}));

describe('CustomerBookingConfirmPage', () => {
  beforeEach(() => {
    clearCustomerBookingDraft();
    // The confirm write now goes through the repository-backed booking action; reset the
    // in-memory bundle so each test starts with no DB bookings (no cross-test overlap).
    resetRepositoriesForTests();
  });

  async function renderConfirmPage(language: 'zh-CN' | 'en' = 'zh-CN') {
    const result = render(
      <LanguageProvider initialLanguage={language} role="customer">
        <CustomerBookingConfirmPage />
      </LanguageProvider>
    );

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    return result;
  }

  it('shows the empty state when no draft is available', async () => {
    await renderConfirmPage();

    expect(screen.getByText('还没有选择款式')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '开始预约' })).toHaveAttribute(
      'href',
      '/customer/booking'
    );
  });

  it('renders the current booking draft summary instead of reconstructing from mock ai defaults', async () => {
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

    await renderConfirmPage();

    // The estimate reflects the draft (123 / 88), proving the page reads the draft rather than
    // reconstructing from mock AI defaults.
    expect(screen.getByText(/88 分钟 · ¥123\.00/i)).toBeInTheDocument();
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

    const firstRender = await renderConfirmPage();
    expect(firstRender.getByText(/88 分钟 · ¥123\.00/i)).toBeInTheDocument();

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    firstRender.unmount();

    await renderConfirmPage();
    expect(screen.getByText('还没有选择款式')).toBeInTheDocument();
  });

  it('still shows the draft on the first valid visit inside StrictMode', async () => {
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
      <LanguageProvider initialLanguage="zh-CN" role="customer">
        <StrictMode>
          <CustomerBookingConfirmPage />
        </StrictMode>
      </LanguageProvider>
    );

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(screen.getByText(/88 分钟 · ¥123\.00/i)).toBeInTheDocument();
  });

  it('books a technician-backed slot into pending merchant review even at high confidence (client recognition is untrusted)', async () => {
    const user = userEvent.setup();

    saveCustomerBookingDraft({
      estimate: {
        source: 'pricing_rules',
        price: 123,
        duration: 88
      },
      imageUrl: 'https://example.com/reference.png',
      // mockMeta() carries a high confidence (0.86); the server must still not auto-confirm from it.
      recognition: {
        meta: mockMeta(),
        selection: mockSelection()
      }
    });

    await renderConfirmPage();

    const confirmButton = screen.getByRole('button', { name: '确认预约' });
    expect(confirmButton).toBeDisabled();

    // availability loads async from the booking service (10:00 with Mei is offered on several days)
    await user.click((await screen.findAllByRole('button', { name: /10:00 .* mei chen/i }))[0]);
    expect(confirmButton).toBeEnabled();

    await user.click(confirmButton);

    expect(await screen.findByRole('status')).toHaveTextContent(/mei chen.*待确认/i);
    expect(confirmButton).toBeDisabled();
    expect(confirmButton).toHaveTextContent('待确认');
    const messagesLink = screen.getByRole('link', { name: '打开预约消息' });
    expect(messagesLink.getAttribute('href')).toMatch(/^\/customer\/messages\/conv-booking-/);
  });

  it('replaces a draft snapshot with the exact selected-technician catalog quote', async () => {
    const user = userEvent.setup();
    saveCustomerBookingDraft({
      estimate: { source: 'pricing_rules', price: 999, duration: 1 },
      imageUrl: 'https://example.com/reference.png',
      recognition: mockAIResult,
      catalogSelections: [{ catalogItemId: 'basic_manicure_service', quantity: 1 }],
    });

    await renderConfirmPage();
    await user.click((await screen.findAllByRole('button', { name: /10:00 .* mei chen/i }))[0]);

    expect(screen.getByText(/45 分钟 · ¥28\.00/i)).toBeInTheDocument();
  });

  it('renders confirm page copy and currency in English', async () => {
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

    await renderConfirmPage('en');

    expect(screen.getByRole('heading', { name: 'Choose your appointment time' })).toBeInTheDocument();
    expect(screen.getByText(/88 min · \$123\.00/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm appointment' })).toBeInTheDocument();
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
