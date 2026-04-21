import { useState, useCallback } from 'react';
import { MessageList } from './MessageList';
import { MessageDetail } from './MessageDetail';

export function MessageCenter() {
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);

  const handleMessageClick = useCallback((messageId: string) => {
    setSelectedMessageId(messageId);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedMessageId(null);
  }, []);

  if (selectedMessageId) {
    return <MessageDetail messageId={selectedMessageId} onBack={handleBack} />;
  }

  return (
    <MessageList onMessageClick={handleMessageClick} />
  );
}

export default MessageCenter;
