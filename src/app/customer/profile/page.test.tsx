import { render, screen } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';
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
  });

  it('renders the customer profile and booking history read from the booking service', async () => {
    render(<CustomerProfilePage />);

    // identity is static; the history loads from the booking service.
    expect(screen.getByRole('heading', { name: /melissa tan/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /booking history/i })).toBeInTheDocument();
    expect(await screen.findByText(/rose cat eye shine/i)).toBeInTheDocument();
    expect(screen.getByText(/awaiting confirmation/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /privacy policy/i })).toHaveAttribute('href', '/privacy');
  });

  it('includes a booking created for the demo customer through the booking service', async () => {
    // customerName is server-derived to the demo customer; identity is never client-supplied.
    await createBookingAction({
      technicianId: 'tech-anna',
      recognition: mockAIResult,
      styleTitle: 'Custom AI reference',
      styleImageUrl: '',
      date: '2026-05-23',
      // Anna opens 11:00 (Tue–Sat); create-time availability now enforces working hours.
      time: '11:00',
      notes: 'Profile should show this booking.'
    });

    render(<CustomerProfilePage />);

    // The card summary always shows the style title; full details (notes, technician) expand on click.
    expect(await screen.findByText('Custom AI reference')).toBeInTheDocument();
  });
});
