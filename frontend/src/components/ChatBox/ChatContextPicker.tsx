import { useState, useRef, useEffect } from 'react';
import { ChevronDown, BookOpen, List, Dumbbell, Globe } from 'lucide-react';

export type ContextType = 'article' | 'word_list' | 'exercises' | 'global';

interface ContextOption {
  type: ContextType;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const contextOptions: ContextOption[] = [
  {
    type: 'global',
    label: 'No Context',
    icon: <Globe size={16} />,
    description: 'General conversation without specific context',
  },
  {
    type: 'article',
    label: 'Article',
    icon: <BookOpen size={16} />,
    description: 'Include article content for context',
  },
  {
    type: 'word_list',
    label: 'Word List',
    icon: <List size={16} />,
    description: 'Include word list for vocabulary context',
  },
  {
    type: 'exercises',
    label: 'Exercises',
    icon: <Dumbbell size={16} />,
    description: 'Include exercises for practice context',
  },
];

interface ChatContextPickerProps {
  value: ContextType;
  onChange: (type: ContextType) => void;
  disabled?: boolean;
}

export function ChatContextPicker({ value, onChange, disabled }: ChatContextPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = contextOptions.find((opt) => opt.type === value) || contextOptions[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-sm ${
          disabled
            ? 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed'
            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
        }`}
        aria-label="Select context"
      >
        {selectedOption.icon}
        <span className="hidden sm:inline">{selectedOption.label}</span>
        <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden z-50">
          <div className="p-2">
            {contextOptions.map((option) => (
              <button
                key={option.type}
                onClick={() => {
                  onChange(option.type);
                  setIsOpen(false);
                }}
                className={`w-full flex items-start gap-3 p-3 rounded-lg transition-colors text-left ${
                  value === option.type
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                <div className="flex-shrink-0 mt-0.5">{option.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{option.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {option.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
