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

  it('opens processing uploads in a dedicated editable review workspace', async () => {
    const draft = await uploadProcessingStyle();
    render(await MerchantStyleReviewPage({ params: Promise.resolve({ id: draft.id }) }));

    expect(screen.queryByRole('navigation', { name: /merchant navigation/i })).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /review design/i })).toBeInTheDocument();

    expect(await screen.findByRole('textbox', { name: /design title/i })).toHaveValue('Untitled design');
    expect(screen.getByRole('textbox', { name: /description/i })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: /search services/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save draft/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /publish/i })).toBeInTheDocument();
  });

  it('adds services, previews the deterministic quote, saves, and publishes', async () => {
    const user = userEvent.setup();
    const draft = await uploadProcessingStyle();
    render(await MerchantStyleReviewPage({ params: Promise.resolve({ id: draft.id }) }));

    const title = await screen.findByRole('textbox', { name: /design title/i });
    fireEvent.change(title, { target: { value: 'Reviewed design' } });
    await user.click(screen.getByRole('button', { name: /add 基础护理服务/i }));

    await waitFor(() => {
      expect(screen.getByText('$28.00')).toBeInTheDocument();
      expect(screen.getByText('51 min')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /save draft/i }));
    expect(await screen.findByText(/draft saved/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^publish$/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/merchant/styles'));
  });
});
