import { notFound } from 'next/navigation';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { getRouteIntent, homePathForRole } from '@/domain/session';
import { StyleDetailPanel } from '@/features/customer/StyleDetailPanel';
import { findStyleById, getStyleDefinitionById } from '@/mock/styles';

type StyleDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function StyleDetailPage({ params }: StyleDetailPageProps) {
  const { id } = await params;
  const style = findStyleById(id);
  const definition = getStyleDefinitionById(id);

  // 中文注释：详情页需要卡片级报价和识别结果两类数据，分别从共享 helper 与原始定义读取，
  // 保持所有展示仍然回到同一份 mock style source-of-truth，而不是在页面里重新拼数据。
  if (!style || !definition) {
    notFound();
  }

  return (
    <MobileLayout
      brandHref={homePathForRole('customer')}
      role="customer"
      showTabs={false}
      subtitle="Detail view wired to the current mock recognition and quote contracts."
      title="Nailed-it"
    >
      <StyleDetailPanel
        backHref={homePathForRole('customer')}
        bookingIntent={getRouteIntent('customer', 'booking')}
        recognition={definition.recognition}
        style={style}
      />
    </MobileLayout>
  );
}
