import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Modal from '../components/Modal.jsx'
import Snackbar from '../components/Snackbar.jsx'
import { getCurrentUser } from '../utils/roles.js'

export default function LocationDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [location, setLocation] = useState(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ nombre: '', ciudad: '', puerto: '', coordenadas: '' })
  const [snack, setSnack] = useState({ open: false, message: '', type: 'success' })

  useEffect(() => {
    fetch(`/api/locations/${id}`).then(r => r.json()).then(l => {
      setLocation(l)
      setForm({ nombre: l.nombre || '', ciudad: l.ciudad || '', puerto: l.puerto || '', coordenadas: l.coordenadas || '' })
    }).catch(() => {})
  }, [id])

  const submit = async () => {
    try {
      const res = await fetch(`/api/locations/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, modificado_por: (getCurrentUser()?.name || 'Testing') }) })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setSnack({ open: true, message: err.error || 'Error actualizando localización', type: 'error' })
        return
      }
      const updated = await res.json()
      setLocation(updated)
      setOpen(false)
      setSnack({ open: true, message: 'Localización actualizada', type: 'success' })
    } catch (e) {
      setSnack({ open: true, message: 'Error de red actualizando localización', type: 'error' })
    }
  }

  if (!location) return <p>Cargando...</p>

  return (
    <section className="card">
      <div className="card-header">
        <h2 className="card-title">Detalle localización</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="icon-button" onClick={() => setOpen(true)} title="Modificar">
            <span className="material-symbols-outlined">edit</span>
          </button>
          <button className="icon-button" onClick={() => navigate(-1)} title="Atrás">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
        </div>
      </div>
      <div style={{ padding: 16 }}>
        <p><strong>Nombre:</strong> {location.nombre}</p>
        <p><strong>Ciudad:</strong> {location.ciudad}</p>
        <p><strong>Puerto:</strong> {location.puerto || '-'}</p>
        <p><strong>Coordenadas:</strong> {location.coordenadas || '-'}</p>
      </div>

      <Modal open={open} title="Modificar localización" onClose={() => setOpen(false)} onSubmit={submit} submitLabel="Guardar">
        <div>
          <div className="label">Nombre</div>
          <input className="input" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
        </div>
        <div>
          <div className="label">Ciudad</div>
          <input className="input" value={form.ciudad} onChange={e => setForm({ ...form, ciudad: e.target.value })} />
        </div>
        <div>
          <div className="label">Puerto</div>
          <input className="input" value={form.puerto} onChange={e => setForm({ ...form, puerto: e.target.value })} />
        </div>
        <div>
          <div className="label">Coordenadas</div>
          <input className="input" value={form.coordenadas} onChange={e => setForm({ ...form, coordenadas: e.target.value })} />
        </div>
      </Modal>

      <Snackbar open={snack.open} message={snack.message} type={snack.type} onClose={() => setSnack(s => ({ ...s, open: false }))} />
    </section>
  )
}
