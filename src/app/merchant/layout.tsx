import { LanguageProvider } from '@/i18n/context';

export default function MerchantLayout({ children }: { children: React.ReactNode }) {
  return <LanguageProvider role="merchant">{children}</LanguageProvider>;
}
