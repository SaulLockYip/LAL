import { useState } from 'react';
import { Copy, Check, Bot, User, RotateCcw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { chatToast } from './ChatToast';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatMessageProps {
  message: Message;
  isLastAssistantMessage?: boolean;
  onRegenerate?: () => void;
}

export function ChatMessage({ message, isLastAssistantMessage, onRegenerate }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    chatToast.success('Message copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = () => {
    if (onRegenerate) {
      onRegenerate();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isUser = message.role === 'user';

  return (
    <div
      className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Assistant Avatar */}
      {!isUser && (
        <div className="flex-shrink-0 w-9 h-9 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 dark:from-blue-400 dark:to-indigo-500 flex items-center justify-center shadow-md">
          <Bot size={18} className="text-white" />
        </div>
      )}

      <div className="relative max-w-[85%] flex flex-col gap-1.5">
        {/* Message Bubble */}
        <div
          className={`relative px-4 py-3.5 ${
            isUser
              ? 'bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 text-white rounded-2xl rounded-tr-md'
              : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-100 rounded-2xl rounded-tl-md'
          }`}
          style={{
            boxShadow: isUser
              ? '0 4px 12px rgba(59, 130, 246, 0.35), 0 2px 4px rgba(59, 130, 246, 0.25)'
              : '0 2px 8px rgba(0, 0, 0, 0.06)',
          }}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap text-[15px] leading-[1.6] font-medium">{message.content}</p>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown
                components={{
                  h1: ({ children }) => (
                    <h1 className="text-lg font-bold mt-2 mb-2 text-gray-900 dark:text-white">{children}</h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-base font-bold mt-2 mb-1.5 text-gray-900 dark:text-white">{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-sm font-semibold mt-1.5 mb-1 text-gray-900 dark:text-white">{children}</h3>
                  ),
                  p: ({ children }) => (
                    <p className="mb-2 last:mb-0 whitespace-pre-wrap text-[14px] leading-[1.65] text-gray-700 dark:text-gray-200">{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>
                  ),
                  li: ({ children }) => <li className="text-[14px] leading-[1.6] text-gray-700 dark:text-gray-200">{children}</li>,
                  code: ({ children, className }) => {
                    const isInline = !className;
                    return isInline ? (
                      <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[13px] font-mono text-blue-600 dark:text-blue-300">
                        {children}
                      </code>
                    ) : (
                      <code className="block p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-[13px] font-mono overflow-x-auto mb-2 text-gray-800 dark:text-gray-200">
                        {children}
                      </code>
                    );
                  },
                  pre: ({ children }) => (
                    <pre className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg overflow-x-auto mb-2 text-[13px]">
                      {children}
                    </pre>
                  ),
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 hover:underline"
                    >
                      {children}
                    </a>
                  ),
                  strong: ({ children }) => <strong className="font-semibold text-gray-900 dark:text-white">{children}</strong>,
                  em: ({ children }) => <em className="italic text-gray-600 dark:text-gray-300">{children}</em>,
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-3 border-blue-200 dark:border-blue-800 pl-3 italic text-gray-600 dark:text-gray-400 my-2">
                      {children}
                    </blockquote>
                  ),
                  hr: () => <hr className="my-3 border-gray-200 dark:border-gray-700" />,
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}

          {/* Timestamp inside bubble */}
          <div
            className={`absolute -bottom-5 right-2 text-[10px] text-gray-400 dark:text-gray-500 transition-opacity ${
              showActions ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {formatTime(message.timestamp)}
          </div>
        </div>

        {/* Action Buttons */}
        <div
          className={`flex items-center gap-0.5 self-start transition-opacity ${
            showActions ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {/* Copy button */}
          <button
            onClick={handleCopy}
            className={`p-1.5 rounded-lg transition-all duration-150 hover:scale-110 ${
              isUser
                ? 'text-white/60 hover:text-white hover:bg-white/20'
                : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            aria-label="Copy message"
          >
            {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
          </button>

          {/* Regenerate button for last assistant message */}
          {!isUser && isLastAssistantMessage && onRegenerate && (
            <button
              onClick={handleRegenerate}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-150 hover:scale-110"
              aria-label="Regenerate response"
            >
              <RotateCcw size={14} />
            </button>
          )}
        </div>
      </div>

      {/* User Avatar */}
      {isUser && (
        <div className="flex-shrink-0 w-9 h-9 rounded-2xl bg-gradient-to-br from-gray-500 to-gray-700 dark:from-gray-400 dark:to-gray-600 flex items-center justify-center shadow-md">
          <User size={18} className="text-white" />
        </div>
      )}
    </div>
  );
}
