import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import DataTable from '../components/DataTable.jsx'
import CardGrid from '../components/CardGrid.jsx'
import Modal from '../components/Modal.jsx'
import Snackbar from '../components/Snackbar.jsx'
import Pagination from '../components/Pagination.jsx'
import { getCurrentUser } from '../utils/roles.js'

export default function Companies() {
  const columns = [
    { key: 'nombre', header: 'Nombre' },
    { key: 'fecha', header: 'Creación' },
  ]

  const navigate = useNavigate()
  const [view, setView] = useState('table')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ nombre: '' })
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [snack, setSnack] = useState({ open: false, message: '', type: 'success' })

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/companies')
        const list = await res.json()
        const mapped = list.map(c => ({ id: c._id, nombre: c.nombre, fecha: new Date(c.createdAt).toLocaleDateString() }))
        setRows(mapped)
      } catch (e) {
        // noop
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const onCreate = () => setOpen(true)

  const submit = async () => {
    try {
      if (!form.nombre) {
        setSnack({ open: true, message: 'El nombre es obligatorio', type: 'error' })
        return
      }
      const res = await fetch('/api/companies', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, creado_por: (getCurrentUser()?.name || 'Testing') })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setSnack({ open: true, message: err.error || 'Error creando empresa', type: 'error' })
        return
      }
      const created = await res.json()
      setRows(prev => ([...prev, { id: created._id, nombre: created.nombre, fecha: new Date(created.createdAt).toLocaleDateString() }]))
      setOpen(false)
      setForm({ nombre: '' })
      setSnack({ open: true, message: 'Empresa creada', type: 'success' })
    } catch (e) {
      setSnack({ open: true, message: 'Error de red creando empresa', type: 'error' })
    }
  }

  const goDetail = (row) => {
    if (row.id) navigate(`/app/admin/empresas/${row.id}`)
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

  useEffect(() => { setPage(1) }, [query])

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <input className="input" style={{ width: 280 }} placeholder="Buscar por nombre" value={query} onChange={e => setQuery(e.target.value)} />
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
        <DataTable title="Empresas" columns={columns} data={paginated} loading={loading} createLabel="Crear empresa" onCreate={onCreate} onRowClick={goDetail} />
      ) : (
        <CardGrid title="Empresas" items={paginated.map(i => ({ ...i, name: i.nombre, subtitle: i.fecha }))} loading={loading} onCreate={onCreate} createLabel="Crear empresa" onCardClick={goDetail} />
      )}

      <Pagination page={page} pageSize={pageSize} total={filtered.length} onPageChange={(p) => setPage(Math.max(1, p))} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />

      <Modal open={open} title="Crear empresa" onClose={() => setOpen(false)} onSubmit={submit} submitLabel="Crear">
        <div>
          <div className="label">Nombre</div>
          <input className="input" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre de la empresa" />
        </div>
      </Modal>

      <Snackbar open={snack.open} message={snack.message} type={snack.type} onClose={() => setSnack(s => ({ ...s, open: false }))} />
    </>
  )
}