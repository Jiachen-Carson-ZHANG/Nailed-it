import { render, screen } from '@testing-library/react';
import { LanguageProvider } from '@/i18n/context';
import { StyleAdEditorPageClient } from './style-ad-editor-page-client';

describe('StyleAdEditorPageClient', () => {
  function renderPage(styleId = 'rose-cat-eye') {
    return render(
      <LanguageProvider initialLanguage="en" role="merchant">
        <StyleAdEditorPageClient styleId={styleId} />
      </LanguageProvider>,
    );
  }

  it('shows placeholder editor for an active campaign', async () => {
    renderPage();

    expect(screen.getByRole('heading', { name: /style promotion/i })).toBeInTheDocument();
    expect(await screen.findByText('Rose cat-eye')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /choose promotion goal/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /homepage exposure/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /booking conversion/i })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('heading', { name: /promotion settings/i })).toBeInTheDocument();
    expect(screen.getByText('Start time')).toBeInTheDocument();
    expect(screen.getByText('Start now')).toBeInTheDocument();
    expect(screen.getByText('Duration')).toBeInTheDocument();
    expect(screen.getByText('7 days')).toBeInTheDocument();
    expect(screen.getByText('Audience')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /smart recommendation/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /custom audience/i })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText(/estimated exposure lift/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /launch campaign/i })).toBeEnabled();
  });

  it('shows draft placeholder for styles without an active campaign', async () => {
    renderPage('chrome-mirror');

    expect(await screen.findByText('Mirror chrome almond')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /launch campaign/i })).toBeEnabled();
  });
});
