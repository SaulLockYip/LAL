import { useRef, useEffect } from 'react';
import { Send } from 'lucide-react';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onEditLastMessage?: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
  lastUserMessage?: string;
}

export function ChatInput({
  value,
  onChange,
  onSend,
  onEditLastMessage,
  disabled = false,
  placeholder = 'Type a message...',
  lastUserMessage,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea up to 4 lines
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const lineHeight = 24; // approximate line height
      const maxLines = 4;
      const maxHeight = lineHeight * maxLines + 24; // 24 for padding
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        maxHeight
      )}px`;
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl/Cmd + Enter to send
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (value.trim() && !disabled) {
        onSend();
      }
      return;
    }

    // Up arrow to edit last user message
    if (e.key === 'ArrowUp' && !e.shiftKey && value === '' && lastUserMessage && onEditLastMessage) {
      e.preventDefault();
      onEditLastMessage(lastUserMessage);
      // Move cursor to end
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = lastUserMessage.length;
        }
      }, 0);
      return;
    }

    // Regular Enter to send (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) {
        onSend();
      }
    }
  };

  const canSend = value.trim().length > 0 && !disabled;

  return (
    <div className="flex items-end gap-2 p-3 border-t border-gray-200 dark:border-gray-700">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className="flex-1 resize-none rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        style={{ minHeight: '48px', maxHeight: '120px' }}
      />
      <button
        onClick={onSend}
        disabled={!canSend}
        className={`flex-shrink-0 p-3 rounded-xl transition-colors ${
          canSend
            ? 'bg-blue-500 hover:bg-blue-600 text-white'
            : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
        }`}
        aria-label="Send message"
      >
        <Send size={20} />
      </button>
    </div>
  );
}
