import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Booking, BookingQuote, TechnicianSnapshot } from '@/domain/nail';
import type { MerchantStyleView, PublishedMerchantStyle } from '@/domain/merchant-style';
import { LanguageProvider } from '@/i18n/context';
import { mockAIResult } from '@/mock/ai';
import { BookingHistoryCard } from './customer/BookingHistoryCard';
import { StyleDetailPanel } from './customer/StyleDetailPanel';
import { MerchantStyleLibrary } from './merchant/MerchantStyleLibrary';
import { MerchantStylePreview } from './merchant/MerchantStylePreview';
import { MerchantBookingDetailClient } from '@/app/merchant/booking/[id]/booking-detail-client';

const pushMock = vi.fn();
const backMock = vi.fn();
const listMerchantStylesActionMock = vi.fn();
const archiveMerchantStyleActionMock = vi.fn();
const deleteMerchantStyleActionMock = vi.fn();
const uploadMerchantStyleActionMock = vi.fn();
const listMerchantBookingViewsActionMock = vi.fn();
const setBookingStatusActionMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    back: backMock,
  }),
}));

vi.mock('@/lib/actions/merchant-style-actions', () => ({
  listMerchantStylesAction: (...args: unknown[]) => listMerchantStylesActionMock(...args),
  archiveMerchantStyleAction: (...args: unknown[]) => archiveMerchantStyleActionMock(...args),
  deleteMerchantStyleAction: (...args: unknown[]) => deleteMerchantStyleActionMock(...args),
  uploadMerchantStyleAction: (...args: unknown[]) => uploadMerchantStyleActionMock(...args),
}));

vi.mock('@/lib/actions/booking-actions', () => ({
  listMerchantBookingViewsAction: (...args: unknown[]) => listMerchantBookingViewsActionMock(...args),
  setBookingStatusAction: (...args: unknown[]) => setBookingStatusActionMock(...args),
}));

vi.mock('@/features/customer/ComponentBreakdownPanel', () => ({
  ComponentBreakdownPanel: () => <div>Mock breakdown panel</div>,
  buildBreakdownFromConfig: () => ({
    totalPrice: 28,
    totalDuration: 75,
  }),
}));

function renderCustomer(ui: React.ReactNode) {
  return render(
    <LanguageProvider initialLanguage="en" role="customer">
      {ui}
    </LanguageProvider>,
  );
}

function renderMerchant(ui: React.ReactNode) {
  return render(
    <LanguageProvider initialLanguage="en" role="merchant">
      {ui}
    </LanguageProvider>,
  );
}

const quote: BookingQuote = {
  source: 'booking_snapshot',
  price: 28,
  duration: 75,
};

const technician: TechnicianSnapshot = {
  id: 'tech-1',
  name: 'Anna Lim',
  initials: 'AL',
};

function createBooking(overrides?: Partial<Booking>): Booking {
  return {
    id: 'booking-1',
    customerName: 'Melissa Tan',
    merchantName: 'Nailed-it Studio',
    styleTitle: 'Rose cat-eye',
    styleImageUrl: '',
    date: '2026-05-23',
    time: '14:00',
    quote,
    status: 'pending_review',
    technician,
    notes: 'Please keep the crystals subtle.',
    recognition: mockAIResult,
    ...overrides,
  };
}

function createPublishedStyle(overrides?: Partial<PublishedMerchantStyle>): PublishedMerchantStyle {
  return {
    id: 'style-1',
    merchantId: 'merchant-1',
    title: 'Rose cat-eye',
    description: 'Soft pink cat-eye shimmer.',
    titleLocalized: { 'zh-CN': '玫瑰猫眼', en: 'Rose cat-eye' },
    descriptionLocalized: { 'zh-CN': '柔粉猫眼光泽。', en: 'Soft pink cat-eye shimmer.' },
    imageUrl: '',
    discoveryFacets: [],
    popularityScore: 1,
    catalogBreakdown: [],
    recognition: mockAIResult,
    previewQuote: { source: 'style_preview', price: 28, duration: 75 },
    ...overrides,
  };
}

function createMerchantStyleView(overrides?: Partial<MerchantStyleView>): MerchantStyleView {
  return {
    id: 'style-1',
    merchantId: 'merchant-1',
    title: 'Rose cat-eye',
    description: 'Soft pink cat-eye shimmer.',
    status: 'published',
    catalogBreakdown: [],
    discoveryFacets: [],
    previewPriceCents: 2800,
    previewDurationMin: 75,
    updatedAt: '2026-05-23T10:00:00.000Z',
    imageUrl: '',
    ...overrides,
  };
}

describe('image src guards', () => {
  beforeEach(() => {
    pushMock.mockReset();
    backMock.mockReset();
    listMerchantStylesActionMock.mockReset();
    archiveMerchantStyleActionMock.mockReset();
    deleteMerchantStyleActionMock.mockReset();
    uploadMerchantStyleActionMock.mockReset();
    listMerchantBookingViewsActionMock.mockReset();
    setBookingStatusActionMock.mockReset();
  });

  it('does not render the hero image in StyleDetailPanel when the style image URL is empty', () => {
    renderCustomer(<StyleDetailPanel backHref="/customer/home" style={createPublishedStyle()} />);

    expect(screen.queryByRole('img', { name: 'Rose cat-eye' })).not.toBeInTheDocument();
  });

  it('does not render booking images in BookingHistoryCard when the image URL is empty', () => {
    renderCustomer(<BookingHistoryCard booking={createBooking()} defaultOpen />);

    expect(screen.queryAllByRole('img', { name: 'Rose cat-eye' })).toHaveLength(0);
  });

  it('does not render the booking image in MerchantBookingDetailClient when the image URL is empty', async () => {
    listMerchantBookingViewsActionMock.mockResolvedValue([createBooking()]);

    renderMerchant(<MerchantBookingDetailClient id="booking-1" />);

    expect(await screen.findByRole('heading', { name: /melissa tan/i })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Rose cat-eye' })).not.toBeInTheDocument();
  });

  it('does not render style library card images when a merchant style image URL is empty', async () => {
    listMerchantStylesActionMock.mockResolvedValue([createMerchantStyleView()]);

    renderMerchant(<MerchantStyleLibrary />);

    expect(await screen.findByText('Rose cat-eye')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('img', { name: 'Rose cat-eye' })).not.toBeInTheDocument();
    });
  });

  it('does not render preview thumbnails when a merchant style image URL is empty', async () => {
    listMerchantStylesActionMock.mockResolvedValue([createMerchantStyleView()]);

    renderMerchant(<MerchantStylePreview />);

    expect(await screen.findByText('Style lookbook')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('img', { name: 'Rose cat-eye' })).not.toBeInTheDocument();
    });
  });
});
