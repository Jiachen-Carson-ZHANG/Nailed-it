import { MobileLayout } from '@/components/layout/MobileLayout';
import { AgentRunDetailClient } from '@/features/merchant/AgentRunDetailClient';

export default async function AgentRunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <MobileLayout role="merchant" title="Nailed-it">
      <AgentRunDetailClient runId={id} />
    </MobileLayout>
  );
}
