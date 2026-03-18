import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

const TOAST_DURATION = 3000;

const typeStyles = {
  success: 'bg-teal/95 text-black border-teal',
  error: 'bg-red/95 text-white border-red',
  info: 'bg-gold/95 text-black border-gold',
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_DURATION);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastList toasts={toasts} />
    </ToastContext.Provider>
  );
}

function ToastList({ toasts }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 max-w-md w-full mx-4 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`px-4 py-3 rounded-lg shadow-lg border font-medium text-center animate-[fadeIn_0.2s_ease-out] ${typeStyles[t.type] || typeStyles.success}`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) return { showToast: () => {} };
  return ctx;
}
