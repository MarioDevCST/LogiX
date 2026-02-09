import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import DataTable from '../components/DataTable.jsx'
import CardGrid from '../components/CardGrid.jsx'
import Modal from '../components/Modal.jsx'
import Snackbar from '../components/Snackbar.jsx'
import Pagination from '../components/Pagination.jsx'
import { getCurrentRole, hasPermission, PERMISSIONS, getCurrentUser } from '../utils/roles.js'

const TIPO_OPTIONS = [
  { label: 'Seco', value: 'Seco' },
  { label: 'Refrigerado', value: 'Refrigerado' },
  { label: 'Congelado', value: 'Congelado' },
  { label: 'Técnico', value: 'Técnico' },
]

function formatDateLabel(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)
}

function combineDateTime(dateValue, timeValue) {
  if (!dateValue) return null
  const d = new Date(dateValue)
  if (Number.isNaN(d.getTime())) return null
  if (timeValue) {
    const [hh, mm] = String(timeValue).split(':')
    d.setHours(Number(hh) || 0, Number(mm) || 0, 0, 0)
  }
  return d
}

export default function Pallets() {
  const columns = [
    { key: 'nombre', header: 'Nombre' },
    { key: 'numero_palet', header: 'Número de palet' },
    { key: 'tipo', header: 'Tipo' },
  ]

  const navigate = useNavigate()
  const [view, setView] = useState('dual')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

const [form, setForm] = useState({ numero_palet: '', tipo: 'Seco', carga: '', productos: '' })

  const role = getCurrentRole()
  const canManagePallets = hasPermission(role, PERMISSIONS.MANAGE_PALLETS)
  const canManageLoads = hasPermission(role, PERMISSIONS.MANAGE_LOADS)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [snack, setSnack] = useState({ open: false, message: '', type: 'success' })

  // nuevos estados para modo dual
  const [palletDocs, setPalletDocs] = useState([])
  const [loads, setLoads] = useState([])
  const [loadsLoading, setLoadsLoading] = useState(false)
// paginación local para listas de la vista dual
const [loadsListPage, setLoadsListPage] = useState(1)
const [loadsListPageSize, setLoadsListPageSize] = useState(10)
const [palletsListPage, setPalletsListPage] = useState(1)
const [palletsListPageSize, setPalletsListPageSize] = useState(10)

  useEffect(() => {
    setLoading(true)
    fetch('/api/pallets').then(r => r.json()).then(list => {
      setPalletDocs(list)
      const mapped = list.map(p => ({ id: p._id, nombre: p.nombre, numero_palet: p.numero_palet, tipo: p.tipo }))
      setRows(mapped)
    }).catch(() => {}).finally(() => setLoading(false))

    // cargar cargas para el modo dual
    setLoadsLoading(true)
    fetch('/api/loads').then(r => r.json()).then(setLoads).catch(() => {}).finally(() => setLoadsLoading(false))
  }, [])

  const location = useLocation()
  useEffect(() => {
    const cargaId = location.state && location.state.createPalletForCarga
    if (cargaId) {
      setOpen(true)
      setForm(prev => ({ ...prev, carga: cargaId }))
    }
  }, [location.state])

  const onCreate = () => setOpen(true)

  const submit = async () => {
    try {

    if (!form.numero_palet || !form.tipo || !form.carga) {
      setSnack({ open: true, message: 'Número de palet, tipo y carga son obligatorios', type: 'error' })
        return
      }
      const res = await fetch('/api/pallets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, creado_por: (getCurrentUser()?.name || 'Testing') }) })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setSnack({ open: true, message: err.error || 'Error creando palet', type: 'error' })
        return
      }
      const created = await res.json()
      setRows(prev => ([...prev, { id: created._id, nombre: created.nombre, numero_palet: created.numero_palet, tipo: created.tipo }]))
      setPalletDocs(prev => ([...prev, created]))
      setOpen(false)

    setForm({ numero_palet: '', tipo: 'Seco', carga: '', productos: '' })
      setSnack({ open: true, message: 'Palet creado', type: 'success' })
    } catch (e) {
      setSnack({ open: true, message: 'Error de red creando palet', type: 'error' })
    }
  }

  const goDetail = (row) => {
    if (row.id) navigate(`/app/palets/${row.id}`)
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter(r => q === '' || (r.nombre && r.nombre.toLowerCase().includes(q)) || r.numero_palet.toLowerCase().includes(q) || r.tipo.toLowerCase().includes(q))
  }, [rows, query])

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize
    const end = start + pageSize
    return filtered.slice(start, end)
  }, [filtered, page, pageSize])

  // derivados para el modo dual
  const loadsSorted = useMemo(() => {
    const withDate = loads.filter(l => !!l.fecha_de_carga)
    return [...withDate].sort((a, b) => {
      const ad = combineDateTime(a.fecha_de_carga, a.hora_de_carga) || new Date(8640000000000000)
      const bd = combineDateTime(b.fecha_de_carga, b.hora_de_carga) || new Date(8640000000000000)
      return ad - bd
    })
  }, [loads])
const loadsSortedPage = useMemo(() => {
  const start = (loadsListPage - 1) * loadsListPageSize
  const end = start + loadsListPageSize
  return loadsSorted.slice(start, end)
}, [loadsSorted, loadsListPage, loadsListPageSize])

  const latestPallets = useMemo(() => {
    const arr = [...palletDocs].sort((a, b) => new Date(b.createdAt || b.fecha_creacion) - new Date(a.createdAt || a.fecha_creacion))
    return arr.slice(0, 10)
  }, [palletDocs])
const latestPalletsPage = useMemo(() => {
  const arr = [...palletDocs].sort((a, b) => new Date(b.createdAt || b.fecha_creacion) - new Date(a.createdAt || a.fecha_creacion))
  const start = (palletsListPage - 1) * palletsListPageSize
  const end = start + palletsListPageSize
  return arr.slice(start, end)
}, [palletDocs, palletsListPage, palletsListPageSize])

  useEffect(() => { setPage(1) }, [query])

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" style={{ width: 280 }} placeholder="Buscar por número o tipo" value={query} onChange={e => setQuery(e.target.value)} />
          {canManagePallets && (
            <button className="icon-button" onClick={() => setOpen(true)} title="Crear palet">
              <span className="material-symbols-outlined">add_box</span>
            </button>
          )}
          {canManageLoads && (
            <button className="icon-button" onClick={() => navigate('/app/logistica/cargas')} title="Crear carga">
              <span className="material-symbols-outlined">add_business</span>
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="icon-button" title="Vista tabla" onClick={() => setView('table')}>
            <span className="material-symbols-outlined">table</span>
          </button>
          <button className="icon-button" title="Vista tarjetas" onClick={() => setView('cards')}>
            <span className="material-symbols-outlined">view_agenda</span>
          </button>
          <button className="icon-button" title="Vista dual" onClick={() => setView('dual')}>
            <span className="material-symbols-outlined">view_column</span>
          </button>
        </div>
      </div>

      {view === 'table' ? (
        <DataTable title="Palets" columns={columns} data={paginated} loading={loading} createLabel={canManagePallets ? 'Crear palet' : undefined} onCreate={canManagePallets ? onCreate : undefined} onRowClick={goDetail} />
      ) : view === 'cards' ? (
        <CardGrid title="Palets" items={paginated.map(i => ({ ...i, name: i.nombre || i.numero_palet, subtitle: i.tipo }))} loading={loading} onCreate={canManagePallets ? onCreate : undefined} createLabel={canManagePallets ? 'Crear palet' : undefined} onCardClick={goDetail} />
      ) : (

        <section style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16 }}>
           <div className="card">
             <div className="card-header">
               <h2 className="card-title">Cargas por fecha</h2>
             </div>
             <div style={{ padding: 12 }}>
               {loadsLoading ? (
                 <div style={{ color: 'var(--text-secondary)' }}>
                   <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: 6 }}>progress_activity</span>
                   Cargando...
                 </div>

              ) : loadsSorted.length === 0 ? (
                 <div style={{ color: 'var(--text-secondary)' }}>Sin cargas con fecha</div>
               ) : (
               loadsSortedPage.map(l => (
                  <div
                    key={l._id}
                    className="calendar-item"
                    style={{ padding: '10px 12px', minHeight: 56, marginBottom: 8, cursor: 'pointer', background: '#f8fafc', borderLeft: '4px solid #6b7280', display: 'flex', alignItems: 'center' }}
                    onClick={() => navigate(`/app/logistica/cargas/${l._id}`)}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <div style={{ fontSize: 18, lineHeight: '22px' }}>
                        <strong>{l.nombre || (l.barco?.nombre_del_barco || 'Sin barco')}</strong>
                      </div>
                      <div style={{ color: 'var(--text-secondary)' }}>
                        {formatDateLabel(l.fecha_de_carga)}{l.hora_de_carga ? `, ${l.hora_de_carga}` : ''}
                      </div>
                      {Array.isArray(l.palets) && l.palets.length > 0 && (
                        <div style={{ marginTop: 4, color: 'var(--text-secondary)' }}>
                          Palets: {l.palets.map(p => p.numero_palet).join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              <Pagination page={loadsListPage} pageSize={loadsListPageSize} total={loadsSorted.length} onPageChange={(p) => setLoadsListPage(Math.max(1, p))} onPageSizeChange={(s) => { setLoadsListPageSize(s); setLoadsListPage(1); }} />
             </div>
           </div>
           <div className="card">
             <div className="card-header">
               <h2 className="card-title">Últimos palets</h2>
             </div>
             <div style={{ padding: 12 }}>

              {latestPalletsPage.length === 0 ? (
                 <div style={{ color: 'var(--text-secondary)' }}>{loading ? 'Cargando...' : 'Sin palets'}</div>
               ) : (

                latestPalletsPage.map(p => (
                  <div
                    key={p._id}
                    className="calendar-item"
                    style={{ padding: '10px 12px', minHeight: 56, marginBottom: 8, cursor: 'pointer', background: '#f8fafc', borderLeft: '4px solid #9ca3af', display: 'flex', alignItems: 'center' }}
                    onClick={() => navigate(`/app/palets/${p._id}`)}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <div style={{ fontSize: 18, lineHeight: '22px' }}>
                        <strong>{p.nombre || p.numero_palet}</strong>
                      </div>
                      <div style={{ color: 'var(--text-secondary)' }}>
                        {p.tipo}{(p.createdAt || p.fecha_creacion) ? ` · ${formatDateLabel(p.createdAt || p.fecha_creacion)}` : ''}
                      </div>
                      {p.contenedor && (
                        <div style={{ marginTop: 4, color: 'var(--text-secondary)' }}>
                          Contenedor: {p.contenedor}
                        </div>
                      )}
                    </div>
                  </div>
                ))
               )}
              <Pagination page={palletsListPage} pageSize={palletsListPageSize} total={palletDocs.length} onPageChange={(p) => setPalletsListPage(Math.max(1, p))} onPageSizeChange={(s) => { setPalletsListPageSize(s); setPalletsListPage(1); }} />
             </div>
           </div>
         </section>
      )}

      <Pagination page={page} pageSize={pageSize} total={filtered.length} onPageChange={(p) => setPage(Math.max(1, p))} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />

      <Modal open={open} title="Crear palet" onClose={() => setOpen(false)} onSubmit={submit} submitLabel="Crear">
        <div>
          <div className="label">Número de palet</div>
          <input className="input" value={form.numero_palet} onChange={e => setForm({ ...form, numero_palet: e.target.value })} placeholder="Nº de palet" />
        </div>
        <div>
          <div className="label">Tipo</div>
          <select className="select" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
            {TIPO_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <div className="label">Carga asociada</div>
          <select className="select" value={form.carga || ''} onChange={e => setForm({ ...form, carga: e.target.value })}>
            <option value="">Selecciona carga</option>
            {loadsSorted.map(l => (
              <option key={l._id} value={l._id}>{(l.nombre || l.barco?.nombre_del_barco || 'Sin barco')} · {formatDateLabel(l.fecha_de_carga)}</option>
            ))}
          </select>
        </div>
        <div>
          <div className="label">Productos</div>
          <textarea className="input" rows="4" value={form.productos} onChange={e => setForm({ ...form, productos: e.target.value })} />
        </div>
      </Modal>

      <Snackbar open={snack.open} message={snack.message} type={snack.type} onClose={() => setSnack(s => ({ ...s, open: false }))} />
    </>
  )
}