import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Modal from '../components/Modal.jsx'
import Snackbar from '../components/Snackbar.jsx'
import { getCurrentUser } from '../utils/roles.js'
import { fetchShipById, updateShipById } from '../firebase/auth.js'

export default function ShipDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [ship, setShip] = useState(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ nombre_del_barco: '' })
  const [snack, setSnack] = useState({ open: false, message: '', type: 'success' })

  useEffect(() => {
    let mounted = true
    const run = async () => {
      try {
        const s = await fetchShipById(id)
        if (!mounted) return
        setShip(s)
        setForm({ nombre_del_barco: s?.nombre_del_barco || '' })
      } catch {
        if (!mounted) return
        setShip(null)
      }
    }
    run()
    return () => { mounted = false }
  }, [id])

  const submit = async () => {
    try {
      const updated = await updateShipById(id, { ...form, modificado_por: (getCurrentUser()?.name || 'Testing') })
      if (!updated) {
        setSnack({ open: true, message: 'Barco no encontrado', type: 'error' })
        return
      }
      setShip(updated)
      setOpen(false)
      setSnack({ open: true, message: 'Barco actualizado', type: 'success' })
    } catch (e) {
      setSnack({ open: true, message: 'Error actualizando barco', type: 'error' })
    }
  }

  if (!ship) return <p>Cargando...</p>

  return (
    <section className="card">
      <div className="card-header">
        <h2 className="card-title">Detalle barco</h2>
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
        <p><strong>Nombre:</strong> {ship.nombre_del_barco}</p>
        <p><strong>Empresa:</strong> {ship.empresa_nombre || '-'}</p>
        <p><strong>Responsable:</strong> {ship.responsable_nombre || '-'}</p>
      </div>

      <Modal open={open} title="Modificar barco" onClose={() => setOpen(false)} onSubmit={submit} submitLabel="Guardar">
        <div>
          <div className="label">Nombre del barco</div>
          <input className="input" value={form.nombre_del_barco} onChange={e => setForm({ ...form, nombre_del_barco: e.target.value })} />
        </div>
      </Modal>

      <Snackbar open={snack.open} message={snack.message} type={snack.type} onClose={() => setSnack(s => ({ ...s, open: false }))} />
    </section>
  )
}
