import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import DataTable from '../components/DataTable.jsx'
import CardGrid from '../components/CardGrid.jsx'
import Modal from '../components/Modal.jsx'
import Snackbar from '../components/Snackbar.jsx'
import Pagination from '../components/Pagination.jsx'
import { getCurrentUser } from '../utils/roles.js'

export default function Consignees() {
  const navigate = useNavigate()
  const columns = [
    { key: 'nombre', header: 'Nombre' },
    { key: 'acciones', header: 'Acciones' },
  ]

  const [view, setView] = useState('table')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ nombre: '' })

  const [openEdit, setOpenEdit] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ nombre: '' })

  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [snack, setSnack] = useState({ open: false, message: '', type: 'success' })

  useEffect(() => {
    setLoading(true)
    fetch('/api/consignees').then(r => r.json()).then(list => {
      const mapped = list.map(c => ({
        id: c._id,
        nombre: c.nombre,
        acciones: (
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="icon-button" title="Editar" onClick={(e) => { e.stopPropagation(); startEdit(c._id) }}>
              <span className="material-symbols-outlined">edit</span>
            </button>
            <button className="icon-button" title="Borrar" onClick={(e) => { e.stopPropagation(); handleDelete(c._id) }}>
              <span className="material-symbols-outlined">delete</span>
            </button>
          </div>
        ),
      }))
      setRows(mapped)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const startEdit = async (id) => {
    try {
      const res = await fetch(`/api/consignees/${id}`)
      if (!res.ok) return
      const c = await res.json()
      setEditingId(id)
      setEditForm({ nombre: c.nombre || '' })
      setOpenEdit(true)
    } catch (e) {}
  }

  const handleDelete = async (id) => {
    if (!window.confirm('¿Seguro que deseas borrar este consignatario?')) return
    try {
      const res = await fetch(`/api/consignees/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setSnack({ open: true, message: err.error || 'Error borrando consignatario', type: 'error' })
        return
      }
      setRows(prev => prev.filter(r => r.id !== id))
      setSnack({ open: true, message: 'Consignatario borrado', type: 'success' })
    } catch (e) {
      setSnack({ open: true, message: 'Error de red borrando consignatario', type: 'error' })
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter(r => q === '' || r.nombre.toLowerCase().includes(q))
  }, [rows, query])

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize
    const end = start + pageSize
    return filtered.slice(start, end)
  }, [filtered, page, pageSize])

  const onCreate = () => setOpen(true)

  const submit = async () => {
    try {
      if (!form.nombre) {
        setSnack({ open: true, message: 'El nombre es obligatorio', type: 'error' })
        return
      }
      const payload = { nombre: form.nombre, creado_por: (getCurrentUser()?.name || 'Testing') }
      const res = await fetch('/api/consignees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setSnack({ open: true, message: err.error || 'Error creando consignatario', type: 'error' })
        return
      }
      const created = await res.json()
      setRows(prev => ([...prev, {
        id: created._id,
        nombre: created.nombre,
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
      setForm({ nombre: '' })
      setSnack({ open: true, message: 'Consignatario creado', type: 'success' })
    } catch (e) {
      setSnack({ open: true, message: 'Error de red creando consignatario', type: 'error' })
    }
  }

  const submitEdit = async () => {
    try {
      if (!editingId) return
      if (!editForm.nombre) {
        setSnack({ open: true, message: 'El nombre es obligatorio', type: 'error' })
        return
      }
      const payload = { nombre: editForm.nombre, modificado_por: (getCurrentUser()?.name || 'Testing') }
      const res = await fetch(`/api/consignees/${editingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setSnack({ open: true, message: err.error || 'Error actualizando consignatario', type: 'error' })
        return
      }
      const updated = await res.json()
      setRows(prev => prev.map(r => r.id === editingId ? {
        ...r,
        nombre: updated.nombre,
      } : r))
      setOpenEdit(false)
      setEditingId(null)
      setSnack({ open: true, message: 'Consignatario actualizado', type: 'success' })
    } catch (e) {
      setSnack({ open: true, message: 'Error de red actualizando consignatario', type: 'error' })
    }
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            className="input"
            style={{ width: 280 }}
            placeholder="Buscar por nombre"
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
        <DataTable title="Consignatarios" columns={columns} data={paginated} loading={loading} createLabel={'Crear consignatario'} onCreate={onCreate} onRowClick={(row) => navigate(`/app/admin/consignatarios/${row.id}`)} />
      ) : (
        <CardGrid title="Consignatarios" items={paginated.map(i => ({ ...i, name: i.nombre }))} loading={loading} createLabel={'Crear consignatario'} onCreate={onCreate} onCardClick={(item) => navigate(`/app/admin/consignatarios/${item.id}`)} />
      )}

      <Pagination page={page} pageSize={pageSize} total={filtered.length} onPageChange={(p) => setPage(Math.max(1, p))} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />

      <Modal open={open} title="Crear consignatario" onClose={() => setOpen(false)} onSubmit={submit} submitLabel="Crear">
        <div>
          <div className="label">Nombre</div>
          <input className="input" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre" />
        </div>
      </Modal>

      <Modal open={openEdit} title="Editar consignatario" onClose={() => setOpenEdit(false)} onSubmit={submitEdit} submitLabel="Guardar">
        <div>
          <div className="label">Nombre</div>
          <input className="input" value={editForm.nombre} onChange={e => setEditForm({ ...editForm, nombre: e.target.value })} placeholder="Nombre" />
        </div>
      </Modal>

      <Snackbar open={snack.open} message={snack.message} type={snack.type} onClose={() => setSnack(s => ({ ...s, open: false }))} />
    </>
  )
}