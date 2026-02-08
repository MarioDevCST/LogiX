import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Snackbar from '../components/Snackbar.jsx'

export default function Login() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [snack, setSnack] = useState({ open: false, message: '', type: 'success' })
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    try {
      if (!form.email || !form.password) {
        setSnack({ open: true, message: 'Email y contraseña son obligatorios', type: 'error' })
        return
      }
      setLoading(true)
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setSnack({ open: true, message: err.error || 'Credenciales inválidas', type: 'error' })
        setLoading(false)
        return
      }
      const data = await res.json()
      localStorage.setItem('auth', JSON.stringify({ user: data.user }))
      navigate('/app')
    } catch (e) {
      setSnack({ open: true, message: 'Error de red en login', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card" style={{ maxWidth: 400, margin: '40px auto' }}>
      <div className="card-header">
        <h2 className="card-title">Entrar</h2>
      </div>
      <form onSubmit={submit} style={{ padding: 16, display: 'grid', gap: 12 }}>
        <div>
          <div className="label">Email</div>
          <input className="input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@dominio.com" />
        </div>
        <div>
          <div className="label">Contraseña</div>
          <input className="input" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="••••••" />
        </div>
        <button className="primary-button" type="submit" disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</button>
        <div style={{ textAlign: 'center' }}>
          <Link to="/">Volver</Link>
        </div>
      </form>
      <Snackbar open={snack.open} message={snack.message} type={snack.type} onClose={() => setSnack(s => ({ ...s, open: false }))} />
    </div>
  )
}