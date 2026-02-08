import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Modal from '../components/Modal.jsx'
import Snackbar from '../components/Snackbar.jsx'

const ROLE_OPTIONS = [
  { label: 'Administrador', value: 'admin' },
  { label: 'Oficina', value: 'dispatcher' },
  { label: 'Conductor', value: 'driver' },
  { label: 'Almacén', value: 'warehouse' },
  { label: 'Logistica', value: 'logistic' },
]

export default function UserDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', role: 'dispatcher', active: true })
  const [snack, setSnack] = useState({ open: false, message: '', type: 'success' })

  useEffect(() => {
    fetch(`/api/users/${id}`).then(r => r.json()).then(u => {
      setUser(u)
      setForm({ name: u.name, email: u.email, role: u.role, active: u.active })
    }).catch(() => {})
  }, [id])

  const submit = async () => {
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setSnack({ open: true, message: err.error || 'Error actualizando usuario', type: 'error' })
        return
      }
      const updated = await res.json()
      setUser(updated)
      setOpen(false)
      setSnack({ open: true, message: 'Usuario actualizado', type: 'success' })
    } catch (e) {
      setSnack({ open: true, message: 'Error de red actualizando usuario', type: 'error' })
    }
  }

  if (!user) return <p>Cargando...</p>

  return (
    <section className="card">
      <div className="card-header">
        <h2 className="card-title">Detalle usuario</h2>
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
        <p><strong>Nombre:</strong> {user.name}</p>
        <p><strong>Email:</strong> {user.email}</p>
        <p><strong>Rol:</strong> {ROLE_OPTIONS.find(ro => ro.value === user.role)?.label || user.role}</p>
        <p><strong>Activo:</strong> {user.active ? 'Sí' : 'No'}</p>
      </div>

      <Modal open={open} title="Modificar usuario" onClose={() => setOpen(false)} onSubmit={submit} submitLabel="Guardar">
        <div>
          <div className="label">Nombre</div>
          <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <div className="label">Email</div>
          <input className="input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="form-row">
          <div>
            <div className="label">Rol</div>
            <select className="select" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
              {ROLE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="label">Activo</div>
            <select className="select" value={form.active ? 'true' : 'false'} onChange={e => setForm({ ...form, active: e.target.value === 'true' })}>
              <option value="true">Sí</option>
              <option value="false">No</option>
            </select>
          </div>
        </div>
      </Modal>

      <Snackbar open={snack.open} message={snack.message} type={snack.type} onClose={() => setSnack(s => ({ ...s, open: false }))} />
    </section>
  )
}