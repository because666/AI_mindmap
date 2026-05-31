import { useState, useCallback } from 'react';
import { MessageList } from './MessageList';
import { MessageDetail } from './MessageDetail';

interface MessageCenterProps {
  onUnreadCountChange?: (count: number) => void;
}

export function MessageCenter({ onUnreadCountChange }: MessageCenterProps) {
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
    <MessageList onMessageClick={handleMessageClick} onUnreadCountChange={onUnreadCountChange} />
  );
}

export default MessageCenter;
