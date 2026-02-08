import React from 'react'

export default function CardGrid({ title, items = [], onCreate, createLabel = 'Crear', onCardClick, loading = false }) {
  return (
    <section className="card">
      <div className="card-header">
        <h2 className="card-title">{title}</h2>
        {onCreate && (
          <button className="primary-button" onClick={onCreate} aria-label={createLabel}>
            <span className="material-symbols-outlined" style={{ marginRight: 6 }}>add</span>
            {createLabel}
          </button>
        )}
      </div>
      <div className="card-grid">
        {loading ? (
          <div className="table-empty">
            <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: 8 }}>progress_activity</span>
            Cargando datos...
          </div>
        ) : items.length === 0 ? (
          <div className="table-empty">No hay registros todavía.</div>
        ) : (
          items.map((item, idx) => (
            <div
              key={idx}
              className="card-item"
              onClick={() => onCardClick && onCardClick(item)}
              style={{ cursor: onCardClick ? 'pointer' : 'default' }}
            >
              <div className="card-item-header" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="avatar">{(item.name || item.title || '?').slice(0,1).toUpperCase()}</div>
                <div>
                  <div className="card-item-title" style={{ fontSize: 18, lineHeight: '22px' }}>{item.name || item.title}</div>
                  <div className="card-item-sub" style={{ color: 'var(--text-secondary)' }}>{item.email || item.subtitle}</div>
                </div>
              </div>
              <div className="card-item-meta">
                {item.role && <span className="chip">{item.role}</span>}
                {typeof item.active !== 'undefined' && <span className="chip">{item.active}</span>}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}