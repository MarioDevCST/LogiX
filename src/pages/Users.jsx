import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import DataTable from '../components/DataTable.jsx'
import Modal from '../components/Modal.jsx'
import CardGrid from '../components/CardGrid.jsx'
import Snackbar from '../components/Snackbar.jsx'
import Pagination from '../components/Pagination.jsx'

const ROLE_OPTIONS = [
  { label: 'Administrador', value: 'admin' },
  { label: 'Oficina', value: 'dispatcher' },
  { label: 'Conductor', value: 'driver' },
  { label: 'Almacén', value: 'warehouse' },
  { label: 'Consignatario', value: 'consignee' },
  { label: 'Logistica', value: 'logistic' },
]

export default function Users() {
  const columns = [
    { key: 'name', header: 'Nombre' },
    { key: 'email', header: 'Email' },
    { key: 'role', header: 'Rol' },
    { key: 'active', header: 'Activo' },
  ]

  const navigate = useNavigate()
  const [view, setView] = useState('table') // 'table' | 'cards'
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'dispatcher', active: true })

  // búsqueda y filtros
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all') // 'all' | ROLE value
  const [activeFilter, setActiveFilter] = useState('all') // 'all' | 'true' | 'false'

  // paginación
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // snackbar
  const [snack, setSnack] = useState({ open: false, message: '', type: 'success' })

  // cargar usuarios desde API
  useEffect(() => {
    setLoading(true)
    fetch('/api/users').then(r => r.json()).then(list => {
      const mapped = list.map(u => ({
        id: u._id,
        name: u.name,
        email: u.email,
        role: ROLE_OPTIONS.find(ro => ro.value === u.role)?.label || u.role,
        active: u.active ? 'Sí' : 'No',
        rawRole: u.role,
        rawActive: !!u.active,
      }))
      setRows(mapped)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const onCreate = () => setOpen(true)

  const submit = async () => {
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setSnack({ open: true, message: err.error || 'Error creando usuario', type: 'error' })
        return
      }
      const created = await res.json()
      setRows(prev => ([...prev, {
        id: created._id,
        name: created.name,
        email: created.email,
        role: ROLE_OPTIONS.find(ro => ro.value === created.role)?.label || created.role,
        active: created.active ? 'Sí' : 'No',
        rawRole: created.role,
        rawActive: !!created.active,
      }]))
      setOpen(false)
      setForm({ name: '', email: '', password: '', role: 'dispatcher', active: true })
      setSnack({ open: true, message: 'Usuario creado', type: 'success' })
    } catch (e) {
      setSnack({ open: true, message: 'Error de red creando usuario', type: 'error' })
    }
  }

  const goDetail = (row) => {
    if (row.id) navigate(`/app/admin/usuarios/${row.id}`)
  }

  // filtrar por query, rol y activo
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter(r => {
      const matchesQuery = q === '' || r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q)
      const matchesRole = roleFilter === 'all' || r.rawRole === roleFilter
      const matchesActive = activeFilter === 'all' || String(r.rawActive) === activeFilter
      return matchesQuery && matchesRole && matchesActive
    })
  }, [rows, query, roleFilter, activeFilter])

  // paginar
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize
    const end = start + pageSize
    return filtered.slice(start, end)
  }, [filtered, page, pageSize])

  // reset page al cambiar filtros
  useEffect(() => { setPage(1) }, [query, roleFilter, activeFilter])

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            className="input"
            style={{ width: 280 }}
            placeholder="Buscar por nombre o email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select className="select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="all">Todos los roles</option>
            {ROLE_OPTIONS.map(ro => (
              <option key={ro.value} value={ro.value}>{ro.label}</option>
            ))}
          </select>
          <select className="select" value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}>
            <option value="all">Todos</option>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="icon-button" title="Vista tabla" onClick={() => setView('table')}>
            <span className="material-symbols-outlined">table</span>
          </button>
          <button className="icon-button" title="Vista tarjetas" onClick={() => setView('cards')}>
            <span className="material-symbols-outlined">view_agenda</span>
          </button>
        </div>
      </div>

      {view === 'table' ? (
        <DataTable title="Usuarios" columns={columns} data={paginated} loading={loading} createLabel="Crear usuario" onCreate={onCreate} onRowClick={goDetail} />
      ) : (
        <CardGrid title="Usuarios" items={paginated.map(i => ({ ...i, name: i.name, subtitle: i.email, role: i.role, active: i.active }))} loading={loading} onCreate={onCreate} createLabel="Crear usuario" onCardClick={goDetail} />
      )}

      <Pagination page={page} pageSize={pageSize} total={filtered.length} onPageChange={(p) => setPage(Math.max(1, p))} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />

      <Modal open={open} title="Crear usuario" onClose={() => setOpen(false)} onSubmit={submit} submitLabel="Crear">
        <div>
          <div className="label">Nombre</div>
          <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nombre" />
        </div>
        <div>
          <div className="label">Email</div>
          <input className="input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@dominio.com" />
        </div>
        <div>
          <div className="label">Rol</div>
          <select className="select" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
            {ROLE_OPTIONS.map(ro => (
              <option key={ro.value} value={ro.value}>{ro.label}</option>
            ))}
          </select>
        </div>
        <div>
          <div className="label">Activo</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />
            Activo
          </label>
        </div>
      </Modal>

      <Snackbar open={snack.open} message={snack.message} type={snack.type} onClose={() => setSnack(s => ({ ...s, open: false }))} />
    </>
  )
}