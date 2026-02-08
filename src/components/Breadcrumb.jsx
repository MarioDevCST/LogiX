import { NavLink, useLocation } from 'react-router-dom'

const titleMap = {
  'app': 'Dashboard',
  'routes': 'Rutas',
  'admin': 'Administración',
  'orders': 'Pedidos',
  'users': 'Usuarios',
}

export default function Breadcrumb() {
  const { pathname } = useLocation()
  const segments = pathname.split('/').filter(Boolean)

  // Construye rutas acumulativas para cada segmento
  const crumbs = segments.map((seg, idx) => {
    const to = '/' + segments.slice(0, idx + 1).join('/')
    return { label: titleMap[seg] || seg, to }
  })

  if (segments.length <= 1) return null // Oculta en landing o raíz

  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      <ol className="breadcrumb-list">
        <li className="breadcrumb-item">
          <NavLink to="/app" className="breadcrumb-link">Inicio</NavLink>
        </li>
        {crumbs.slice(1).map((c, i) => (
          <li key={i} className="breadcrumb-item">
            <span className="breadcrumb-sep">/</span>
            {i < crumbs.slice(1).length - 1 ? (
              <NavLink to={c.to} className="breadcrumb-link">{c.label}</NavLink>
            ) : (
              <span className="breadcrumb-current">{c.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}