import { SavedStylesProvider } from '@/features/customer/SavedStylesContext';

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return <SavedStylesProvider>{children}</SavedStylesProvider>;
}
