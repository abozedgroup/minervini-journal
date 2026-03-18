import { useEffect } from 'react';

export default function Modal({ open, onClose, title, children, size = 'md', hideClose = false }) {
  useEffect(() => {
    if (!open || hideClose) return;
    const onKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, hideClose]);

  if (!open) return null;
  const sizeClass = size === 'lg' ? 'max-w-2xl' : size === 'sm' ? 'max-w-sm' : 'max-w-md';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/60" onClick={hideClose ? undefined : onClose} aria-hidden />
      <div className={`relative bg-s1 border border-border rounded-xl shadow-xl ${sizeClass} w-full p-6 my-8`} onClick={(e) => e.stopPropagation()}>
        {!hideClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 left-4 w-7 h-7 flex items-center justify-center rounded-full text-muted hover:text-fg hover:bg-s2 transition-colors text-lg leading-none"
            aria-label="إغلاق"
          >
            ✕
          </button>
        )}
        {title && <h2 className="font-display text-gold text-lg mb-4">{title}</h2>}
        {children}
      </div>
    </div>
  );
}
