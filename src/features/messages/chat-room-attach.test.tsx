import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { LanguageProvider } from '@/i18n/context';
import type { Conversation } from '@/domain/nail';
import { ChatRoom, type AttachableStyle } from './ChatRoom';

const conversation = {
  id: 'conv-1',
  participantName: 'Nailed-it Studio',
  participantRole: 'merchant',
  avatarInitials: 'NS',
  unreadCount: 0,
  messages: [{ id: 'm1', author: 'them', body: 'hi', sentAt: 'Now' }],
} as unknown as Conversation;

const saved: AttachableStyle[] = [
  { styleId: 's1', title: '温柔奶法式', imageUrl: 'https://example.com/1.png', reason: '法式风 · 裸色' },
];

function wrap(ui: React.ReactNode) {
  return render(
    <LanguageProvider initialLanguage="en" role="customer">
      {ui}
    </LanguageProvider>
  );
}

describe('ChatRoom style attachment', () => {
  it('opens the picker and attaches a saved style', async () => {
    const onAttachStyle = vi.fn();
    const user = userEvent.setup();
    wrap(
      <ChatRoom conversation={conversation} onSend={vi.fn()} viewerRole="customer" attachableStyles={saved} onAttachStyle={onAttachStyle} />
    );

    await user.click(screen.getByRole('button', { name: 'Attach a style' }));
    await user.click(screen.getByRole('button', { name: /温柔奶法式/ }));

    expect(onAttachStyle).toHaveBeenCalledWith(saved[0]);
  });

  it('shows a hint when there are no saved styles', async () => {
    const user = userEvent.setup();
    wrap(
      <ChatRoom conversation={conversation} onSend={vi.fn()} viewerRole="customer" attachableStyles={[]} onAttachStyle={vi.fn()} />
    );

    await user.click(screen.getByRole('button', { name: 'Attach a style' }));
    expect(screen.getByText(/No saved styles yet/i)).toBeInTheDocument();
  });

  it('keeps the paperclip decorative (no attach button) when onAttachStyle is absent', () => {
    wrap(<ChatRoom conversation={conversation} onSend={vi.fn()} viewerRole="merchant" />);
    expect(screen.queryByRole('button', { name: 'Attach a style' })).not.toBeInTheDocument();
  });
});
