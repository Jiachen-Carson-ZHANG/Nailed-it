import { LanguageProvider } from '@/i18n/context';
import { CurrencyProvider } from '@/i18n/currency-context';

export default function MerchantLayout({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider role="merchant">
      <CurrencyProvider>{children}</CurrencyProvider>
    </LanguageProvider>
  );
}
