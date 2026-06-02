import type { Metadata } from 'next';
import localFont from 'next/font/local';
import type { ReactNode } from 'react';
import './globals.css';

const sourceHanSerif = localFont({
  src: '../../docs/assets/fonts/SourceHanSerifSC-Heavy.otf',
  variable: '--font-display'
});

export const metadata: Metadata = {
  title: 'Nailed-it',
  description: 'AI-driven nail booking, pricing, and style operations.'
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="zh-CN">
      <body className={sourceHanSerif.variable}>{children}</body>
    </html>
  );
}
