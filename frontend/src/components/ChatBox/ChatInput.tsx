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
    <div className="flex items-end gap-3 px-5 py-4">
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="w-full resize-none rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3.5 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white dark:focus:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-[15px] text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-all shadow-sm"
          style={{ minHeight: '52px', maxHeight: '128px' }}
        />
      </div>
      <button
        onClick={onSend}
        disabled={!canSend}
        className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 ${
          canSend
            ? 'bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-md hover:shadow-lg hover:scale-105 active:scale-95'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-600 cursor-not-allowed'
        }`}
        aria-label="Send message"
      >
        <Send size={18} />
      </button>
    </div>
  );
}
