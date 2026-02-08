import { useEffect } from 'react';

export default function Snackbar({ open, message, type = 'success', onClose, duration = 3000 }) {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      onClose?.();
    }, duration);
    return () => clearTimeout(t);
  }, [open, duration, onClose]);

  return (
    <div className={`snackbar ${open ? 'show' : ''} ${type}`} role="status" aria-live="polite">
      <span className="snackbar-message">{message}</span>
    </div>
  );
}