import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import DataTable from '../components/DataTable.jsx'
import CardGrid from '../components/CardGrid.jsx'
import Modal from '../components/Modal.jsx'
import Snackbar from '../components/Snackbar.jsx'
import Pagination from '../components/Pagination.jsx'

export default function Ships() {
  const columns = [
    { key: 'nombre', header: 'Nombre del barco' },
    { key: 'empresa', header: 'Empresa' },
    { key: 'responsable', header: 'Responsable' },
    { key: 'tipo', header: 'Tipo' },
  ]

  const navigate = useNavigate()
  const [view, setView] = useState('table')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ nombre_del_barco: '', empresa: '', responsable: '', tipo: 'Mercante' })
  const [companies, setCompanies] = useState([])
  const [users, setUsers] = useState([])
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [snack, setSnack] = useState({ open: false, message: '', type: 'success' })

  // modales de creación rápida
  const [openCreateCompany, setOpenCreateCompany] = useState(false)
  const [companyForm, setCompanyForm] = useState({ nombre: '' })
  const [openCreateUser, setOpenCreateUser] = useState(false)
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: '' })

  useEffect(() => {
    setLoading(true)
    fetch('/api/ships').then(r => r.json()).then(list => {
      const mapped = list.map(s => ({
        id: s._id,
        nombre: s.nombre_del_barco,
        empresa: s.empresa?.nombre || '',
        responsable: s.responsable?.name || '',
        tipo: s.tipo || '',
      }))
      setRows(mapped)
    }).catch(() => {}).finally(() => setLoading(false))
    fetch('/api/companies').then(r => r.json()).then(setCompanies).catch(() => {})
    fetch('/api/users').then(r => r.json()).then(setUsers).catch(() => {})
  }, [])

  const onCreate = () => setOpen(true)

  const submit = async () => {
    try {
      if (!form.nombre_del_barco) {
        setSnack({ open: true, message: 'El nombre del barco es obligatorio', type: 'error' })
        return
      }
      const payload = { ...form, creado_por: 'Testing' }
      const res = await fetch('/api/ships', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setSnack({ open: true, message: err.error || 'Error creando barco', type: 'error' })
        return
      }
      const created = await res.json()
      setRows(prev => ([...prev, {
        id: created._id,
        nombre: created.nombre_del_barco,
        empresa: created.empresa?.nombre || '',
        responsable: created.responsable?.name || '',
        tipo: created.tipo || '',
      }]))
      setOpen(false)
      setForm({ nombre_del_barco: '', empresa: '', responsable: '', tipo: 'Mercante' })
      setSnack({ open: true, message: 'Barco creado', type: 'success' })
    } catch (e) {
      setSnack({ open: true, message: 'Error de red creando barco', type: 'error' })
    }
  }

  const goDetail = (row) => {
    if (row.id) navigate(`/app/admin/barcos/${row.id}`)
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter(r => q === '' || r.nombre.toLowerCase().includes(q) || r.empresa.toLowerCase().includes(q) || r.responsable.toLowerCase().includes(q) || r.tipo.toLowerCase().includes(q))
  }, [rows, query])

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize
    const end = start + pageSize
    return filtered.slice(start, end)
  }, [filtered, page, pageSize])

  useEffect(() => { setPage(1) }, [query])

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <input className="input" style={{ width: 320 }} placeholder="Buscar por nombre, empresa, responsable o tipo" value={query} onChange={e => setQuery(e.target.value)} />
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
        <DataTable title="Barcos" columns={columns} data={paginated} loading={loading} createLabel="Crear barco" onCreate={onCreate} onRowClick={goDetail} />
      ) : (
        <CardGrid title="Barcos" items={paginated.map(i => ({ ...i, name: i.nombre, subtitle: `${i.empresa} · ${i.responsable} · ${i.tipo}` }))} loading={loading} onCreate={onCreate} createLabel="Crear barco" onCardClick={goDetail} />
      )}

      <Pagination page={page} pageSize={pageSize} total={filtered.length} onPageChange={(p) => setPage(Math.max(1, p))} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />

      <Modal open={open} title="Crear barco" onClose={() => setOpen(false)} onSubmit={submit} submitLabel="Crear">
        <div>
          <div className="label">Nombre del barco</div>
          <input className="input" value={form.nombre_del_barco} onChange={e => setForm({ ...form, nombre_del_barco: e.target.value })} placeholder="Nombre del barco" />
        </div>
        <div>
          <div className="label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Empresa</span>
            <button className="icon-button" title="Crear empresa" onClick={() => setOpenCreateCompany(true)}>
              <span className="material-symbols-outlined">add_business</span>
            </button>
          </div>
          <select className="input" value={form.empresa} onChange={e => setForm({ ...form, empresa: e.target.value })}>
            <option value="">Sin empresa</option>
            {companies.map(c => (
              <option key={c._id} value={c._id}>{c.nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <div className="label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Responsable</span>
            <button className="icon-button" title="Crear usuario" onClick={() => setOpenCreateUser(true)}>
              <span className="material-symbols-outlined">person_add</span>
            </button>
          </div>
          <select className="input" value={form.responsable} onChange={e => setForm({ ...form, responsable: e.target.value })}>
            <option value="">Sin responsable</option>
            {users.map(u => (
              <option key={u._id} value={u._id}>{u.name} ({u.email})</option>
            ))}
          </select>
        </div>
        <div>
          <div className="label">Tipo</div>
          <select className="select" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
            <option value="Mercante">Mercante</option>
            <option value="Ferry">Ferry</option>
            <option value="Crucero">Crucero</option>
          </select>
        </div>
      </Modal>

      {/* Modal crear empresa */}
      <Modal open={openCreateCompany} title="Crear empresa" onClose={() => setOpenCreateCompany(false)} onSubmit={async () => {
        try {
          if (!companyForm.nombre) {
            setSnack({ open: true, message: 'El nombre es obligatorio', type: 'error' })
            return
          }
          const res = await fetch('/api/companies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...companyForm, creado_por: 'Testing' }) })
          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            setSnack({ open: true, message: err.error || 'Error creando empresa', type: 'error' })
            return
          }
          const created = await res.json()
          setCompanies(prev => ([...prev, created]))
          setOpenCreateCompany(false)
          setCompanyForm({ nombre: '' })
          setSnack({ open: true, message: 'Empresa creada', type: 'success' })
        } catch (e) {
          setSnack({ open: true, message: 'Error de red creando empresa', type: 'error' })
        }
      }} submitLabel="Crear">
        <div>
          <div className="label">Nombre</div>
          <input className="input" value={companyForm.nombre} onChange={e => setCompanyForm({ ...companyForm, nombre: e.target.value })} placeholder="Nombre de la empresa" />
        </div>
      </Modal>

      {/* Modal crear usuario */}
      <Modal open={openCreateUser} title="Crear usuario" onClose={() => setOpenCreateUser(false)} onSubmit={async () => {
        try {
          if (!userForm.name || !userForm.email || !userForm.password || !userForm.role) {
          setSnack({ open: true, message: 'Nombre, email, contraseña y rol son obligatorios', type: 'error' })
          return
        }
          const res = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...userForm, creado_por: 'Testing' }) })
          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            setSnack({ open: true, message: err.error || 'Error creando usuario', type: 'error' })
            return
          }
          const created = await res.json()
          setUsers(prev => ([...prev, created]))
          setOpenCreateUser(false)
          setUserForm({ name: '', email: '', password: '', role: '' })
          setSnack({ open: true, message: 'Usuario creado', type: 'success' })
        } catch (e) {
          setSnack({ open: true, message: 'Error de red creando usuario', type: 'error' })
        }
      }} submitLabel="Crear">
        <div>
          <div className="label">Nombre</div>
          <input className="input" value={userForm.name} onChange={e => setUserForm({ ...userForm, name: e.target.value })} placeholder="Nombre" />
        </div>
        <div>
          <div className="label">Email</div>
          <input className="input" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} placeholder="email@dominio.com" />
        </div>
        <div>
          <div className="label">Contraseña</div>
          <input className="input" type="password" value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} placeholder="Contraseña" />
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

      <Snackbar open={snack.open} message={snack.message} type={snack.type} onClose={() => setSnack(s => ({ ...s, open: false }))} />
    </>
  )
}