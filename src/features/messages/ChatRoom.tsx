import type { Conversation } from '@/domain/nail';

type ChatRoomProps = {
  conversation: Conversation;
};

export function ChatRoom({ conversation }: ChatRoomProps) {
  return (
    <section className="chat-room" aria-labelledby={`chat-room-${conversation.id}`}>
      <div className="chat-room-header">
        <div>
          <p className="section-eyebrow">Conversation</p>
          <h1 id={`chat-room-${conversation.id}`}>{conversation.participantName}</h1>
        </div>
        {conversation.relatedBookingTime ? (
          <span className="chat-room-booking-pill">{conversation.relatedBookingTime}</span>
        ) : null}
      </div>

      <div className="chat-thread" aria-label={`${conversation.participantName} messages`}>
        {conversation.messages.map((message) => {
          // 中文注释：消息展示只依赖 author 这个稳定字段，避免页面层重复维护左右气泡规则。
          const bubbleClassName =
            message.author === 'me'
              ? 'chat-bubble chat-bubble-me'
              : message.author === 'system'
                ? 'chat-bubble chat-bubble-system'
                : 'chat-bubble chat-bubble-them';

          return (
            <article key={message.id} className={`chat-message chat-message-${message.author}`}>
              <div className={bubbleClassName}>
                <p>{message.body}</p>
                <span>{message.sentAt}</span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
