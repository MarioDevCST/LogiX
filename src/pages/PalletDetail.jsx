import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Modal from '../components/Modal.jsx'
import Snackbar from '../components/Snackbar.jsx'
import { getCurrentUser } from '../utils/roles.js'

export default function PalletDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [pallet, setPallet] = useState(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ numero_palet: '', tipo: 'Seco', base: 'Europeo' })
  const [snack, setSnack] = useState({ open: false, message: '', type: 'success' })

  useEffect(() => {
    fetch(`/api/pallets/${id}`).then(r => r.json()).then(p => {
      setPallet(p)
      setForm({ numero_palet: p.numero_palet || '', tipo: p.tipo || 'Seco', base: p.base || 'Europeo' })
    }).catch(() => {})
  }, [id])

  const submit = async () => {
    try {
      const res = await fetch(`/api/pallets/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, modificado_por: (getCurrentUser()?.name || 'Testing') })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setSnack({ open: true, message: err.error || 'Error actualizando palet', type: 'error' })
        return
      }
      const updated = await res.json()
      setPallet(updated)
      setOpen(false)
      setSnack({ open: true, message: 'Palet actualizado', type: 'success' })
    } catch (e) {
      setSnack({ open: true, message: 'Error de red actualizando palet', type: 'error' })
    }
  }

  const onDelete = async () => {
    try {
      const confirmed = window.confirm('¿Seguro que quieres borrar este palet?')
      if (!confirmed) return
      const typed = window.prompt('Escribe BORRAR para confirmar la eliminación')
      if (typed !== 'BORRAR') {
        setSnack({ open: true, message: 'Confirmación inválida. Escribe BORRAR exactamente.', type: 'error' })
        return
      }
      const res = await fetch(`/api/pallets/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setSnack({ open: true, message: err.error || 'Error eliminando palet', type: 'error' })
        return
      }
      setSnack({ open: true, message: 'Palet borrado', type: 'success' })
      navigate('/app/palets')
    } catch (e) {
      setSnack({ open: true, message: 'Error de red eliminando palet', type: 'error' })
    }
  }

  if (!pallet) return <p>Cargando...</p>

  return (
    <section className="card">
      <div className="card-header">
        <h2 className="card-title">Detalle palet</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="icon-button" onClick={() => setOpen(true)} title="Modificar">
            <span className="material-symbols-outlined">edit</span>
          </button>
          <button className="icon-button" onClick={onDelete} title="Borrar">
            <span className="material-symbols-outlined">delete</span>
          </button>
          <button className="icon-button" onClick={() => navigate(-1)} title="Atrás">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
        </div>
      </div>
      <div style={{ padding: 16 }}>
        <p><strong>Nombre:</strong> {pallet.nombre || '-'}</p>
        <p><strong>Número de palet:</strong> {pallet.numero_palet}</p>
        <p><strong>Tipo:</strong> {pallet.tipo}</p>
        <p><strong>Base:</strong> {pallet.base || '-'}</p>
        <p><strong>Carga:</strong> {typeof pallet.carga === 'object' ? (pallet.carga?.nombre || '-') : pallet.carga}</p>
        <p><strong>Productos:</strong> {pallet.productos ? pallet.productos : '-'}</p>
        <p><strong>Creado:</strong> {pallet.createdAt ? new Date(pallet.createdAt).toLocaleString('es-ES') : '-'}</p>
        <p><strong>Actualizado:</strong> {pallet.updatedAt ? new Date(pallet.updatedAt).toLocaleString('es-ES') : '-'}</p>
      </div>

      <Modal open={open} title="Modificar palet" onClose={() => setOpen(false)} onSubmit={submit} submitLabel="Guardar">
        <div>
          <div className="label">Número de palet</div>
          <input className="input" value={form.numero_palet} onChange={e => setForm({ ...form, numero_palet: e.target.value })} />
        </div>
        <div>
          <div className="label">Tipo</div>
          <select className="select" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
            <option value="Seco">Seco</option>
            <option value="Refrigerado">Refrigerado</option>
            <option value="Congelado">Congelado</option>
            <option value="Técnico">Técnico</option>
          </select>
        </div>
        <div>
          <div className="label">Base</div>
          <select className="select" value={form.base || 'Europeo'} onChange={e => setForm({ ...form, base: e.target.value })}>
            <option value="Europeo">Europeo</option>
            <option value="Americano">Americano</option>
          </select>
        </div>
      </Modal>

      <Snackbar open={snack.open} message={snack.message} type={snack.type} onClose={() => setSnack(s => ({ ...s, open: false }))} />
    </section>
  )
}
