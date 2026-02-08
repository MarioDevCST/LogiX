import { useNavigate } from 'react-router-dom'

export default function Header({ onToggleSidebar }) {
  const navigate = useNavigate()
  let userName = ''
  try {
    const auth = JSON.parse(localStorage.getItem('auth') || '{}')
    userName = auth?.user?.name || ''
  } catch {}

  const logout = () => {
    localStorage.removeItem('auth')
    navigate('/login')
  }

  return (
    <header className="header">
      <button className="icon-button" onClick={onToggleSidebar} aria-label="Toggle sidebar">☰</button>
      <div className="header-title">LogiX</div>
      <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <input className="search" placeholder="Buscar..." />
        {userName && <span className="user-name" title="Usuario logeado">{userName}</span>}
        <button className="secondary-button" onClick={logout}>Cerrar sesión</button>
      </div>
    </header>
  )
}