import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, vi } from 'vitest';
import { resetRepositoriesForTests } from '@/lib/repositories';
import { resetStyleMediaStorageForTests } from '@/lib/storage';
import { uploadMerchantStyleAction } from '@/lib/actions/merchant-style-actions';
import MerchantStyleReviewPage from './page';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => '/merchant/styles/style-test/review',
  useRouter: () => ({ push }),
}));

const originalFetch = global.fetch;

async function uploadProcessingStyle() {
  const upload = new FormData();
  const bytes = new TextEncoder().encode('RIFF0000WEBP');
  const file = new File([bytes], 'style.webp', { type: 'image/webp' });
  Object.defineProperty(file, 'arrayBuffer', { value: async () => bytes.buffer });
  upload.set('image', file);
  return uploadMerchantStyleAction(upload);
}

describe('MerchantStyleReviewPage (cloned style-result editor)', () => {
  beforeEach(() => {
    push.mockReset();
    resetRepositoriesForTests();
    resetStyleMediaStorageForTests();
    // The merchant editor reuses the customer panel, which runs the breakdown client-side.
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ items: [], catalogSelections: [], totalPrice: 0, totalDuration: 0, mode: 'glossary' }),
    })) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('opens a fresh upload in the cloned editor — title + publish, no 卸甲, no old AI-breakdown trigger', async () => {
    const draft = await uploadProcessingStyle();
    render(await MerchantStyleReviewPage({ params: Promise.resolve({ id: draft.id }) }));

    expect(screen.queryByRole('navigation', { name: /merchant navigation/i })).not.toBeInTheDocument();
    expect(await screen.findByRole('textbox', { name: /设计名称/ })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /发布/ })).toBeInTheDocument();
    // 卸甲 is the customer-only removal section — hidden for merchant editing.
    expect(screen.queryByRole('heading', { name: /卸甲/ })).not.toBeInTheDocument();
    // The old processing/review workspace is retired; there is no "save draft" (no drafts are parked).
    expect(screen.queryByRole('button', { name: /run ai breakdown/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /保存草稿/ })).not.toBeInTheDocument();
  });

  it('publish returns to the library', async () => {
    const user = userEvent.setup();
    const draft = await uploadProcessingStyle();
    render(await MerchantStyleReviewPage({ params: Promise.resolve({ id: draft.id }) }));

    const title = await screen.findByRole('textbox', { name: /设计名称/ });
    fireEvent.change(title, { target: { value: '甜美杏仁' } });

    await user.click(await screen.findByRole('button', { name: /发布/ }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/merchant/styles'));
  });

  it('cancel discards the unpublished upload and returns to the library', async () => {
    const draft = await uploadProcessingStyle();
    render(await MerchantStyleReviewPage({ params: Promise.resolve({ id: draft.id }) }));

    // Let the editor settle (panel analysis + onResult re-render) before interacting.
    const title = await screen.findByRole('textbox', { name: /设计名称/ });
    fireEvent.change(title, { target: { value: 'x' } });

    fireEvent.click(await screen.findByRole('button', { name: /取消/ }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/merchant/styles'));
  });
});
