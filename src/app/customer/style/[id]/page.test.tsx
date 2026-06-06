import { render, screen } from '@testing-library/react';
import StyleDetailPage from './page';
import { findStyleById, getStyleDefinitionById } from '@/mock/styles';
import { getCustomerBookingPath, getMockSession } from '@/domain/session';

describe('StyleDetailPage', () => {
  it('renders a published merchant style from the DB-backed source', async () => {
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
    expect(screen.getAllByText(new RegExp(String(style?.previewQuote.price ?? ''), 'i')).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /back to discovery/i })).toHaveAttribute(
      'href',
      getMockSession('customer').homePath
    );
    expect(screen.getByRole('link', { name: /book this look/i })).toHaveAttribute(
      'href',
      `${getCustomerBookingPath()}?styleId=rose-cat-eye`
    );
  });

  it('wires the published catalog breakdown + discovery facets into the detail box', async () => {
    render(await StyleDetailPage({ params: Promise.resolve({ id: 'rose-cat-eye' }) }));

    // Composition (款式构成) comes from the catalog breakdown — the seeded base manicure layer.
    expect(screen.getByRole('heading', { name: '款式构成' })).toBeInTheDocument();
    expect(screen.getByText('基础护理服务')).toBeInTheDocument();

    // Discovery facets render as grouped style tags (风格标签).
    expect(screen.getByRole('heading', { name: '风格标签' })).toBeInTheDocument();
    expect(screen.getAllByText('Cat eye').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Rhinestone').length).toBeGreaterThan(0);
  });
});
