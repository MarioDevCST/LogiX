import React from 'react'

function startOfMonth(date) {
  const d = new Date(date)
  d.setDate(1)
  d.setHours(0,0,0,0)
  return d
}
function endOfMonth(date) {
  const d = new Date(date)
  d.setMonth(d.getMonth() + 1)
  d.setDate(0)
  d.setHours(23,59,59,999)
  return d
}
function getMonthMatrix(date) {
  const start = startOfMonth(date)
  const end = endOfMonth(date)
  const firstDay = start.getDay() // 0-6
  const daysInMonth = end.getDate()
  const cells = []
  // previous days from last month to align grid
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(start.getFullYear(), start.getMonth(), d))
  // pad to complete rows
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function getWeekDays(date) {
  const d = new Date(date)
  const start = new Date(d)
  start.setDate(d.getDate() - d.getDay()) // domingo
  start.setHours(0,0,0,0)
  const days = []
  for (let i = 0; i < 7; i++) {
    const day = new Date(start)
    day.setDate(start.getDate() + i)
    days.push(day)
  }
  return days
}

export default function Calendar({ title = 'Calendario', items = [], month = new Date(), mode = 'month', onPrevMonth, onNextMonth, onItemClick, loading = false, dateKey = 'fecha_de_carga', secondaryDateKey = 'fecha_de_descarga', statusKey = 'estado_viaje' }) {
  const cells = React.useMemo(() => mode === 'week' ? getWeekDays(month) : getMonthMatrix(month), [month, mode])

  const itemsByDay = React.useMemo(() => {
    const map = new Map()
    for (const it of items) {
      const keys = [dateKey, secondaryDateKey].filter(Boolean)
      for (const k of keys) {
        const raw = it[k]
        if (!raw) continue
        const d = new Date(raw)
        if (Number.isNaN(d.getTime())) continue
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
        if (!map.has(key)) map.set(key, [])
        map.get(key).push(it)
      }
    }
    return map
  }, [items, dateKey, secondaryDateKey])

  const COLOR_MAP = {
    'Preparando': '#64748b',
    'Cargando': '#2563eb',
    'Viajando': '#0ea5e9',
    'Entregado': '#16a34a',
    'Cancelado': '#ef4444',
    'En Proceso': '#2563eb',
  }
  const weekday = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
  const label = mode === 'week'
    ? (() => {
        const start = cells[0]
        const end = cells[6]
        const fmtStart = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' }).format(start)
        const fmtEnd = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(end)
        return `Semana · ${fmtStart} – ${fmtEnd}`
      })()
    : new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(month)

  return (
    <section className="calendar">
      <div className="calendar-header">
        <h2 className="calendar-title">{title} · {label}</h2>
        <div>
          <button className="icon-button" onClick={onPrevMonth} title={mode === 'week' ? 'Semana anterior' : 'Mes anterior'}><span className="material-symbols-outlined">chevron_left</span></button>
          <button className="icon-button" onClick={onNextMonth} title={mode === 'week' ? 'Semana siguiente' : 'Mes siguiente'} style={{ marginLeft: 8 }}><span className="material-symbols-outlined">chevron_right</span></button>
        </div>
      </div>
      <div className="calendar-grid">
        {weekday.map((w) => (
          <div key={`w-${w}`} className="calendar-cell">
            <div className="calendar-cell-header"><span>{w}</span><span></span></div>
          </div>
        ))}
        {cells.map((d, idx) => {
          if (!d) return <div key={idx} className="calendar-cell" />
          const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
          const dayItems = itemsByDay.get(key) || []
          return (
            <div key={idx} className="calendar-cell">
              <div className="calendar-cell-header"><span>{d.getDate()}</span><span></span></div>
              {loading ? (
                <div className="calendar-item" style={{ color: 'var(--text-secondary)' }}>
                  <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: 6 }}>progress_activity</span>
                  Cargando...
                </div>
              ) : dayItems.map((it, i) => {
                const color = COLOR_MAP[it[statusKey]] || '#6b7280'
                return (
                  <div key={i} className="calendar-item" onClick={() => onItemClick && onItemClick(it)} style={{ cursor: onItemClick ? 'pointer' : 'default', borderLeft: `4px solid ${color}`, background: '#f8fafc' }}>
                    <span style={{ color, marginRight: 6 }}>●</span>
                    {it.barco ? `${it.barco}` : 'Sin barco'} · {it.entrega}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </section>
  )
}
