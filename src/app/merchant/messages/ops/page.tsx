import Link from 'next/link';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { getMerchantMessagesPath } from '@/domain/session';
import { OpsBotThread } from '@/features/merchant/OpsBotThread';

// Static segment — takes precedence over [conversationId], so /merchant/messages/ops is the bot,
// not a customer thread lookup.
export default function MerchantOpsBotPage() {
  return (
    <MobileLayout role="merchant" title="Nailed-it">
      <section className="page-heading opsbot-header">
        <span className="opsbot-avatar" aria-hidden>AI</span>
        <div>
          <h1>Nailed AI 运营助手</h1>
          <p className="section-copy">每日 / 每周经营快报 · 数据来自真实埋点</p>
        </div>
      </section>

      <OpsBotThread />

      <Link className="button button-secondary button-block" href={getMerchantMessagesPath()}>
        ← 返回消息
      </Link>
    </MobileLayout>
  );
}
