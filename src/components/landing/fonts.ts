import localFont from 'next/font/local';

export const landingSerif = localFont({
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
});
