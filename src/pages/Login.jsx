import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Snackbar from '../components/Snackbar.jsx'

export default function Login() {
  const navigate = useNavigate()
  const [isRegistering, setIsRegistering] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [snack, setSnack] = useState({ open: false, message: '', type: 'success' })
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    try {
      const email = form.email.trim().toLowerCase()
      const password = form.password.trim()
      const name = form.name.trim()

      if (!email || !password || (isRegistering && !name)) {
        setSnack({ open: true, message: 'Todos los campos son obligatorios', type: 'error' })
        return
      }
      setLoading(true)

      let res
      if (isRegistering) {
        // Registro
        res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password, role: 'admin' }) // Crear admin por defecto
        })
      } else {
        // Login
        res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        })
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setSnack({ open: true, message: err.error || (isRegistering ? 'Error al crear usuario' : 'Credenciales inválidas'), type: 'error' })
        setLoading(false)
        return
      }

      const data = await res.json()
      // Si es registro, data es el usuario. Si es login, data es { user: ... }
      const user = isRegistering ? data : data.user
      
      localStorage.setItem('auth', JSON.stringify({ user }))
      setSnack({ open: true, message: `Bienvenido ${user.name}`, type: 'success' })
      setTimeout(() => navigate('/app'), 500)
      
    } catch (e) {
      console.error(e)
      setSnack({ open: true, message: 'Error de conexión con el servidor', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card" style={{ maxWidth: 400, margin: '40px auto' }}>
      <div className="card-header">
        <h2 className="card-title">{isRegistering ? 'Crear Usuario (Admin)' : 'Entrar'}</h2>
      </div>
      <form onSubmit={submit} style={{ padding: 16, display: 'grid', gap: 12 }}>
        {isRegistering && (
          <div>
            <div className="label">Nombre</div>
            <input 
              className="input" 
              type="text" 
              value={form.name} 
              onChange={e => setForm({ ...form, name: e.target.value })} 
              placeholder="Tu nombre" 
            />
          </div>
        )}
        <div>
          <div className="label">Email</div>
          <input className="input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@dominio.com" />
        </div>
        <div>
          <div className="label">Contraseña</div>
          <input className="input" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="••••••" />
        </div>
        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? 'Procesando...' : (isRegistering ? 'Registrar y Entrar' : 'Entrar')}
        </button>
        
        <button 
          type="button" 
          className="secondary-button"
          onClick={() => {
            setIsRegistering(!isRegistering)
            setForm({ name: '', email: '', password: '' })
            setSnack({ open: false, message: '', type: 'success' })
          }}
          style={{ marginTop: 8 }}
        >
          {isRegistering ? 'Ya tengo cuenta' : 'Crear usuario nuevo'}
        </button>

        <div style={{ textAlign: 'center' }}>
          <Link to="/">Volver al inicio</Link>
        </div>
      </form>
      <Snackbar open={snack.open} message={snack.message} type={snack.type} onClose={() => setSnack(s => ({ ...s, open: false }))} />
    </div>
  )
}