import { LanguageProvider } from '@/i18n/context';
import { SavedStylesProvider } from '@/features/customer/SavedStylesContext';

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider role="customer">
      <SavedStylesProvider>{children}</SavedStylesProvider>
    </LanguageProvider>
  );
}
