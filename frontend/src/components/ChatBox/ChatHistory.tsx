import { useEffect, useState } from 'react';
import { Trash2, MessageCircle, Plus } from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import type { Conversation } from '../../types/chat';

interface ChatHistoryProps {
  onSelectConversation: (conversation: Conversation) => void;
  currentConversationId: string | null;
  onNewChat: () => void;
}

export function ChatHistory({
  onSelectConversation,
  currentConversationId,
  onNewChat,
}: ChatHistoryProps) {
  const { conversations, loadConversations, deleteConversation } = useChatStore();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        await loadConversations();
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [loadConversations]);

  const handleDelete = async (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    if (confirm('Delete this conversation?')) {
      await deleteConversation(conversationId);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getTitle = (conversation: Conversation) => {
    if (conversation.title) {
      return conversation.title.length > 30
        ? conversation.title.substring(0, 30) + '...'
        : conversation.title;
    }
    return 'New conversation';
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-800">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl transition-all font-medium shadow-md hover:shadow-lg"
        >
          <Plus size={18} />
          New Chat
        </button>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && conversations.length === 0 ? (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400">
            <MessageCircle size={32} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm">Loading conversations...</p>
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 mx-auto mb-3 flex items-center justify-center">
              <MessageCircle size={28} className="opacity-50" />
            </div>
            <p className="text-sm font-medium">No conversations yet</p>
            <p className="text-xs mt-1">Start a new chat to begin</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => onSelectConversation(conversation)}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all text-left group ${
                  currentConversationId === conversation.id
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-sm">
                    {getTitle(conversation)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {formatDate(conversation.updatedAt)}
                    {conversation.messageCount ? ` • ${conversation.messageCount} messages` : ''}
                  </p>
                </div>
                <button
                  onClick={(e) => handleDelete(e, conversation.id)}
                  className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500 rounded-lg transition-all"
                  aria-label="Delete conversation"
                >
                  <Trash2 size={14} />
                </button>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
