import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import DataTable from '../components/DataTable.jsx'
import CardGrid from '../components/CardGrid.jsx'
import Modal from '../components/Modal.jsx'
import Snackbar from '../components/Snackbar.jsx'
import Pagination from '../components/Pagination.jsx'
import Calendar from '../components/Calendar.jsx'

const ESTADO_VIAJE_OPTIONS = [ 'Preparando', 'En Proceso', 'Cancelado', 'Entregado' ]
const CARGA_OPTIONS = [ 'Seco', 'Refrigerado', 'Congelado', 'Técnico' ]
const ENTREGA_OPTIONS = [ 'Provisión', 'Alimentación', 'Repuesto', 'Técnico' ]

export default function Loads() {
  const columns = [
    { key: 'barco', header: 'Barco' },
    { key: 'entrega', header: 'Entrega' },
    { key: 'total_palets', header: 'Palets' },
    { key: 'estado_viaje', header: 'Estado viaje' },
    { key: 'estado_carga', header: 'Carga completa' },
  ]

  const navigate = useNavigate()
  const [view, setView] = useState('table')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    barco: '',
    entrega: [],
    chofer: '',
    consignatario: '',
    palets: [],
    carga: [],
    fecha_de_carga: '',
    hora_de_carga: '',
    fecha_de_descarga: '',
    hora_de_descarga: '',
    cash: false,
    lancha: false,
    estado_viaje: 'Preparando',
  })
  const [ships, setShips] = useState([])
  const [pallets, setPallets] = useState([])
  const [users, setUsers] = useState([])
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [snack, setSnack] = useState({ open: false, message: '', type: 'success' })

  // Filtros y agrupación
  const [estadoFilter, setEstadoFilter] = useState('')
  const [entregaFilter, setEntregaFilter] = useState('')
  const [barcoFilter, setBarcoFilter] = useState('')
  const [groupBy, setGroupBy] = useState('none')

  // mes de calendario
  const [calMonth, setCalMonth] = useState(() => new Date())
  const [calMode, setCalMode] = useState('month')
  const prevPeriod = () => setCalMonth(d => calMode === 'week' ? new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7) : new Date(d.getFullYear(), d.getMonth() - 1, 1))
  const nextPeriod = () => setCalMonth(d => calMode === 'week' ? new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7) : new Date(d.getFullYear(), d.getMonth() + 1, 1))

  // modales de creación rápida
  const [openCreateShip, setOpenCreateShip] = useState(false)
  const [shipForm, setShipForm] = useState({ nombre_del_barco: '', empresa: '' })
  const [openCreateUser, setOpenCreateUser] = useState(false)
  const [userForm, setUserForm] = useState({ name: '', email: '', role: '' })
  const [openCreatePallet, setOpenCreatePallet] = useState(false)
  const [palletForm, setPalletForm] = useState({ numero_palet: '', tipo: 'Seco' })

  useEffect(() => {
    setLoading(true)
    fetch('/api/loads').then(r => r.json()).then(list => {
      const mapped = list.map(l => ({
        id: l._id,
        barco: l.barco?.nombre_del_barco || '',
        entrega: Array.isArray(l.entrega) ? l.entrega.join(', ') : (l.entrega || ''),
        total_palets: l.total_palets ?? (Array.isArray(l.palets) ? l.palets.length : 0),
        estado_viaje: l.estado_viaje || 'Preparando',
        estado_carga: (l.estado_carga ? 'Sí' : 'No'),
        fecha_de_carga: l.fecha_de_carga || null,
        fecha_de_descarga: l.fecha_de_descarga || null,
      }))
      setRows(mapped)
    }).catch(() => {}).finally(() => setLoading(false))
    fetch('/api/ships').then(r => r.json()).then(setShips).catch(() => {})
    fetch('/api/pallets').then(r => r.json()).then(setPallets).catch(() => {})
    fetch('/api/users').then(r => r.json()).then(setUsers).catch(() => {})
  }, [])

  const onCreate = () => setOpen(true)

  const submit = async () => {
    try {
      if (!form.barco || !form.fecha_de_carga) {
        setSnack({ open: true, message: 'Barco y Fecha de Carga son obligatorios', type: 'error' })
        return
      }
      const payload = {
        barco: form.barco,
        entrega: form.entrega,
        chofer: form.chofer || undefined,
        consignatario: form.consignatario || undefined,
        palets: form.palets,
        carga: form.carga,
        fecha_de_carga: form.fecha_de_carga || undefined,
        hora_de_carga: form.hora_de_carga || undefined,
        fecha_de_descarga: form.fecha_de_descarga || undefined,
        hora_de_descarga: form.hora_de_descarga || undefined,
        cash: !!form.cash,
        lancha: !!form.lancha,
        estado_viaje: form.estado_viaje,
        creado_por: 'Testing',
      }
      const res = await fetch('/api/loads', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setSnack({ open: true, message: err.error || 'Error creando carga', type: 'error' })
        return
      }
      const created = await res.json()
      setRows(prev => ([...prev, {
        id: created._id,
        barco: created.barco?.nombre_del_barco || '',
        entrega: Array.isArray(created.entrega) ? created.entrega.join(', ') : (created.entrega || ''),
        total_palets: created.total_palets ?? (Array.isArray(created.palets) ? created.palets.length : 0),
        estado_viaje: created.estado_viaje || 'Preparando',
        estado_carga: (created.estado_carga ? 'Sí' : 'No'),
        fecha_de_carga: created.fecha_de_carga || null,
      }]))
      setOpen(false)
      setForm({ barco: '', entrega: [], chofer: '', consignatario: '', palets: [], carga: [], fecha_de_carga: '', hora_de_carga: '', fecha_de_descarga: '', hora_de_descarga: '', cash: false, lancha: false, estado_viaje: 'Preparando' })
      setSnack({ open: true, message: 'Carga creada', type: 'success' })
    } catch (e) {
      setSnack({ open: true, message: 'Error de red creando carga', type: 'error' })
    }
  }

  const createShip = async () => {
    try {
      if (!shipForm.nombre_del_barco) {
        setSnack({ open: true, message: 'El nombre del barco es obligatorio', type: 'error' })
        return
      }
      const res = await fetch('/api/ships', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...shipForm, creado_por: 'Testing' })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setSnack({ open: true, message: err.error || 'Error creando barco', type: 'error' })
        return
      }
      const created = await res.json()
      setShips(prev => ([...prev, created]))
      setOpenCreateShip(false)
      setShipForm({ nombre_del_barco: '', empresa: '' })
      setSnack({ open: true, message: 'Barco creado', type: 'success' })
    } catch (e) {
      setSnack({ open: true, message: 'Error de red creando barco', type: 'error' })
    }
  }

  const createUser = async () => {
    try {
      if (!userForm.name || !userForm.email || !userForm.role) {
        setSnack({ open: true, message: 'Nombre, email y rol son obligatorios', type: 'error' })
        return
      }
      const res = await fetch('/api/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...userForm, creado_por: 'Testing' })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setSnack({ open: true, message: err.error || 'Error creando usuario', type: 'error' })
        return
      }
      const created = await res.json()
      setUsers(prev => ([...prev, created]))
      setOpenCreateUser(false)
      setUserForm({ name: '', email: '', role: '' })
      setSnack({ open: true, message: 'Usuario creado', type: 'success' })
    } catch (e) {
      setSnack({ open: true, message: 'Error de red creando usuario', type: 'error' })
    }
  }

  const createPallet = async () => {
    try {
      if (!palletForm.numero_palet) {
        setSnack({ open: true, message: 'El número de palet es obligatorio', type: 'error' })
        return
      }
      const res = await fetch('/api/pallets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...palletForm, creado_por: 'Testing' })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setSnack({ open: true, message: err.error || 'Error creando palet', type: 'error' })
        return
      }
      const created = await res.json()
      setPallets(prev => ([...prev, created]))
      setOpenCreatePallet(false)
      setPalletForm({ numero_palet: '', tipo: 'Seco' })
      setSnack({ open: true, message: 'Palet creado', type: 'success' })
    } catch (e) {
      setSnack({ open: true, message: 'Error de red creando palet', type: 'error' })
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter(r => {
      const textOk = q === '' || r.barco.toLowerCase().includes(q) || r.entrega.toLowerCase().includes(q) || r.estado_viaje.toLowerCase().includes(q)
      const estadoOk = !estadoFilter || r.estado_viaje === estadoFilter
      const entregaOk = !entregaFilter || r.entrega.split(', ').includes(entregaFilter)
      const barcoOk = !barcoFilter || r.barco === barcoFilter
      return textOk && estadoOk && entregaOk && barcoOk
    })
  }, [rows, query, estadoFilter, entregaFilter, barcoFilter])

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize
    const end = start + pageSize
    return filtered.slice(start, end)
  }, [filtered, page, pageSize])

  useEffect(() => { setPage(1) }, [query, estadoFilter, entregaFilter, barcoFilter])

  const goDetail = (row) => {
    if (row.id) navigate(`/app/logistica/cargas/${row.id}`)
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <input className="input" style={{ width: 280 }} placeholder="Buscar por barco, entrega o estado" value={query} onChange={e => setQuery(e.target.value)} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select className="select" value={estadoFilter} onChange={e => setEstadoFilter(e.target.value)} aria-label="Filtrar por estado">
            <option value="">Todos los estados</option>
            {ESTADO_VIAJE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          <select className="select" value={entregaFilter} onChange={e => setEntregaFilter(e.target.value)} aria-label="Filtrar por entrega">
            <option value="">Todas las entregas</option>
            {ENTREGA_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          <select className="select" value={barcoFilter} onChange={e => setBarcoFilter(e.target.value)} aria-label="Filtrar por barco">
            <option value="">Todos los barcos</option>
            {Array.from(new Set(rows.map(r => r.barco))).filter(Boolean).map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <select className="select" value={groupBy} onChange={e => setGroupBy(e.target.value)} aria-label="Agrupar">
            <option value="none">Sin agrupación</option>
            <option value="barco">Agrupar por barco</option>
            <option value="estado_viaje">Agrupar por estado</option>
          </select>
          <button className="icon-button" title="Vista tabla" onClick={() => setView('table')}>
            <span className="material-symbols-outlined">table</span>
          </button>
          <button className="icon-button" title="Vista tarjetas" onClick={() => setView('cards')}>
            <span className="material-symbols-outlined">view_agenda</span>
          </button>
          <button className="icon-button" title="Vista calendario" onClick={() => setView('calendar')}>
            <span className="material-symbols-outlined">calendar_month</span>
          </button>
          {view === 'calendar' && (
            <button className="icon-button" title={calMode === 'month' ? 'Cambiar a vista semanal' : 'Cambiar a vista mensual'} onClick={() => setCalMode(m => m === 'month' ? 'week' : 'month')}>
              <span className="material-symbols-outlined">calendar_view_week</span>
            </button>
          )}
        </div>
      </div>

      {view === 'table' ? (
        <DataTable title="Cargas" columns={columns} data={paginated} loading={loading} groupBy={groupBy !== 'none' ? groupBy : undefined} createLabel="Crear carga" onCreate={onCreate} onRowClick={goDetail} />
      ) : view === 'cards' ? (
        <CardGrid title="Cargas" items={paginated.map(i => ({ ...i, name: i.entrega, subtitle: `${i.barco} · ${i.estado_viaje}` }))} loading={loading} onCreate={onCreate} createLabel="Crear carga" onCardClick={goDetail} />
      ) : (
        <Calendar title="Cargas" items={filtered} loading={loading} month={calMonth} mode={calMode} onPrevMonth={prevPeriod} onNextMonth={nextPeriod} onItemClick={goDetail} dateKey="fecha_de_carga" secondaryDateKey="fecha_de_descarga" statusKey="estado_viaje" />
      )}

      <Pagination page={page} pageSize={pageSize} total={filtered.length} onPageChange={(p) => setPage(Math.max(1, p))} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />

      <Modal open={open} title="Crear carga" onClose={() => setOpen(false)} onSubmit={submit} submitLabel="Crear" width={640} bodyStyle={{ gridTemplateColumns: '1fr' }}>
        <div style={{ display: 'grid', gap: 12 }}>
          {/* Datos básicos */}
          <div style={{ display: 'grid', gap: 8 }}>
            <div className="label">Barco</div>
            <select className="input" value={form.barco} onChange={e => setForm({ ...form, barco: e.target.value })}>
              <option value="">Selecciona barco</option>
              {ships.map(s => (
                <option key={s._id} value={s._id}>{s.nombre_del_barco}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            <div className="label">Fecha y hora de carga</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input type="date" className="input" value={form.fecha_de_carga} onChange={e => setForm({ ...form, fecha_de_carga: e.target.value })} />
              <input type="time" className="input" value={form.hora_de_carga} onChange={e => setForm({ ...form, hora_de_carga: e.target.value })} />
            </div>
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            <div className="label">Fecha y hora de descarga</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input type="date" className="input" value={form.fecha_de_descarga} onChange={e => setForm({ ...form, fecha_de_descarga: e.target.value })} />
              <input type="time" className="input" value={form.hora_de_descarga} onChange={e => setForm({ ...form, hora_de_descarga: e.target.value })} />
            </div>
          </div>

          {/* Entrega */}
          <div style={{ display: 'grid', gap: 8 }}>
            <div className="label">Entrega</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {ENTREGA_OPTIONS.map(opt => (
                <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="checkbox" checked={form.entrega.includes(opt)} onChange={e => {
                    const next = e.target.checked ? [...form.entrega, opt] : form.entrega.filter(v => v !== opt)
                    setForm({ ...form, entrega: next })
                  }} />
                  {opt}
                </label>
              ))}
            </div>
          </div>

          {/* Personas */}
          <div style={{ display: 'grid', gap: 8 }}>
            <div className="label">Chofer</div>
            <select className="input" value={form.chofer} onChange={e => setForm({ ...form, chofer: e.target.value })}>
              <option value="">Sin chofer</option>
              {users.filter(u => u.role === 'driver').map(u => (
                <option key={u._id} value={u._id}>{u.name} ({u.email})</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <div className="label">Consignatario</div>
            <select className="input" value={form.consignatario} onChange={e => setForm({ ...form, consignatario: e.target.value })}>
              <option value="">Sin consignatario</option>
              {users.filter(u => u.role === 'consignee').map(u => (
                <option key={u._id} value={u._id}>{u.name} ({u.email})</option>
              ))}
            </select>
          </div>

          {/* Palets */}
          <div style={{ display: 'grid', gap: 8 }}>
            <div className="label">Palets</div>
            <select multiple className="input" value={form.palets} onChange={e => {
              const selected = Array.from(e.target.selectedOptions).map(o => o.value)
              setForm({ ...form, palets: selected })
            }}>
              {pallets.map(p => (
                <option key={p._id} value={p._id}>{p.numero_palet} ({p.tipo})</option>
              ))}
            </select>
          </div>

          {/* Tipo de carga */}
          <div style={{ display: 'grid', gap: 8 }}>
            <div className="label">Tipo de carga</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {CARGA_OPTIONS.map(opt => (
                <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="checkbox" checked={form.carga.includes(opt)} onChange={e => {
                    const next = e.target.checked ? [...form.carga, opt] : form.carga.filter(v => v !== opt)
                    setForm({ ...form, carga: next })
                  }} />
                  {opt}
                </label>
              ))}
            </div>
          </div>

          {/* Opciones */}
          <div style={{ display: 'grid', gap: 8 }}>
            <div className="label">Opciones</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={form.lancha} onChange={e => setForm({ ...form, lancha: e.target.checked })} /> Es lancha
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={form.cash} onChange={e => setForm({ ...form, cash: e.target.checked })} /> Cobro en efectivo
              </label>
            </div>
          </div>

          {/* Estado del viaje */}
          <div style={{ display: 'grid', gap: 8 }}>
            <div className="label">Estado del viaje</div>
            <select className="select" value={form.estado_viaje} onChange={e => setForm({ ...form, estado_viaje: e.target.value })}>
              {ESTADO_VIAJE_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        </div>
      </Modal>

      {/* Modal crear barco */}
      <Modal open={openCreateShip} title="Crear barco" onClose={() => setOpenCreateShip(false)} onSubmit={createShip} submitLabel="Crear">
        <div>
          <div className="label">Nombre del barco</div>
          <input className="input" value={shipForm.nombre_del_barco} onChange={e => setShipForm({ ...shipForm, nombre_del_barco: e.target.value })} placeholder="Nombre del barco" />
        </div>
        <div>
          <div className="label">Empresa (opcional)</div>
          <select className="input" value={shipForm.empresa} onChange={e => setShipForm({ ...shipForm, empresa: e.target.value })}>
            <option value="">Sin empresa</option>
            {ships.map(s => (
              s.empresa ? <option key={s.empresa._id} value={s.empresa._id}>{s.empresa.nombre}</option> : null
            ))}
          </select>
        </div>
      </Modal>

      {/* Modal crear usuario */}
      <Modal open={openCreateUser} title="Crear usuario" onClose={() => setOpenCreateUser(false)} onSubmit={createUser} submitLabel="Crear">
        <div>
          <div className="label">Nombre</div>
          <input className="input" value={userForm.name} onChange={e => setUserForm({ ...userForm, name: e.target.value })} placeholder="Nombre" />
        </div>
        <div>
          <div className="label">Email</div>
          <input className="input" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} placeholder="email@dominio.com" />
        </div>
        <div>
          <div className="label">Rol</div>
          <select className="input" value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value })}>
            <option value="">Selecciona rol</option>
            <option value="driver">Chofer</option>
            <option value="consignee">Consignatario</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
          </select>
        </div>
      </Modal>

      {/* Modal crear palet */}
      <Modal open={openCreatePallet} title="Crear palet" onClose={() => setOpenCreatePallet(false)} onSubmit={createPallet} submitLabel="Crear">
        <div>
          <div className="label">Número de palet</div>
          <input className="input" value={palletForm.numero_palet} onChange={e => setPalletForm({ ...palletForm, numero_palet: e.target.value })} placeholder="Nº de palet" />
        </div>
        <div>
          <div className="label">Tipo</div>
          <select className="select" value={palletForm.tipo} onChange={e => setPalletForm({ ...palletForm, tipo: e.target.value })}>
            {CARGA_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      </Modal>

      <Snackbar open={snack.open} message={snack.message} type={snack.type} onClose={() => setSnack(s => ({ ...s, open: false }))} />
    </>
  )
}