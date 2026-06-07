import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, vi } from 'vitest';
import { LanguageProvider } from '@/i18n/context';
import { resetRepositoriesForTests } from '@/lib/repositories';
import { createBookingAction } from '@/lib/actions/booking-actions';
import { mockAIResult } from '@/mock/ai';
import CustomerProfilePage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/customer/profile'
}));

describe('CustomerProfilePage', () => {
  beforeEach(() => {
    resetRepositoriesForTests();
    window.localStorage.clear();
  });

  function renderCustomerProfilePage() {
    return render(
      <LanguageProvider role="customer">
        <CustomerProfilePage />
      </LanguageProvider>
    );
  }

  it('renders the customer profile and booking history read from the booking service', async () => {
    renderCustomerProfilePage();

    // identity is static; the history loads from the booking service.
    expect(screen.getByRole('heading', { name: /melissa tan/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '预约历史' })).toBeInTheDocument();
    expect(await screen.findByText(/rose cat-eye/i)).toBeInTheDocument();
    expect(screen.getByText('待确认')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '隐私政策' })).toHaveAttribute('href', '/privacy');
  });

  it('includes a booking created for the demo customer through the booking service', async () => {
    // customerName is server-derived to the demo customer; identity is never client-supplied.
    await createBookingAction({
      technicianId: 'tech-anna',
      recognition: mockAIResult,
      styleTitle: 'Custom AI reference',
      styleImageUrl: 'https://example.com/custom-ai-reference.png',
      date: '2026-05-23',
      // Anna opens 11:00 (Tue–Sat); create-time availability now enforces working hours.
      time: '11:00',
      notes: 'Profile should show this booking.'
    });

    renderCustomerProfilePage();

    // The card summary always shows the style title; full details (notes, technician) expand on click.
    expect(await screen.findByText('Custom AI reference')).toBeInTheDocument();
  });

  it('renders a language switcher and updates visible labels after switching to English', async () => {
    const user = userEvent.setup();

    renderCustomerProfilePage();

    expect(screen.getByRole('heading', { name: '预约历史' })).toBeInTheDocument();
    expect(screen.getByText('即将到来的预约')).toBeInTheDocument();
    const entry = screen.getByRole('button', { name: '语言设置' });
    const privacy = screen.getByRole('link', { name: '隐私政策' });

    expect(entry).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'English' })).not.toBeInTheDocument();
    expect(entry.compareDocumentPosition(privacy) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await user.click(entry);

    expect(screen.getByRole('radiogroup', { name: '语言设置' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '中文' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'English' })).toHaveAttribute('aria-checked', 'false');

    await user.click(screen.getByRole('radio', { name: 'English' }));

    expect(screen.getByRole('heading', { name: 'Booking history' })).toBeInTheDocument();
    const englishEntry = screen.getByRole('button', { name: 'Language' });
    expect(screen.getByText('Upcoming bookings')).toBeInTheDocument();
    expect(englishEntry).toHaveAttribute('aria-expanded', 'false');
    expect(englishEntry).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Chinese' })).not.toBeInTheDocument();
  });

  it('localizes booking history detail actions after switching to English', async () => {
    const user = userEvent.setup();

    renderCustomerProfilePage();
    await screen.findByText(/rose cat-eye/i);
    await user.click(screen.getByRole('button', { name: /rose cat-eye/i }));
    expect(screen.getByRole('link', { name: '联系门店' })).toHaveAttribute(
      'href',
      '/customer/messages/conv-melissa'
    );

    await user.click(screen.getByRole('button', { name: '语言设置' }));
    await user.click(screen.getByRole('radio', { name: 'English' }));
    expect(screen.getByRole('link', { name: 'Message studio' })).toHaveAttribute(
      'href',
      '/customer/messages/conv-melissa'
    );
  });

  it('supports tabbing into the radiogroup and using arrow keys to switch language', async () => {
    const user = userEvent.setup();

    renderCustomerProfilePage();

    const entry = screen.getByRole('button', { name: '语言设置' });
    entry.focus();
    expect(entry).toHaveFocus();

    await user.keyboard('{Enter}');

    const zhRadio = screen.getByRole('radio', { name: '中文' });
    expect(screen.getByRole('radiogroup', { name: '语言设置' })).toBeInTheDocument();

    await user.tab();
    expect(zhRadio).toHaveFocus();

    await user.keyboard('{ArrowRight}');

    const englishEntry = screen.getByRole('button', { name: 'Language' });
    expect(englishEntry).toHaveFocus();
    expect(screen.getByRole('heading', { name: 'Booking history' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Chinese' })).not.toBeInTheDocument();
  });
});
