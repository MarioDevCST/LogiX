import React from 'react'

export default function DataTable({ title, columns = [], data = [], createLabel = 'Crear', onCreate, onRowClick, loading = false, groupBy, groupLabel }) {
  const grouped = React.useMemo(() => {
    if (!groupBy || loading) return null
    const map = new Map()
    for (const r of data) {
      const key = r[groupBy] ?? '(Sin valor)'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(r)
    }
    return Array.from(map.entries()).sort((a, b) => String(a[0]).localeCompare(String(b[0])))
  }, [data, groupBy, loading])

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
      <div className="table-wrap">
        <table className="table" aria-busy={loading}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key}>{col.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="table-empty">
                  <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: 8 }}>progress_activity</span>
                  Cargando datos...
                </td>
              </tr>
            ) : (data.length === 0) ? (
              <tr>
                <td colSpan={columns.length} className="table-empty">
                  No hay registros todavía.
                </td>
              </tr>
            ) : grouped ? (
              grouped.map(([group, rows]) => (
                <React.Fragment key={group}>
                  <tr className="table-group">
                    <td colSpan={columns.length}>
                      <strong>{groupLabel ? groupLabel(group) : group}</strong>
                    </td>
                  </tr>
                  {rows.map((row, idx) => (
                    <tr key={`${group}-${idx}`} className="table-row" onClick={() => onRowClick && onRowClick(row)} style={{ cursor: onRowClick ? 'pointer' : 'default' }}>
                      {columns.map((col) => (
                        <td key={col.key}>{row[col.key]}</td>
                      ))}
                    </tr>
                  ))}
                </React.Fragment>
              ))
            ) : (
              data.map((row, idx) => (
                <tr key={idx} className="table-row" onClick={() => onRowClick && onRowClick(row)} style={{ cursor: onRowClick ? 'pointer' : 'default' }}>
                  {columns.map((col) => (
                    <td key={col.key}>{row[col.key]}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
