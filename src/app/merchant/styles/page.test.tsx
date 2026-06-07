import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { LanguageProvider } from '@/i18n/context';
import { resetRepositoriesForTests } from '@/lib/repositories';
import { resetStyleMediaStorageForTests } from '@/lib/storage';
import MerchantStylesPage from './page';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => '/merchant/styles',
  useRouter: () => ({ push }),
}));

describe('MerchantStylesPage', () => {
  function renderPage() {
    return render(
      <LanguageProvider initialLanguage="en" role="merchant">
        <MerchantStylesPage />
      </LanguageProvider>
    );
  }

  beforeEach(() => {
    push.mockReset();
    resetRepositoriesForTests();
    resetStyleMediaStorageForTests();
  });

  it('shows one image upload tile and cards without the old embedded review form', async () => {
    renderPage();

    expect(screen.getByRole('heading', { name: /style library/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/upload a new design/i)).toBeInTheDocument();
    expect(screen.getByText('＋')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /style title/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/service breakdown/i)).not.toBeInTheDocument();
    expect(await screen.findByText('Rose cat-eye')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /preview/i })).not.toBeInTheDocument();
    // Published styles open the editor via "Edit" (they're revisable now, not read-only).
    expect(screen.getAllByRole('link', { name: /edit/i })[0]).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/merchant\/styles\/.+\/review$/),
    );
  });

  it('uploads a selected image and navigates immediately to its review route', async () => {
    renderPage();
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
