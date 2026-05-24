import { render, screen } from '@testing-library/react';
import StyleDetailPage from './page';
import { findStyleById, getStyleDefinitionById } from '@/mock/styles';
import { getCustomerBookingPath, getMockSession } from '@/domain/session';

describe('StyleDetailPage', () => {
  it('renders style detail content from the shared style source of truth', async () => {
    const style = findStyleById('rose-cat-eye');
    const definition = getStyleDefinitionById('rose-cat-eye');

    expect(style).toBeDefined();
    expect(definition).toBeDefined();

    render(await StyleDetailPage({ params: Promise.resolve({ id: 'rose-cat-eye' }) }));

    expect(
      screen.getByRole('heading', {
        name: new RegExp(style?.title ?? '', 'i')
      })
    ).toBeInTheDocument();
    expect(screen.getByText(definition?.recognition.selection.otherNotes ?? '')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(String(style?.previewQuote.price ?? ''), 'i'))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to discovery/i })).toHaveAttribute(
      'href',
      getMockSession('customer').homePath
    );
    expect(screen.getByRole('link', { name: /booking flow/i })).toHaveAttribute(
      'href',
      getCustomerBookingPath()
    );
  });
});
