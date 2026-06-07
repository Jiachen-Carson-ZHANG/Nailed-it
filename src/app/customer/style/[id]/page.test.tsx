import { render, screen } from '@testing-library/react';
import { LanguageProvider } from '@/i18n/context';
import StyleDetailPage from './page';
import { getStyleDefinitionById } from '@/mock/styles';
import { mockMerchantStyles } from '@/mock/merchant-styles';
import { getCustomerBookingPath, getMockSession } from '@/domain/session';

describe('StyleDetailPage', () => {
  async function renderStyleDetailPage(language: 'zh-CN' | 'en' = 'zh-CN') {
    return render(
      <LanguageProvider initialLanguage={language} role="customer">
        {await StyleDetailPage({ params: Promise.resolve({ id: 'rose-cat-eye' }) })}
      </LanguageProvider>
    );
  }

  it('renders a published merchant style in Chinese by default', async () => {
    const style = mockMerchantStyles.find((candidate) => candidate.id === 'rose-cat-eye');

    expect(style).toBeDefined();

    await renderStyleDetailPage();

    expect(
      screen.getByRole('heading', {
        name: new RegExp(style?.titleLocalized['zh-CN'] ?? '', 'i')
      })
    ).toBeInTheDocument();
    expect(screen.getByText(style?.descriptionLocalized['zh-CN'] ?? '')).toBeInTheDocument();
    expect(screen.getAllByText('¥28.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText(`${style?.previewDurationMin} 分钟`).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /返回发现页/i })).toHaveAttribute(
      'href',
      getMockSession('customer').homePath
    );
    expect(screen.getByRole('link', { name: /按这个款式预约/i })).toHaveAttribute(
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

  it('renders localized style copy and labels in English', async () => {
    const style = mockMerchantStyles.find((candidate) => candidate.id === 'rose-cat-eye');
    const definition = getStyleDefinitionById('rose-cat-eye');

    expect(style).toBeDefined();
    expect(definition).toBeDefined();

    await renderStyleDetailPage('en');

    expect(screen.getByRole('heading', { name: style?.titleLocalized.en ?? '' })).toBeInTheDocument();
    expect(screen.getByText(style?.descriptionLocalized.en ?? '')).toBeInTheDocument();
    expect(screen.getAllByText('$28.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText(`${style?.previewDurationMin} min`).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Style breakdown' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Style tags' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to discovery/i })).toHaveAttribute(
      'href',
      getMockSession('customer').homePath
    );
    expect(screen.getByRole('link', { name: /Book this style/i })).toHaveAttribute(
      'href',
      `${getCustomerBookingPath()}?styleId=rose-cat-eye`
    );
  });
});
