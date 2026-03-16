import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Snackbar from "../components/Snackbar.jsx";

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [snack, setSnack] = useState({
    open: false,
    message: "",
    type: "success",
  });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    try {
      const email = form.email.trim().toLowerCase();
      const password = form.password.trim();

      if (!email || !password) {
        setSnack({
          open: true,
          message: "Todos los campos son obligatorios",
          type: "error",
        });
        return;
      }
      setLoading(true);

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSnack({
          open: true,
          message: err.error || "Credenciales inválidas",
          type: "error",
        });
        setLoading(false);
        return;
      }

      const data = await res.json();
      const user = data.user;

      localStorage.setItem("auth", JSON.stringify({ user }));
      setSnack({
        open: true,
        message: `Bienvenido ${user.name}`,
        type: "success",
      });
      setTimeout(() => navigate("/app"), 500);
    } catch (e) {
      console.error(e);
      setSnack({
        open: true,
        message: "Error de conexión con el servidor",
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
        <div className="card-header auth-card-header">
          <h2 className="card-title">Entrar</h2>
        </div>
        <form onSubmit={submit} className="auth-form">
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
            {loading ? "Procesando..." : "Entrar"}
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
