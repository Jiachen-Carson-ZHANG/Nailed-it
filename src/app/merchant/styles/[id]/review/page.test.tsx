import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, vi } from 'vitest';
import { resetRepositoriesForTests } from '@/lib/repositories';
import { resetStyleMediaStorageForTests } from '@/lib/storage';
import { uploadMerchantStyleAction } from '@/lib/actions/merchant-style-actions';
import MerchantStyleReviewPage from './page';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => '/merchant/styles/style-test/review',
  useRouter: () => ({ push }),
}));

async function uploadProcessingStyle() {
  const upload = new FormData();
  const bytes = new TextEncoder().encode('RIFF0000WEBP');
  const file = new File([bytes], 'style.webp', { type: 'image/webp' });
  Object.defineProperty(file, 'arrayBuffer', { value: async () => bytes.buffer });
  upload.set('image', file);
  return uploadMerchantStyleAction(upload);
}

describe('MerchantStyleReviewPage', () => {
  beforeEach(() => {
    push.mockReset();
    resetRepositoriesForTests();
    resetStyleMediaStorageForTests();
  });

  it('opens a processing upload on the AI-breakdown step, with no editor yet', async () => {
    const draft = await uploadProcessingStyle();
    render(await MerchantStyleReviewPage({ params: Promise.resolve({ id: draft.id }) }));

    expect(screen.queryByRole('navigation', { name: /merchant navigation/i })).not.toBeInTheDocument();
    expect(document.querySelector('.mobile-shell-workspace')).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /analyze design/i })).toBeInTheDocument();

    // Before AI runs, the only action is the breakdown trigger — the editor stays hidden.
    expect(screen.getByRole('button', { name: /run ai breakdown/i })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /design title/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('searchbox', { name: /search services/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^publish$/i })).not.toBeInTheDocument();
  });

  it('adds services, previews the deterministic quote, saves, and publishes', async () => {
    const user = userEvent.setup();
    const draft = await uploadProcessingStyle();
    render(await MerchantStyleReviewPage({ params: Promise.resolve({ id: draft.id }) }));

    await user.click(await screen.findByRole('button', { name: /ai breakdown/i }));
    expect(await screen.findByText(/review the design manually|ai breakdown ready/i)).toBeInTheDocument();

    const title = await screen.findByRole('textbox', { name: /design title/i });
    fireEvent.change(title, { target: { value: 'Reviewed design' } });
    await user.click(screen.getByRole('button', { name: /add 基础护理服务/i }));

    await waitFor(() => {
      expect(screen.getByText('$28.00')).toBeInTheDocument();
      expect(screen.getByText('51 min')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /^publish$/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/merchant/styles'));
  });

  it('save draft returns to the library', async () => {
    const user = userEvent.setup();
    const draft = await uploadProcessingStyle();
    render(await MerchantStyleReviewPage({ params: Promise.resolve({ id: draft.id }) }));

    await user.click(await screen.findByRole('button', { name: /ai breakdown/i }));
    const title = await screen.findByRole('textbox', { name: /design title/i });
    fireEvent.change(title, { target: { value: 'Draft name' } });

    await user.click(screen.getByRole('button', { name: /save draft/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/merchant/styles'));
  });
});
