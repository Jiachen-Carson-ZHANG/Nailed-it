import { LanguageProvider } from '@/i18n/context';
import { SavedStylesProvider } from '@/features/customer/SavedStylesContext';
import { CurrencyProvider } from '@/i18n/currency-context';

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider role="customer">
      <CurrencyProvider>
        <SavedStylesProvider>{children}</SavedStylesProvider>
      </CurrencyProvider>
    </LanguageProvider>
  );
}
