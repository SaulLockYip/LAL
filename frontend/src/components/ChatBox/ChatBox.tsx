import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Bot, Loader2, PanelLeftClose, PanelLeft } from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { ChatHistory } from './ChatHistory';
import { ChatContextPicker, type ContextType } from './ChatContextPicker';
import { ChatToastContainer, chatToast } from './ChatToast';
import { streamChat } from '../../services/chatApi';
import type { ChatContext, Conversation } from '../../types/chat';

interface ChatMessageData {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatBoxProps {
  userInfo?: {
    targetLanguage: string;
    nativeLanguage: string;
    currentLevel: string;
  };
  articleContext?: {
    articleId: string;
    articleTitle: string;
    articleContent: string;
  };
  wordListContext?: {
    wordList: string[];
  };
}

export function ChatBox({ userInfo, articleContext, wordListContext }: ChatBoxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamedContent, setStreamedContent] = useState('');
  const [contextType, setContextType] = useState<ContextType>('global');
  const [showHistory, setShowHistory] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const streamedContentRef = useRef('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const lastUserMessageRef = useRef<string>('');
  const isAtBottomRef = useRef(true);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-scroll logic - only if user is already at bottom
  const scrollToBottom = useCallback(() => {
    if (isAtBottomRef.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, []);

  // Check if user is at bottom of messages
  const checkIfAtBottom = useCallback(() => {
    if (!messagesContainerRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 50;
  }, []);

  useEffect(() => {
    checkIfAtBottom();
    scrollToBottom();
  }, [messages, streamedContent, checkIfAtBottom, scrollToBottom]);

  // Track scroll position
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      checkIfAtBottom();
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [checkIfAtBottom]);

  // Keyboard shortcuts - Escape to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  // Prevent body scroll when panel is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const buildContext = (): ChatContext => {
    const context: ChatContext = {
      type: contextType,
      userInfo,
    };

    if (contextType === 'article' && articleContext) {
      context.articleId = articleContext.articleId;
      context.articleTitle = articleContext.articleTitle;
      context.articleContent = articleContext.articleContent;
    } else if (contextType === 'word_list' && wordListContext) {
      context.wordList = wordListContext.wordList;
    }

    return context;
  };

  const handleRegenerate = async () => {
    if (!lastUserMessageRef.current || isLoading) return;

    // Remove the last assistant message if exists
    if (messages.length >= 2 && messages[messages.length - 1].role === 'assistant') {
      setMessages((prev) => prev.slice(0, -1));
    }

    // Re-send the last user message
    const userMessage = lastUserMessageRef.current;
    setInput('');
    await sendMessage(userMessage, true);
  };

  const sendMessage = async (content: string, isRegenerate = false) => {
    if (!content.trim() || isLoading) return;

    const userMessage: ChatMessageData = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    if (!isRegenerate) {
      setMessages((prev) => [...prev, userMessage]);
      lastUserMessageRef.current = content.trim();
    }
    setInput('');
    setIsLoading(true);
    setStreamedContent('');
    streamedContentRef.current = '';

    try {
      const context = buildContext();

      // Create assistant message placeholder
      const assistantMessageId = crypto.randomUUID();
      const assistantMessage: ChatMessageData = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Use streaming
      await streamChat({
        message: content.trim(),
        context,
        onChunk: (chunk) => {
          streamedContentRef.current += chunk;
          setStreamedContent(streamedContentRef.current);
        },
        onComplete: (fullResponse) => {
          // Finalize the message with full content
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: fullResponse }
                : msg
            )
          );
          chatToast.success('Response complete');
        },
        onError: (error) => {
          throw error;
        },
      });
    } catch (error) {
      // Remove the placeholder message on error
      setMessages((prev) => prev.slice(0, -1));

      const errorMessage: ChatMessageData = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${
          error instanceof Error ? error.message : 'Unknown error'
        }. Please try again.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      chatToast.error('Failed to send message');
    } finally {
      setIsLoading(false);
      setStreamedContent('');
    }
  };

  const handleSend = () => {
    sendMessage(input);
  };

  const handleEditLastMessage = (content: string) => {
    setInput(content);
  };

  const handleSelectConversation = (conversation: Conversation) => {
    // For now, we'll just close the history panel and start fresh
    // In a full implementation, you would load the conversation messages
    setShowHistory(false);
    chatToast.info(`Conversation: ${conversation.title || 'Loaded'}`);
  };

  const handleNewChat = () => {
    setMessages([]);
    setInput('');
    lastUserMessageRef.current = '';
    setShowHistory(false);
    chatToast.info('Started new chat');
  };

  const isLastAssistantMessage = (index: number) => {
    const message = messages[index];
    if (message.role !== 'assistant') return false;
    // Check if this is the last assistant message
    return index === messages.length - 1 || messages.slice(index + 1).every(m => m.role !== 'assistant');
  };

  return (
    <>
      <ChatToastContainer />

      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed z-50 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 ${
          isMobile
            ? 'bottom-4 right-4 p-3'
            : 'bottom-6 right-6 p-4'
        }`}
        aria-label="Open chat"
      >
        <MessageCircle size={isMobile ? 22 : 24} />
      </button>

      {/* Backdrop (mobile) */}
      {isOpen && isMobile && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Chat Panel */}
      <div
        ref={panelRef}
        className={`fixed top-0 h-full bg-white dark:bg-gray-900 shadow-2xl z-50 transform transition-all duration-300 ease-out flex flex-col ${
          isMobile ? 'w-full' : 'w-96'
        } ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-label="AI Assistant Chat"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors md:hidden"
              aria-label="Toggle history"
            >
              {showHistory ? <PanelLeftClose size={20} /> : <PanelLeft size={20} />}
            </button>
            <Bot className="text-blue-500" size={24} />
            <h2 className="font-semibold text-lg">AI Assistant</h2>
          </div>
          <div className="flex items-center gap-2">
            <ChatContextPicker
              value={contextType}
              onChange={setContextType}
              disabled={isLoading}
            />
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Close chat"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex overflow-hidden">
          {/* History Sidebar (desktop always visible on md+, mobile toggle) */}
          <div
            className={`${
              showHistory ? 'w-72' : 'w-0'
            } transition-all duration-300 overflow-hidden flex-shrink-0 border-r border-gray-200 dark:border-gray-700 hidden md:block`}
          >
            <div className={`w-72 h-full ${showHistory ? 'opacity-100' : 'opacity-0'}`}>
              <ChatHistory
                onSelectConversation={handleSelectConversation}
                currentConversationId={null}
                onNewChat={handleNewChat}
              />
            </div>
          </div>

          {/* Mobile History Sidebar (overlay) */}
          {showHistory && isMobile && (
            <div className="absolute inset-0 bg-white dark:bg-gray-900 z-10 w-full">
              <ChatHistory
                onSelectConversation={handleSelectConversation}
                currentConversationId={null}
                onNewChat={handleNewChat}
              />
            </div>
          )}

          {/* Messages Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Messages */}
            <div
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto p-4 space-y-4"
            >
              {messages.length === 0 && (
                <div className="text-center text-gray-500 dark:text-gray-400 py-12">
                  <Bot size={48} className="mx-auto mb-4 opacity-50" />
                  <p className="font-medium">Start a conversation</p>
                  <p className="text-sm mt-2">
                    Ask me anything about language learning, articles, or vocabulary.
                  </p>
                  {contextType !== 'global' && (
                    <p className="text-xs mt-4 text-blue-500">
                      Context: {contextType === 'article' ? 'Article' : contextType === 'word_list' ? 'Word List' : 'Exercises'}
                    </p>
                  )}
                </div>
              )}

              {messages.map((message, index) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  isLastAssistantMessage={isLastAssistantMessage(index)}
                  onRegenerate={isLastAssistantMessage(index) && messages.length > 1 ? handleRegenerate : undefined}
                />
              ))}

              {/* Streaming indicator */}
              {isLoading && streamedContent && (
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                    <Bot size={18} className="text-blue-500" />
                  </div>
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-tl-none px-4 py-3 max-w-[80%]">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <p className="whitespace-pre-wrap">{streamedContent}</p>
                      <span className="inline-block animate-pulse">▊</span>
                    </div>
                  </div>
                </div>
              )}

              {isLoading && !streamedContent && (
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                    <Bot size={18} className="text-blue-500" />
                  </div>
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-tl-none px-4 py-3">
                    <Loader2 className="animate-spin text-blue-500" size={20} />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <ChatInput
              value={input}
              onChange={setInput}
              onSend={handleSend}
              onEditLastMessage={handleEditLastMessage}
              disabled={isLoading}
              placeholder={
                contextType === 'article'
                  ? 'Ask about the article...'
                  : contextType === 'word_list'
                  ? 'Ask about vocabulary...'
                  : contextType === 'exercises'
                  ? 'Ask about exercises...'
                  : 'Ask about language learning...'
              }
              lastUserMessage={lastUserMessageRef.current}
            />

            {/* Keyboard shortcuts hint */}
            <div className="px-4 pb-2 text-xs text-gray-400 dark:text-gray-500 flex items-center justify-between">
              <span className="hidden sm:inline">
                <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs">Ctrl</kbd>
                {' + '}
                <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs">Enter</kbd>
                {' to send'}
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs">↑</kbd>
                {' to edit'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
