import { NavLink } from 'react-router-dom'

export default function Sidebar({ collapsed }) {
  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <nav className="nav">
        <div className="nav-section">Dashboard</div>
        <NavLink to="/app" end title="Dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon material-symbols-outlined">dashboard</span>
          <span className="nav-label">Dashboard</span>
        </NavLink>

        <div className="nav-section">Administración</div>
        <NavLink to="/app/admin/usuarios" title="Usuarios" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon material-symbols-outlined">group</span>
          <span className="nav-label">Usuarios</span>
        </NavLink>
        <NavLink to="/app/admin/barcos" title="Barcos" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon material-symbols-outlined">sailing</span>
          <span className="nav-label">Barcos</span>
        </NavLink>
        <NavLink to="/app/admin/empresas" title="Empresas" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon material-symbols-outlined">business</span>
          <span className="nav-label">Empresas</span>
        </NavLink>
        <NavLink to="/app/admin/localizaciones" title="Localizaciones" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon material-symbols-outlined">location_on</span>
          <span className="nav-label">Localizaciones</span>
        </NavLink>

        <div className="nav-section">Logística</div>
        <NavLink to="/app/logistica/cargas" title="Cargas" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon material-symbols-outlined">local_shipping</span>
          <span className="nav-label">Cargas</span>
        </NavLink>

        <div className="nav-section">Palets</div>
        <NavLink to="/app/palets" title="Palets" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon material-symbols-outlined">inventory_2</span>
          <span className="nav-label">Palets</span>
        </NavLink>
      </nav>
    </aside>
  )
}