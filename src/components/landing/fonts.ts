import localFont from 'next/font/local';

export const landingSerif = localFont({
  src: [
    {
      path: '../../../landing_assets/fonts/SourceHanSerifSC-Regular.otf',
      weight: '400',
      style: 'normal'
    },
    {
      path: '../../../landing_assets/fonts/SourceHanSerifSC-Bold.otf',
      weight: '700',
      style: 'normal'
    },
    {
      path: '../../../landing_assets/fonts/SourceHanSerifSC-Heavy.otf',
      weight: '800',
      style: 'normal'
    }
  ],
  variable: '--font-landing-serif',
  display: 'swap'
});
