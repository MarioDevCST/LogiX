import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import DataTable from '../components/DataTable.jsx'
import CardGrid from '../components/CardGrid.jsx'
import Modal from '../components/Modal.jsx'
import Snackbar from '../components/Snackbar.jsx'
import Pagination from '../components/Pagination.jsx'
import { getCurrentUser } from '../utils/roles.js'

export default function Locations() {
  const columns = [
    { key: 'nombre', header: 'Nombre' },
    { key: 'ciudad', header: 'Ciudad' },
    { key: 'puerto', header: 'Puerto' },
  ]

  const navigate = useNavigate()
  const [view, setView] = useState('table')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ nombre: '', ciudad: '', puerto: '', coordenadas: '' })
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [snack, setSnack] = useState({ open: false, message: '', type: 'success' })
  const mapsEnabled = import.meta.env.VITE_FEATURE_MAPS === 'enabled'
  const hasMapsKey = !!import.meta.env.VITE_GOOGLE_MAPS_API_KEY

  useEffect(() => {
    setLoading(true)
    fetch('/api/locations').then(r => r.json()).then(list => {
      const mapped = list.map(l => ({ id: l._id, nombre: l.nombre || '', ciudad: l.ciudad || '', puerto: l.puerto || '', coordenadas: l.coordenadas || '' }))
      setRows(mapped)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const onCreate = () => setOpen(true)

  const submit = async () => {
    try {
      const res = await fetch('/api/locations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, creado_por: (getCurrentUser()?.name || 'Testing') }) })
      if (!res.ok) throw new Error('Error al crear localización')
      const created = await res.json()
      setRows(rows => [{ id: created._id, nombre: created.nombre || '', ciudad: created.ciudad || '', puerto: created.puerto || '', coordenadas: created.coordenadas || '' }, ...rows])
      setOpen(false)
      setSnack({ open: true, message: 'Localización creada', type: 'success' })
    } catch (e) {
      setSnack({ open: true, message: e.message || 'Error', type: 'error' })
    }
  }

  const goDetail = (row) => {
    if (row.id) navigate(`/app/admin/localizaciones/${row.id}`)
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter(r => q === '' || r.nombre.toLowerCase().includes(q) || r.ciudad.toLowerCase().includes(q) || r.puerto.toLowerCase().includes(q))
  }, [rows, query])

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize
    const end = start + pageSize
    return filtered.slice(start, end)
  }, [filtered, page, pageSize])

  useEffect(() => { setPage(1) }, [query])

  // Geolocalización con Google Maps Geocoding API (feature flag)
  const geocodeWithGoogle = async () => {
    if (!mapsEnabled) {
      setSnack({ open: true, message: 'La geolocalización por Google Maps estará disponible próximamente.', type: 'info' })
      return
    }
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      setSnack({ open: true, message: 'Configura la API key para Google Maps en .env', type: 'warning' })
      return
    }
    const address = (form.coordenadas || `${form.nombre} ${form.ciudad} ${form.puerto}`).trim()
    if (!address) {
      setSnack({ open: true, message: 'Introduce texto para buscar en Maps', type: 'warning' })
      return
    }
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}&language=es`
      const res = await fetch(url)
      const json = await res.json()
      if (json.status !== 'OK' || !json.results?.length) {
        const msg = json.status === 'ZERO_RESULTS' ? 'Sin resultados para la dirección' : `Error de Google Maps: ${json.status || 'desconocido'}`
        setSnack({ open: true, message: msg, type: 'warning' })
        return
      }
      const loc = json.results[0].geometry.location
      setForm({ ...form, coordenadas: `${loc.lat},${loc.lng}` })
      setSnack({ open: true, message: 'Coordenadas obtenidas desde Google Maps', type: 'success' })
    } catch (e) {
      setSnack({ open: true, message: 'No se pudo geolocalizar (red/API)', type: 'error' })
    }
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <input className="input" style={{ width: 320 }} placeholder="Buscar por nombre, ciudad o puerto" value={query} onChange={e => setQuery(e.target.value)} />
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
        <DataTable title="Localizaciones" columns={columns} data={paginated} loading={loading} createLabel="Crear localización" onCreate={onCreate} onRowClick={goDetail} />
      ) : (
        <CardGrid title="Localizaciones" items={paginated.map(i => ({ ...i, name: i.nombre, subtitle: `${i.ciudad}${i.puerto ? ' · ' + i.puerto : ''}` }))} loading={loading} onCreate={onCreate} createLabel="Crear localización" onCardClick={goDetail} />
      )}

      <Pagination page={page} pageSize={pageSize} total={filtered.length} onPageChange={(p) => setPage(Math.max(1, p))} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />

      <Modal open={open} title="Crear localización" onClose={() => setOpen(false)} onSubmit={submit} submitLabel="Crear">
        <div>
          <div className="label">Nombre</div>
          <input className="input" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre de la localización" />
        </div>
        <div>
          <div className="label">Ciudad</div>
          <input className="input" value={form.ciudad} onChange={e => setForm({ ...form, ciudad: e.target.value })} placeholder="Ciudad" />
        </div>
        <div>
          <div className="label">Puerto (opcional)</div>
          <input className="input" value={form.puerto} onChange={e => setForm({ ...form, puerto: e.target.value })} placeholder="Puerto" />
        </div>
        <div>
          <div className="label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Coordenadas (opcional)</span>
            <button className="icon-button" title={mapsEnabled ? 'Obtener coordenadas en Google Maps' : 'Geolocalización próximamente'} onClick={geocodeWithGoogle}>
              <span className="material-symbols-outlined">pin_drop</span>
            </button>
          </div>
          <input className="input" value={form.coordenadas} onChange={e => setForm({ ...form, coordenadas: e.target.value })} placeholder="Lat,Lng o texto" />
          {!mapsEnabled && (
            <div style={{ marginTop: 4, fontSize: 12, color: '#6b7280' }}>Función de geolocalización en desarrollo. Próximamente.</div>
          )}
        </div>
      </Modal>

      <Snackbar open={snack.open} message={snack.message} type={snack.type} onClose={() => setSnack(s => ({ ...s, open: false }))} />
    </>
  )
}