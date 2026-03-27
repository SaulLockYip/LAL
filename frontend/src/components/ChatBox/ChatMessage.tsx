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
  const [showTimestamp, setShowTimestamp] = useState(false);

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

  return (
    <div
      className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
      onMouseEnter={() => setShowTimestamp(true)}
      onMouseLeave={() => setShowTimestamp(false)}
    >
      {message.role === 'assistant' && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
          <Bot size={18} className="text-blue-500" />
        </div>
      )}

      <div className="relative max-w-[80%]">
        <div
          className={`rounded-2xl px-4 py-2 ${
            message.role === 'user'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 dark:bg-gray-800'
          }`}
        >
          {message.role === 'assistant' ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown
                components={{
                  h1: ({ children }) => (
                    <h1 className="text-xl font-bold mt-2 mb-1">{children}</h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-lg font-bold mt-2 mb-1">{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-base font-semibold mt-1 mb-1">{children}</h3>
                  ),
                  p: ({ children }) => (
                    <p className="mb-2 last:mb-0 whitespace-pre-wrap">{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc list-inside mb-2">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-inside mb-2">{children}</ol>
                  ),
                  li: ({ children }) => <li className="mb-1">{children}</li>,
                  code: ({ children, className }) => {
                    const isInline = !className;
                    return isInline ? (
                      <code className="px-1 py-0.5 bg-gray-200 dark:bg-gray-600 rounded text-sm">
                        {children}
                      </code>
                    ) : (
                      <code className="block p-2 bg-gray-200 dark:bg-gray-600 rounded text-sm overflow-x-auto">
                        {children}
                      </code>
                    );
                  },
                  pre: ({ children }) => (
                    <pre className="p-2 bg-gray-200 dark:bg-gray-600 rounded overflow-x-auto mb-2">
                      {children}
                    </pre>
                  ),
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      {children}
                    </a>
                  ),
                  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                  em: ({ children }) => <em className="italic">{children}</em>,
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="whitespace-pre-wrap">{message.content}</p>
          )}
        </div>

        {/* Timestamp */}
        <div
          className={`absolute -bottom-5 right-0 text-xs text-gray-400 dark:text-gray-500 transition-opacity ${
            showTimestamp ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {formatTime(message.timestamp)}
        </div>

        {/* Copy button */}
        <button
          onClick={handleCopy}
          className={`absolute -top-2 right-2 p-1.5 rounded-lg transition-opacity ${
            showTimestamp || copied ? 'opacity-100' : 'opacity-0'
          } ${
            message.role === 'user'
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
          aria-label="Copy message"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>

        {/* Regenerate button for last assistant message */}
        {message.role === 'assistant' && isLastAssistantMessage && onRegenerate && (
          <button
            onClick={handleRegenerate}
            className={`absolute -top-2 right-10 p-1.5 rounded-lg transition-opacity bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 ${
              showTimestamp ? 'opacity-100' : 'opacity-0'
            }`}
            aria-label="Regenerate response"
          >
            <RotateCcw size={14} />
          </button>
        )}
      </div>

      {message.role === 'user' && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
          <User size={18} className="text-white" />
        </div>
      )}
    </div>
  );
}
