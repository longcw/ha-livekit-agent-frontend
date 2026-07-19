import { useState } from 'react';
import { useChat } from '@livekit/components-react';

/** Text input — sends a chat message to the agent over the LiveKit chat channel. */
export function ChatInput() {
  const { send } = useChat();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const disabled = sending || message.trim().length === 0;

  const submit = async () => {
    if (disabled) return;
    setSending(true);
    try {
      await send(message.trim());
      setMessage('');
    } catch (e) {
      console.error('chat send failed', e);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="lk-input">
      <textarea
        value={message}
        placeholder="Type a message…"
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
      />
      <button className="lk-btn" disabled={disabled} onClick={submit}>
        {sending ? '…' : 'Send'}
      </button>
    </div>
  );
}
