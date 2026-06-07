-- 0019_message_style_attachment.sql
-- Lets a chat message carry a structured style recommendation (the merchant's 发送 from the
-- customer-intelligence panel) so the thread can render a rich style card, not just text.
-- Nullable + backward-compatible: existing text messages keep attachment = null.
--
-- Shape (jsonb): { "type": "style", "styleId": text, "title": text, "imageUrl": text }
-- Server-only writes via the service client (messages RLS unchanged).

alter table public.messages
  add column if not exists attachment jsonb;
