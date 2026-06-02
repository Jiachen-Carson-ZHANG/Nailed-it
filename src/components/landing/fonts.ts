import localFontModule from 'next/font/local';

type LocalFontLoader = typeof import('next/font/local').default;
type LocalFontResult = ReturnType<LocalFontLoader>;

function resolveLocalFontLoader() {
  // Vitest 下 next/font/local 可能被包装成双层 default，这里做一次兼容解包。
  const maybeWrappedLoader = localFontModule as
    | LocalFontLoader
    | { default?: LocalFontLoader }
    | undefined;

  if (typeof maybeWrappedLoader === 'function') {
    return maybeWrappedLoader;
  }

  if (typeof maybeWrappedLoader?.default === 'function') {
    return maybeWrappedLoader.default;
  }

  return null;
}

const localFont = resolveLocalFontLoader();

const landingSerifConfig = {
  src: [
    {
      path: '../../../docs/assets/fonts/SourceHanSerifSC-Regular.otf',
      weight: '400',
      style: 'normal'
    },
    {
      path: '../../../docs/assets/fonts/SourceHanSerifSC-Bold.otf',
      weight: '700',
      style: 'normal'
    },
    {
      path: '../../../docs/assets/fonts/SourceHanSerifSC-Heavy.otf',
      weight: '800',
      style: 'normal'
    }
  ],
  variable: '--font-landing-serif',
  display: 'swap'
} as const;

function createFontFallback(): LocalFontResult {
  // 测试环境只需要稳定的类名形态，保证 landingSerif.variable 仍可安全作为 className 使用。
  return {
    className: 'font-landing-serif',
    style: { fontFamily: '"Source Han Serif SC", serif' },
    variable: 'font-landing-serif-variable'
  };
}

export const landingSerif = localFont ? localFont(landingSerifConfig) : createFontFallback();
