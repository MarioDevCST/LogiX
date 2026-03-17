import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Modal from '../components/Modal.jsx'
import Snackbar from '../components/Snackbar.jsx'
import { getCurrentUser } from '../utils/roles.js'
import { deleteConsigneeById, fetchConsigneeById, updateConsigneeById } from '../firebase/auth.js'

export default function ConsigneeDetail() {
  const navigate = useNavigate()
  const { id } = useParams()

  const [loading, setLoading] = useState(true)
  const [consignee, setConsignee] = useState(null)

  const [openEdit, setOpenEdit] = useState(false)
  const [editForm, setEditForm] = useState({ nombre: '' })

  const [snack, setSnack] = useState({ open: false, message: '', type: 'success' })

  useEffect(() => {
    let mounted = true
    setLoading(true)
    const run = async () => {
      try {
        const c = await fetchConsigneeById(id)
        if (!mounted) return
        setConsignee(c)
        setEditForm({ nombre: c?.nombre || '' })
      } catch {
        if (!mounted) return
        setConsignee(null)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    run()
    return () => { mounted = false }
  }, [id])

  const submitEdit = async () => {
    try {
      if (!editForm.nombre) {
        setSnack({ open: true, message: 'El nombre es obligatorio', type: 'error' })
        return
      }
      const payload = { nombre: editForm.nombre, modificado_por: (getCurrentUser()?.name || 'Testing') }
      const updated = await updateConsigneeById(id, payload)
      if (!updated) {
        setSnack({ open: true, message: 'Consignatario no encontrado', type: 'error' })
        return
      }
      setConsignee(updated)
      setOpenEdit(false)
      setSnack({ open: true, message: 'Consignatario actualizado', type: 'success' })
    } catch (e) {
      setSnack({ open: true, message: 'Error actualizando consignatario', type: 'error' })
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('¿Seguro que deseas borrar este consignatario?')) return
    try {
      await deleteConsigneeById(id)
      setSnack({ open: true, message: 'Consignatario borrado', type: 'success' })
      navigate('/app/admin/consignatarios')
    } catch (e) {
      setSnack({ open: true, message: 'Error borrando consignatario', type: 'error' })
    }
  }

  if (loading) return <div className="card">Cargando...</div>
  if (!consignee) return <div className="card">No encontrado</div>

  return (
    <>
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Consignatario</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="button" onClick={() => setOpenEdit(true)}>Editar</button>
            <button className="button danger" onClick={handleDelete}>Borrar</button>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 8 }}>
            <div className="label">Nombre</div>
            <div>{consignee.nombre || '-'}</div>
          </div>
        </div>
      </div>

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
