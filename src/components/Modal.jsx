import React from "react";

export default function Modal({
  open,
  title,
  children,
  onClose,
  onSubmit,
  cancelLabel,
  onCancel,
  submitLabel = "Aceptar",
  width,
  bodyStyle,
}) {
  React.useEffect(() => {
    if (!open) return undefined;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card" style={width ? { width } : undefined}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="icon-button" onClick={onClose} aria-label="Cerrar">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="modal-body" style={bodyStyle}>
          {children}
        </div>
        <div className="modal-footer">
          {cancelLabel ? (
            <button
              className="secondary-button"
              type="button"
              onClick={onCancel || onClose}
            >
              {cancelLabel}
            </button>
          ) : null}
          <button
            className="primary-button"
            type="button"
            onClick={onSubmit || onClose}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
