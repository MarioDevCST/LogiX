import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DataTable from '../components/DataTable.jsx'
import CardGrid from '../components/CardGrid.jsx'
import Modal from '../components/Modal.jsx'
import Snackbar from '../components/Snackbar.jsx'
import Pagination from '../components/Pagination.jsx'
import { ROLES, ROLE_LABELS, getCurrentUser } from '../utils/roles.js'

export default function Messages() {
  const navigate = useNavigate()
  const columns = [
    { key: 'titulo', header: 'Título' },
    { key: 'roles', header: 'Roles' },
    { key: 'acciones', header: 'Acciones' },
  ]

  const [view, setView] = useState('table')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ titulo: '', cuerpo: '', roles: [] })

  const [openEdit, setOpenEdit] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ titulo: '', cuerpo: '', roles: [] })

  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [snack, setSnack] = useState({ open: false, message: '', type: 'success' })

  const startEdit = async (id) => {
    try {
      const res = await fetch(`/api/messages/${id}`)
      if (!res.ok) return
      const m = await res.json()
      setEditingId(id)
      setEditForm({ titulo: m.titulo || '', cuerpo: m.cuerpo || '', roles: Array.isArray(m.roles) ? m.roles : [] })
      setOpenEdit(true)
    } catch (e) {
      setSnack({ open: true, message: 'Error de red cargando mensaje', type: 'error' })
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('¿Seguro que deseas borrar este mensaje?')) return
    try {
      const res = await fetch(`/api/messages/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setSnack({ open: true, message: err.error || 'Error borrando mensaje', type: 'error' })
        return
      }
      setRows(prev => prev.filter(r => r.id !== id))
      setSnack({ open: true, message: 'Mensaje borrado', type: 'success' })
    } catch (e) {
      setSnack({ open: true, message: 'Error de red borrando mensaje', type: 'error' })
    }
  }

  useEffect(() => {
    setLoading(true)
    fetch('/api/messages').then(r => r.json()).then(list => {
      const mapped = list.map(m => ({
        id: m._id,
        titulo: m.titulo,
        roles: (Array.isArray(m.roles) && m.roles.length > 0) ? m.roles.map((r) => ROLE_LABELS[r] || r).join(', ') : 'Todos',
        acciones: (
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="icon-button" title="Editar" onClick={(e) => { e.stopPropagation(); startEdit(m._id) }}>
              <span className="material-symbols-outlined">edit</span>
            </button>
            <button className="icon-button" title="Borrar" onClick={(e) => { e.stopPropagation(); handleDelete(m._id) }}>
              <span className="material-symbols-outlined">delete</span>
            </button>
          </div>
        ),
      }))
      setRows(mapped)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter(r => q === '' || r.titulo.toLowerCase().includes(q))
  }, [rows, query])

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize
    const end = start + pageSize
    return filtered.slice(start, end)
  }, [filtered, page, pageSize])

  const onCreate = () => setOpen(true)

  const submit = async () => {
    try {
      if (!form.titulo || !form.cuerpo) {
        setSnack({ open: true, message: 'Título y cuerpo son obligatorios', type: 'error' })
        return
      }
      const payload = { titulo: form.titulo, cuerpo: form.cuerpo, roles: form.roles, creado_por: (getCurrentUser()?.name || 'Testing') }
      const res = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setSnack({ open: true, message: err.error || 'Error creando mensaje', type: 'error' })
        return
      }
      const created = await res.json()
      setRows(prev => ([...prev, {
        id: created._id,
        titulo: created.titulo,
        roles: (Array.isArray(created.roles) && created.roles.length > 0) ? created.roles.map((r) => ROLE_LABELS[r] || r).join(', ') : 'Todos',
        acciones: (
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="icon-button" title="Editar" onClick={(e) => { e.stopPropagation(); startEdit(created._id) }}>
              <span className="material-symbols-outlined">edit</span>
            </button>
            <button className="icon-button" title="Borrar" onClick={(e) => { e.stopPropagation(); handleDelete(created._id) }}>
              <span className="material-symbols-outlined">delete</span>
            </button>
          </div>
        ),
      }]))
      setOpen(false)
      setForm({ titulo: '', cuerpo: '', roles: [] })
      setSnack({ open: true, message: 'Mensaje creado', type: 'success' })
    } catch (e) {
      setSnack({ open: true, message: 'Error de red creando mensaje', type: 'error' })
    }
  }

  const submitEdit = async () => {
    try {
      if (!editingId) return
      if (!editForm.titulo || !editForm.cuerpo) {
        setSnack({ open: true, message: 'Título y cuerpo son obligatorios', type: 'error' })
        return
      }
      const payload = { titulo: editForm.titulo, cuerpo: editForm.cuerpo, roles: editForm.roles, modificado_por: (getCurrentUser()?.name || 'Testing') }
      const res = await fetch(`/api/messages/${editingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setSnack({ open: true, message: err.error || 'Error actualizando mensaje', type: 'error' })
        return
      }
      const updated = await res.json()
      setRows(prev => prev.map(r => r.id === editingId ? {
        ...r,
        titulo: updated.titulo,
        roles: (Array.isArray(updated.roles) && updated.roles.length > 0) ? updated.roles.map((r) => ROLE_LABELS[r] || r).join(', ') : 'Todos',
      } : r))
      setOpenEdit(false)
      setEditingId(null)
      setSnack({ open: true, message: 'Mensaje actualizado', type: 'success' })
    } catch (e) {
      setSnack({ open: true, message: 'Error de red actualizando mensaje', type: 'error' })
    }
  }

  const toggleRole = (role) => {
    const has = form.roles.includes(role)
    setForm({ ...form, roles: has ? form.roles.filter(r => r !== role) : [...form.roles, role] })
  }

  const toggleRoleEdit = (role) => {
    const has = editForm.roles.includes(role)
    setEditForm({ ...editForm, roles: has ? editForm.roles.filter(r => r !== role) : [...editForm.roles, role] })
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            className="input"
            style={{ width: 280 }}
            placeholder="Buscar por título"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
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
        <DataTable title="Mensajes" columns={columns} data={paginated} loading={loading} createLabel={'Crear mensaje'} onCreate={onCreate} onRowClick={(row) => navigate(`/app/admin/mensajes/${row.id}`)} />
      ) : (
        <CardGrid title="Mensajes" items={paginated.map(i => ({ ...i, name: i.titulo }))} loading={loading} createLabel={'Crear mensaje'} onCreate={onCreate} onCardClick={(item) => navigate(`/app/admin/mensajes/${item.id}`)} />
      )}

      <Pagination page={page} pageSize={pageSize} total={filtered.length} onPageChange={(p) => setPage(Math.max(1, p))} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />

      <Modal open={open} title="Crear mensaje" onClose={() => setOpen(false)} onSubmit={submit} submitLabel="Crear">
        <div>
          <div className="label">Título</div>
          <input className="input" value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} placeholder="Título" />
        </div>
        <div>
          <div className="label">Cuerpo</div>
          <textarea className="input" value={form.cuerpo} onChange={e => setForm({ ...form, cuerpo: e.target.value })} placeholder="Contenido del mensaje" rows={5} />
        </div>
        <div>
          <div className="label">Roles destinatarios</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {Object.values(ROLES).map(role => (
              <label key={role} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={form.roles.includes(role)} onChange={() => toggleRole(role)} />
                {ROLE_LABELS[role] || role}
              </label>
            ))}
          </div>
          <small>Si no seleccionas ningún rol, el mensaje será visible para todos.</small>
        </div>
      </Modal>

      <Modal open={openEdit} title="Editar mensaje" onClose={() => setOpenEdit(false)} onSubmit={submitEdit} submitLabel="Guardar">
        <div>
          <div className="label">Título</div>
          <input className="input" value={editForm.titulo} onChange={e => setEditForm({ ...editForm, titulo: e.target.value })} placeholder="Título" />
        </div>
        <div>
          <div className="label">Cuerpo</div>
          <textarea className="input" value={editForm.cuerpo} onChange={e => setEditForm({ ...editForm, cuerpo: e.target.value })} placeholder="Contenido del mensaje" rows={5} />
        </div>
        <div>
          <div className="label">Roles destinatarios</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {Object.values(ROLES).map(role => (
              <label key={role} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={editForm.roles.includes(role)} onChange={() => toggleRoleEdit(role)} />
                {ROLE_LABELS[role] || role}
              </label>
            ))}
          </div>
          <small>Si no seleccionas ningún rol, el mensaje será visible para todos.</small>
        </div>
      </Modal>

      <Snackbar open={snack.open} message={snack.message} type={snack.type} onClose={() => setSnack(s => ({ ...s, open: false }))} />
    </>
  )
}
