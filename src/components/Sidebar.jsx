import { NavLink } from "react-router-dom";
import {
  getCurrentRole,
  getCurrentUser,
  hasPermission,
  PERMISSIONS,
  ROLES,
} from "../utils/roles.js";

export default function Sidebar({ collapsed }) {
  const role = getCurrentRole();
  const user = getCurrentUser();
  const meId = user?._id || user?.id;
  const isWarehouse = role === ROLES.ALMACEN;
  const isOffice = role === ROLES.OFICINA;
  const canViewAdmin = role
    ? hasPermission(role, PERMISSIONS.MANAGE_USERS)
    : false;
  const canViewInteractions =
    canViewAdmin && role !== ROLES.OFICINA && role !== ROLES.LOGISTICA;

  if (isWarehouse) {
    return (
      <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
        <nav className="nav">
          <div className="nav-section">Dashboard</div>
          <NavLink
            to="/app"
            end
            title="Dashboard"
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          >
            <span className="nav-icon material-symbols-outlined">
              dashboard
            </span>
            <span className="nav-label">Dashboard</span>
          </NavLink>

          {meId && (
            <NavLink
              to="/app/mi-perfil"
              title="Mi perfil"
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <span className="nav-icon material-symbols-outlined">
                account_circle
              </span>
              <span className="nav-label">Mi perfil</span>
            </NavLink>
          )}

          <div className="nav-section">Mensajes</div>
          <NavLink
            to="/app/admin/mensajes"
            title="Mensajes"
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          >
            <span className="nav-icon material-symbols-outlined">mail</span>
            <span className="nav-label">Mensajes</span>
          </NavLink>

          <div className="nav-section">Logística</div>
          <NavLink
            to="/app/logistica/carga-palets"
            title="Carga de Palets"
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          >
            <span className="nav-icon material-symbols-outlined">
              inventory_2
            </span>
            <span className="nav-label">Carga de Palets</span>
          </NavLink>

          <div className="nav-section">Palets</div>
          <NavLink
            to="/app/palets"
            title="Palets"
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          >
            <span className="nav-icon material-symbols-outlined">
              inventory_2
            </span>
            <span className="nav-label">Palets</span>
          </NavLink>

          <div className="nav-section">Productos</div>
          <NavLink
            to="/app/productos"
            title="Productos"
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          >
            <span className="nav-icon material-symbols-outlined">
              shopping_bag
            </span>
            <span className="nav-label">Productos</span>
          </NavLink>
          <NavLink
            to="/app/mermas"
            title="Mermas"
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          >
            <span className="nav-icon material-symbols-outlined">delete</span>
            <span className="nav-label">Mermas</span>
          </NavLink>
        </nav>
      </aside>
    );
  }

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <nav className="nav">
        <div className="nav-section">Dashboard</div>
        <NavLink
          to="/app"
          end
          title="Dashboard"
          className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
        >
          <span className="nav-icon material-symbols-outlined">dashboard</span>
          <span className="nav-label">Dashboard</span>
        </NavLink>

        {meId && (
          <NavLink
            to="/app/mi-perfil"
            title="Mi perfil"
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          >
            <span className="nav-icon material-symbols-outlined">
              account_circle
            </span>
            <span className="nav-label">Mi perfil</span>
          </NavLink>
        )}

        {!isOffice && (
          <>
            <div className="nav-section">Administración</div>
            <NavLink
              to="/app/admin/usuarios"
              title="Usuarios"
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <span className="nav-icon material-symbols-outlined">group</span>
              <span className="nav-label">Usuarios</span>
            </NavLink>
            <NavLink
              to="/app/admin/colecciones"
              title="Colecciones"
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <span className="nav-icon material-symbols-outlined">
                dataset
              </span>
              <span className="nav-label">Colecciones</span>
            </NavLink>
            <NavLink
              to="/app/admin/barcos"
              title="Barcos"
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <span className="nav-icon material-symbols-outlined">
                sailing
              </span>
              <span className="nav-label">Barcos</span>
            </NavLink>
            <NavLink
              to="/app/admin/mensajes"
              title="Mensajes"
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <span className="nav-icon material-symbols-outlined">mail</span>
              <span className="nav-label">Mensajes</span>
            </NavLink>

            {canViewInteractions && (
              <>
                <div className="nav-section">Admin</div>
                <NavLink
                  to="/app/admin/interacciones"
                  title="Interacciones"
                  className={({ isActive }) =>
                    `nav-item ${isActive ? "active" : ""}`
                  }
                >
                  <span className="nav-icon material-symbols-outlined">
                    history
                  </span>
                  <span className="nav-label">Interacciones</span>
                </NavLink>
              </>
            )}
          </>
        )}

        <div className="nav-section">Logística</div>
        <NavLink
          to="/app/logistica/cargas"
          title="Cargas"
          className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
        >
          <span className="nav-icon material-symbols-outlined">
            local_shipping
          </span>
          <span className="nav-label">Cargas</span>
        </NavLink>
        {!isOffice && (
          <NavLink
            to="/app/logistica/carga-palets"
            title="Carga de Palets"
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          >
            <span className="nav-icon material-symbols-outlined">
              inventory_2
            </span>
            <span className="nav-label">Carga de Palets</span>
          </NavLink>
        )}

        {!isOffice && (
          <>
            <div className="nav-section">Palets</div>
            <NavLink
              to="/app/palets"
              title="Palets"
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <span className="nav-icon material-symbols-outlined">
                inventory_2
              </span>
              <span className="nav-label">Palets</span>
            </NavLink>
          </>
        )}

        <div className="nav-section">Productos</div>
        <NavLink
          to="/app/productos"
          title="Productos"
          className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
        >
          <span className="nav-icon material-symbols-outlined">
            shopping_bag
          </span>
          <span className="nav-label">Productos</span>
        </NavLink>
        {!isOffice && (
          <NavLink
            to="/app/mermas"
            title="Mermas"
            className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
          >
            <span className="nav-icon material-symbols-outlined">delete</span>
            <span className="nav-label">Mermas</span>
          </NavLink>
        )}
      </nav>
    </aside>
  );
}
