import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Snackbar from "../components/Snackbar.jsx";
import EnvBadge from "../components/EnvBadge.jsx";
import {
  firebaseLogin,
  firebaseRegister,
  getOrCreateUserProfile,
  logInteraction,
} from "../firebase/auth.js";

export default function Login() {
  const navigate = useNavigate();
  const [isRegistering, setIsRegistering] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [snack, setSnack] = useState({
    open: false,
    message: "",
    type: "success",
  });
  const [loading, setLoading] = useState(false);

  const getFirebaseAuthMessage = (code) => {
    return code === "auth/invalid-credential"
      ? "Credenciales inválidas"
      : code === "auth/user-not-found"
      ? "Usuario no encontrado"
      : code === "auth/wrong-password"
      ? "Contraseña incorrecta"
      : code === "auth/email-already-in-use"
      ? "Ese email ya está registrado"
      : code === "auth/weak-password"
      ? "La contraseña es demasiado débil"
      : code === "auth/invalid-email"
      ? "Email inválido"
      : code === "auth/operation-not-allowed"
      ? "En este proyecto no está habilitado Email/Contraseña en Firebase Auth"
      : code === "auth/unauthorized-domain"
      ? "Este dominio no está autorizado en Firebase Auth"
      : code === "auth/invalid-api-key"
      ? "API key inválida en la configuración de Firebase"
      : code === "auth/network-request-failed"
      ? "Error de red conectando con Firebase"
      : code === "firestore/timeout"
      ? "Firestore no responde (timeout). Revisa si Firestore está creado y las reglas"
      : code === "permission-denied"
      ? "Permiso denegado en Firestore. Revisa las reglas"
      : code === "failed-precondition"
      ? "Firestore no está listo o la API no está habilitada"
      : "";
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      const email = form.email.trim().toLowerCase();
      const password = form.password.trim();
      const name = form.name.trim();

      if (!email || !password || (isRegistering && !name)) {
        setSnack({
          open: true,
          message: "Todos los campos son obligatorios",
          type: "error",
        });
        return;
      }
      setLoading(true);

      const fbUser = isRegistering
        ? await firebaseRegister({ email, password, name })
        : await firebaseLogin(email, password);
      const profile = await getOrCreateUserProfile({
        uid: fbUser.uid,
        email: fbUser.email || email,
        name: fbUser.displayName || name || "",
      });
      const user = { ...profile, id: profile.id || fbUser.uid };

      localStorage.setItem("auth", JSON.stringify({ user }));
      const actor = {
        id: user.id,
        name: user.name || "",
        email: user.email || "",
        role: user.role || "",
      };
      if (isRegistering) {
        logInteraction({
          type: "user_created",
          actor,
          target: {
            id: user.id,
            name: user.name || "",
            email: user.email || "",
          },
          details: { active: user.active, role: user.role || "" },
        }).catch(() => {});
      }
      logInteraction({
        type: "user_logged_in",
        actor,
        target: { id: user.id, name: user.name || "", email: user.email || "" },
      }).catch(() => {});
      setSnack({
        open: true,
        message: `Bienvenido ${user.name}`,
        type: "success",
      });
      setTimeout(() => navigate(user.active ? "/app" : "/inactive"), 500);
    } catch (e) {
      const code = e?.code || "";
      const message =
        getFirebaseAuthMessage(code) ||
        (code
          ? `Error autenticando en Firebase (${code})`
          : "Error autenticando en Firebase");
      setSnack({
        open: true,
        message,
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <div className="auth-logo-wrap">
          <img className="auth-logo" src="/logo.png" alt="LogiX" />
        </div>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <EnvBadge />
        </div>
        <div className="card-header auth-card-header">
          <h2 className="card-title">
            {isRegistering ? "Crear usuario" : "Entrar"}
          </h2>
        </div>
        <form onSubmit={submit} className="auth-form">
          {isRegistering && (
            <div>
              <div className="label">Nombre</div>
              <input
                className="input"
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Tu nombre"
              />
            </div>
          )}
          <div>
            <div className="label">Email</div>
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="email@dominio.com"
            />
          </div>
          <div>
            <div className="label">Contraseña</div>
            <input
              className="input"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••"
            />
          </div>
          <button className="primary-button" type="submit" disabled={loading}>
            {loading
              ? "Procesando..."
              : isRegistering
              ? "Crear y entrar"
              : "Entrar"}
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setIsRegistering((v) => !v);
              setForm({ name: "", email: "", password: "" });
              setSnack({ open: false, message: "", type: "success" });
            }}
          >
            {isRegistering ? "Ya tengo cuenta" : "Crear usuario nuevo"}
          </button>

          <div style={{ textAlign: "center" }}>
            <Link to="/">Volver al inicio</Link>
          </div>
        </form>
        <Snackbar
          open={snack.open}
          message={snack.message}
          type={snack.type}
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
        />
      </div>
    </div>
  );
}
