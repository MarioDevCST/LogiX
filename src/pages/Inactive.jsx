import { useNavigate, Link } from "react-router-dom";
import { firebaseLogout, logInteraction } from "../firebase/auth.js";
import { getCurrentUser } from "../utils/roles.js";

export default function Inactive() {
  const navigate = useNavigate();
  const user = getCurrentUser();

  const logout = async () => {
    if (user?.id || user?._id) {
      logInteraction({
        type: "user_logged_out",
        actor: {
          id: user.id || user._id,
          name: user.name || "",
          email: user.email || "",
          role: user.role || "",
        },
        target: {
          id: user.id || user._id,
          name: user.name || "",
          email: user.email || "",
        },
      }).catch(() => {});
    }
    try {
      await firebaseLogout();
    } catch {
      void 0;
    }
    localStorage.removeItem("auth");
    navigate("/login");
  };

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <div className="card-header auth-card-header">
          <h2 className="card-title">Usuario pendiente de activación</h2>
        </div>
        <div style={{ padding: 16, display: "grid", gap: 12 }}>
          <p style={{ margin: 0 }}>
            {user?.email
              ? `Tu cuenta (${user.email}) está creada pero todavía no está activa.`
              : "Tu cuenta está creada pero todavía no está activa."}
          </p>
          <p style={{ margin: 0 }}>
            Pide a un usuario activo que te habilite en Usuarios → Detalle
            usuario.
          </p>
          <button className="primary-button" type="button" onClick={logout}>
            Cerrar sesión
          </button>
          <div style={{ textAlign: "center" }}>
            <Link to="/">Volver al inicio</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
