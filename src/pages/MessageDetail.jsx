import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Modal from '../components/Modal.jsx'
import Snackbar from '../components/Snackbar.jsx'
import { ROLES, ROLE_LABELS, getCurrentUser } from '../utils/roles.js'
import { deleteMessageById, fetchMessageById, updateMessageById } from '../firebase/auth.js'

export default function MessageDetail() {
  const navigate = useNavigate()
  const { id } = useParams()

  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState(null)

  const [openEdit, setOpenEdit] = useState(false)
  const [editForm, setEditForm] = useState({ titulo: '', cuerpo: '', roles: [] })

  const [snack, setSnack] = useState({ open: false, message: '', type: 'success' })

  useEffect(() => {
    let mounted = true
    const run = async () => {
      try {
        setLoading(true)
        const m = await fetchMessageById(id)
        if (!mounted) return
        setMessage(m)
        setEditForm({ titulo: m?.titulo || '', cuerpo: m?.cuerpo || '', roles: Array.isArray(m?.roles) ? m.roles : [] })
      } catch {
        if (!mounted) return
        setMessage(null)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    run()
    return () => { mounted = false }
  }, [id])

  const submitEdit = async () => {
    try {
      if (!editForm.titulo || !editForm.cuerpo) {
        setSnack({ open: true, message: 'Título y cuerpo son obligatorios', type: 'error' })
        return
      }
      const payload = { titulo: editForm.titulo, cuerpo: editForm.cuerpo, roles: editForm.roles, modificado_por: (getCurrentUser()?.name || 'Testing') }
      const updated = await updateMessageById(id, payload)
      if (!updated) {
        setSnack({ open: true, message: 'Mensaje no encontrado', type: 'error' })
        return
      }
      setMessage(updated)
      setOpenEdit(false)
      setSnack({ open: true, message: 'Mensaje actualizado', type: 'success' })
    } catch (e) {
      setSnack({ open: true, message: 'Error actualizando mensaje', type: 'error' })
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('¿Seguro que deseas borrar este mensaje?')) return
    try {
      await deleteMessageById(id)
      setSnack({ open: true, message: 'Mensaje borrado', type: 'success' })
      navigate('/app/admin/mensajes')
    } catch (e) {
      setSnack({ open: true, message: 'Error borrando mensaje', type: 'error' })
    }
  }

  const toggleRoleEdit = (role) => {
    const has = editForm.roles.includes(role)
    setEditForm({ ...editForm, roles: has ? editForm.roles.filter(r => r !== role) : [...editForm.roles, role] })
  }

  if (loading) return <div className="card">Cargando...</div>
  if (!message) return <div className="card">No encontrado</div>

  return (
    <>
      <section className="card">
        <div className="card-header">
          <h2 className="card-title">Detalle mensaje</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="icon-button" onClick={() => setOpenEdit(true)} title="Modificar">
              <span className="material-symbols-outlined">edit</span>
            </button>
            <button className="icon-button" onClick={handleDelete} title="Borrar">
              <span className="material-symbols-outlined">delete</span>
            </button>
            <button className="icon-button" onClick={() => navigate(-1)} title="Atrás">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
          </div>
        </div>
        <div style={{ padding: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 8 }}>
            <div className="label">Título</div>
            <div>{message.titulo || '-'}</div>
            <div className="label">Cuerpo</div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{message.cuerpo || '-'}</div>
            <div className="label">Roles</div>
            <div>{Array.isArray(message.roles) && message.roles.length > 0 ? message.roles.map(r => ROLE_LABELS[r] || r).join(', ') : 'Todos'}</div>
          </div>
        </div>
      </section>

      <Modal open={openEdit} title="Editar mensaje" onClose={() => setOpenEdit(false)} onSubmit={submitEdit} submitLabel="Guardar">
        <div>
          <div className="label">Título</div>
          <input className="input" value={editForm.titulo} onChange={e => setEditForm({ ...editForm, titulo: e.target.value })} placeholder="Título" />
        </div>
        <div>
          <div className="label">Cuerpo</div>
          <textarea className="input" value={editForm.cuerpo} onChange={e => setEditForm({ ...editForm, cuerpo: e.target.value })} placeholder="Contenido del mensaje" rows={6} />
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
