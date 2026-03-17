import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getRoleColor, getCurrentUser } from "../utils/roles.js";
import { firebaseLogout, logInteraction } from "../firebase/auth.js";

export default function Header({ onToggleSidebar }) {
  const [logoOk, setLogoOk] = useState(true);
  const navigate = useNavigate();
  const user = getCurrentUser();
  const userName = user?.name || "";
  const roleColor = getRoleColor(user?.role);
  const initial = (userName || "").trim().charAt(0).toUpperCase();
  const stageRaw =
    import.meta.env.VITE_APP_STAGE ||
    (import.meta.env.MODE || "").toUpperCase();
  const stage = String(stageRaw || "").toUpperCase();
  const isDev = stage === "DEV" || stage === "DEVELOPMENT";

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
    <header
      className={`header${isDev ? " header-dev" : ""}`}
      style={{ display: "flex", alignItems: "center" }}
    >
      <button
        className="icon-button"
        onClick={onToggleSidebar}
        aria-label="Toggle sidebar"
      >
        ☰
      </button>
      {logoOk ? (
        <img
          className="header-logo-img"
          src="/logo.png"
          alt="LogiX"
          onError={() => setLogoOk(false)}
        />
      ) : (
        <div className="header-title">LogiX</div>
      )}
      {isDev && <div className="env-badge">Developer</div>}
      <div
        className="header-actions"
        style={{
          marginLeft: "auto",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        {userName && (
          <>
            <div
              className="user-avatar"
              title="Avatar"
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "#fff",
                border: `2px solid ${roleColor}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 600,
                color: "#333",
              }}
            >
              {initial}
            </div>
            <span className="user-name" title="Usuario logeado">
              {userName}
            </span>
          </>
        )}
        <button
          className="icon-button"
          onClick={logout}
          aria-label="Cerrar sesión"
        >
          <span className="material-symbols-outlined">logout</span>
        </button>
      </div>
    </header>
  );
}
