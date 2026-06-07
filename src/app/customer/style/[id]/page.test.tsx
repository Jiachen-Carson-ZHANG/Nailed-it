import { render, screen } from '@testing-library/react';
import { LanguageProvider } from '@/i18n/context';
import StyleDetailPage from './page';
import { getStyleDefinitionById } from '@/mock/styles';
import { mockMerchantStyles } from '@/mock/merchant-styles';
import { getCustomerBookingPath, getMockSession } from '@/domain/session';

describe('StyleDetailPage', () => {
  async function renderStyleDetailPage() {
    return render(
      <LanguageProvider initialLanguage="zh-CN" role="customer">
        {await StyleDetailPage({ params: Promise.resolve({ id: 'rose-cat-eye' }) })}
      </LanguageProvider>
    );
  }

  it('renders a published merchant style from the DB-backed source', async () => {
    const style = mockMerchantStyles.find((candidate) => candidate.id === 'rose-cat-eye');
    const definition = getStyleDefinitionById('rose-cat-eye');

    expect(style).toBeDefined();
    expect(definition).toBeDefined();

    await renderStyleDetailPage();

    expect(
      screen.getByRole('heading', {
        name: new RegExp(style?.title ?? '', 'i')
      })
    ).toBeInTheDocument();
    expect(screen.getByText(style?.descriptionLocalized.en ?? '')).toBeInTheDocument();
    expect(
      screen.getAllByText(new RegExp(String((style?.previewPriceCents ?? 0) / 100), 'i')).length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(`${style?.previewDurationMin} 分钟`).length).toBeGreaterThan(0);
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
    await renderStyleDetailPage();

    // Composition (款式构成) comes from the catalog breakdown — the seeded base manicure layer.
    expect(screen.getByRole('heading', { name: '款式构成' })).toBeInTheDocument();
    expect(screen.getByText('基础护理服务')).toBeInTheDocument();

    // Discovery facets render as grouped style tags (风格标签).
    expect(screen.getByRole('heading', { name: '风格标签' })).toBeInTheDocument();
    expect(screen.getAllByText('Cat eye').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Rhinestone').length).toBeGreaterThan(0);
  });
});
