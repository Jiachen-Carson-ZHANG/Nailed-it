import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { resetRepositoriesForTests } from '@/lib/repositories';
import { resetStyleMediaStorageForTests } from '@/lib/storage';
import MerchantStylesPage from './page';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => '/merchant/styles',
  useRouter: () => ({ push }),
}));

describe('MerchantStylesPage', () => {
  beforeEach(() => {
    push.mockReset();
    resetRepositoriesForTests();
    resetStyleMediaStorageForTests();
  });

  it('shows one image upload tile and cards without the old embedded review form', async () => {
    render(<MerchantStylesPage />);

    expect(screen.getByRole('heading', { name: /style library/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/upload a new design/i)).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /style title/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/service breakdown/i)).not.toBeInTheDocument();
    expect(await screen.findByText('Rose Cat Eye Shine')).toBeInTheDocument();
  });

  it('uploads a selected image and navigates immediately to its review route', async () => {
    render(<MerchantStylesPage />);
    const bytes = new TextEncoder().encode('RIFF0000WEBP');
    const file = new File([bytes], 'style.webp', { type: 'image/webp' });
    Object.defineProperty(file, 'arrayBuffer', { value: async () => bytes.buffer });

    fireEvent.change(screen.getByLabelText(/upload a new design/i), {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(expect.stringMatching(/^\/merchant\/styles\/style-.+\/review$/));
    });
  });
});
