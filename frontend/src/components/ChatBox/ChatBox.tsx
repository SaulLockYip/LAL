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
  inline?: boolean;
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

export function ChatBox({ inline = false, userInfo, articleContext, wordListContext }: ChatBoxProps) {
  const [isOpen, setIsOpen] = useState(!inline);
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

  // Keyboard shortcuts - Escape to close (only when not inline)
  useEffect(() => {
    if (inline) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, inline]);

  // Prevent body scroll when panel is open (only when not inline)
  useEffect(() => {
    if (inline) return;
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, inline]);

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

      {/* Floating Action Button - hidden when inline */}
      {!inline && (
        <button
          onClick={() => setIsOpen(true)}
          className={`fixed z-50 group ${
            isMobile
              ? 'bottom-4 right-4 p-3.5'
              : 'bottom-6 right-6 p-4'
          }`}
          aria-label="Open chat"
        >
          <div className="relative">
            {/* Glow effect */}
            <div className={`absolute -inset-1 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full blur opacity-30 group-hover:opacity-50 transition-opacity duration-300 ${isOpen ? 'hidden' : ''}`} />
            {/* Button */}
            <div className={`relative flex items-center justify-center rounded-full shadow-lg hover:shadow-xl transition-all duration-200 ${
              isOpen
                ? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                : 'bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white'
            }`}>
              {isOpen ? (
                <X size={isMobile ? 22 : 24} />
              ) : (
                <>
                  <MessageCircle size={isMobile ? 22 : 24} />
                  {/* Notification dot */}
                  {messages.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-gray-900" />
                  )}
                </>
              )}
            </div>
          </div>
        </button>
      )}

      {/* Backdrop (mobile) - hidden when inline */}
      {!inline && isOpen && isMobile && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Chat Panel */}
      <div
        ref={panelRef}
        className={`${inline ? 'flex flex-col h-full' : 'fixed top-0 right-0 h-full'} bg-white dark:bg-gray-900 ${inline ? '' : 'z-50 transform transition-all duration-300 ease-out'} flex flex-col border-l border-gray-200 dark:border-gray-700 ${
          inline ? '' : isMobile ? 'w-full' : 'w-[420px]'
        } ${
          inline ? '' : isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          boxShadow: inline ? 'none' : (isOpen ? '-8px 0 40px rgba(0, 0, 0, 0.15)' : 'none'),
        }}
        role="dialog"
        aria-label="AI Assistant Chat"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-white dark:from-gray-900 to-gray-50 dark:to-gray-850">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
              aria-label="Toggle history"
            >
              {showHistory ? <PanelLeftClose size={20} /> : <PanelLeft size={20} />}
            </button>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md">
              <Bot size={20} className="text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">AI Assistant</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Powered by LLM</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ChatContextPicker
              value={contextType}
              onChange={setContextType}
              disabled={isLoading}
            />
            {!inline && (
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
                aria-label="Close chat"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex overflow-hidden bg-gray-50 dark:bg-gray-900">
          {/* History Sidebar (desktop) */}
          <div
            className={`${
              showHistory ? 'w-72' : 'w-0'
            } transition-all duration-300 overflow-hidden flex-shrink-0 border-r border-gray-200 dark:border-gray-700 hidden md:block bg-white dark:bg-gray-900`}
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
              className="flex-1 overflow-y-auto p-5 space-y-5 scroll-smooth"
              style={{
                background: 'linear-gradient(180deg, transparent 0%, rgba(255,255,255,0) 100%), radial-gradient(at 0% 0%, rgba(59, 130, 246, 0.03) 0%, transparent 50%)',
              }}
            >
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                  <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 flex items-center justify-center mb-5">
                    <Bot size={36} className="text-blue-500 opacity-60" />
                  </div>
                  <p className="font-semibold text-gray-700 dark:text-gray-200 text-lg">Start a conversation</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-xs">
                    Ask me anything about language learning, articles, or vocabulary.
                  </p>
                  {contextType !== 'global' && (
                    <div className="mt-4 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-full">
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                        Context: {contextType === 'article' ? 'Article' : contextType === 'word_list' ? 'Word List' : 'Exercises'}
                      </p>
                    </div>
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
                <div className="flex gap-3 animate-in fade-in slide-in-from-bottom-1 duration-200">
                  <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-sm">
                    <Bot size={18} className="text-white" />
                  </div>
                  <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl rounded-tl-md px-4 py-3 max-w-[85%] shadow-sm">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-gray-700 dark:text-gray-200">{streamedContent}</p>
                      <span className="inline-block animate-pulse">▊</span>
                    </div>
                  </div>
                </div>
              )}

              {isLoading && !streamedContent && (
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-sm">
                    <Bot size={18} className="text-white" />
                  </div>
                  <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl rounded-tl-md px-4 py-3 shadow-sm">
                    <Loader2 className="animate-spin text-blue-500" size={20} />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
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
              <div className="px-5 pb-3 text-xs text-gray-400 dark:text-gray-500 flex items-center justify-between">
                <span className="hidden sm:inline">
                  <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs border border-gray-200 dark:border-gray-700">Ctrl</kbd>
                  {' + '}
                  <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs border border-gray-200 dark:border-gray-700">Enter</kbd>
                  {' to send'}
                </span>
                <span>
                  <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs border border-gray-200 dark:border-gray-700">↑</kbd>
                  {' to edit last'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
