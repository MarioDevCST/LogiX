import { useNavigate } from 'react-router-dom'
import { getRoleColor, getCurrentUser } from '../utils/roles.js'

export default function Header({ onToggleSidebar }) {
  const navigate = useNavigate()
  const user = getCurrentUser()
  const userName = user?.name || ''
  const roleColor = getRoleColor(user?.role)
  const initial = (userName || '').trim().charAt(0).toUpperCase()

  const logout = () => {
    localStorage.removeItem('auth')
    navigate('/login')
  }

  return (
    <header className="header" style={{ display: 'flex', alignItems: 'center' }}>
      <button className="icon-button" onClick={onToggleSidebar} aria-label="Toggle sidebar">☰</button>
      <div className="header-title">LogiX</div>
      <div className="header-actions" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        {userName && (
          <>
            <div className="user-avatar" title="Avatar" style={{ width: 28, height: 28, borderRadius: '50%', background: '#fff', border: `2px solid ${roleColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, color: '#333' }}>
              {initial}
            </div>
            <span className="user-name" title="Usuario logeado">{userName}</span>
          </>
        )}
        <button className="icon-button" onClick={logout} aria-label="Cerrar sesión">
          <span className="material-symbols-outlined">logout</span>
        </button>
      </div>
    </header>
  )
}