import React from 'react'

export default function Modal({ open, title, children, onClose, onSubmit, submitLabel = 'Aceptar', width, bodyStyle }) {
  if (!open) return null
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
          <button className="primary-button" onClick={onSubmit}>{submitLabel}</button>
        </div>
      </div>
    </div>
  )
}