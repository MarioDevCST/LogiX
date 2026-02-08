import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Modal from '../components/Modal.jsx'
import Snackbar from '../components/Snackbar.jsx'

export default function CompanyDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [company, setCompany] = useState(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ nombre: '' })
  const [snack, setSnack] = useState({ open: false, message: '', type: 'success' })

  useEffect(() => {
    fetch(`/api/companies/${id}`).then(r => r.json()).then(c => {
      setCompany(c)
      setForm({ nombre: c.nombre || '' })
    }).catch(() => {})
  }, [id])

  const submit = async () => {
    try {
      const res = await fetch(`/api/companies/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, modificado_por: 'Testing' })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setSnack({ open: true, message: err.error || 'Error actualizando empresa', type: 'error' })
        return
      }
      const updated = await res.json()
      setCompany(updated)
      setOpen(false)
      setSnack({ open: true, message: 'Empresa actualizada', type: 'success' })
    } catch (e) {
      setSnack({ open: true, message: 'Error de red actualizando empresa', type: 'error' })
    }
  }

  if (!company) return <p>Cargando...</p>

  return (
    <section className="card">
      <div className="card-header">
        <h2 className="card-title">Detalle empresa</h2>
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
        <p><strong>Nombre:</strong> {company.nombre}</p>
        <p><strong>Creación:</strong> {company.createdAt ? new Date(company.createdAt).toLocaleString() : '-'}</p>
      </div>

      <Modal open={open} title="Modificar empresa" onClose={() => setOpen(false)} onSubmit={submit} submitLabel="Guardar">
        <div>
          <div className="label">Nombre</div>
          <input className="input" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
        </div>
      </Modal>

      <Snackbar open={snack.open} message={snack.message} type={snack.type} onClose={() => setSnack(s => ({ ...s, open: false }))} />
    </section>
  )
}