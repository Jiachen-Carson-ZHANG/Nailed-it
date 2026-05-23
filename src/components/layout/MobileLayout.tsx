import type { ReactNode } from 'react';
import type { UserRole } from '@/domain/nail';
import { BottomTabBar } from './BottomTabBar';
import { TopBar } from './TopBar';

type MobileLayoutProps = {
  children: ReactNode;
  role: UserRole;
  showTabs?: boolean;
  subtitle?: string;
  title?: string;
};

export function MobileLayout({
  children,
  role,
  showTabs = true,
  subtitle,
  title
}: MobileLayoutProps) {
  return (
    <div className="mobile-shell">
      <TopBar subtitle={subtitle} title={title} />
      <main className={showTabs ? 'mobile-content mobile-content-with-tabs' : 'mobile-content'}>
        {children}
      </main>
      {showTabs ? <BottomTabBar role={role} /> : null}
    </div>
  );
}
