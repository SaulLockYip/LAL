import { useEffect, useState, useCallback } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

// Global toast state
let toasts: Toast[] = [];
const listeners: Set<(toasts: Toast[]) => void> = new Set();

function notifyListeners() {
  listeners.forEach((listener) => listener([...toasts]));
}

function addToast(message: string, type: ToastType) {
  const id = crypto.randomUUID();
  const toast: Toast = { id, message, type };
  toasts = [...toasts, toast];
  notifyListeners();

  // Auto-remove after 3 seconds
  setTimeout(() => {
    removeToast(id);
  }, 3000);
}

function removeToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  notifyListeners();
}

// Exported toast API
export const chatToast = {
  addToast: (message: string, type: ToastType = 'info') => {
    addToast(message, type);
  },
  success: (message: string) => {
    addToast(message, 'success');
  },
  error: (message: string) => {
    addToast(message, 'error');
  },
  info: (message: string) => {
    addToast(message, 'info');
  },
  removeToast,
};

export function ChatToastContainer() {
  const [toastList, setToastList] = useState<Toast[]>([]);

  useEffect(() => {
    const listener = (newToasts: Toast[]) => {
      setToastList([...newToasts]);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const handleRemove = useCallback((id: string) => {
    removeToast(id);
  }, []);

  const getIcon = (type: ToastType) => {
    switch (type) {
      case 'success':
        return <CheckCircle size={18} className="text-green-500" />;
      case 'error':
        return <AlertCircle size={18} className="text-red-500" />;
      case 'info':
      default:
        return <Info size={18} className="text-blue-500" />;
    }
  };

  const getBgColor = (type: ToastType) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800';
      case 'error':
        return 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800';
      case 'info':
      default:
        return 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800';
    }
  };

  if (toastList.length === 0) return null;

  return (
    <div className="fixed bottom-20 right-6 z-50 flex flex-col gap-2 max-w-sm">
      {toastList.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg ${getBgColor(toast.type)} animate-in slide-in-from-right`}
        >
          {getIcon(toast.type)}
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-1">
            {toast.message}
          </p>
          <button
            onClick={() => handleRemove(toast.id)}
            className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
