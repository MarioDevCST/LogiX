import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Modal from "../components/Modal.jsx";
import Snackbar from "../components/Snackbar.jsx";
import { fetchUserById, updateUserById } from "../firebase/auth.js";
import { getCurrentUser } from "../utils/roles.js";

const ROLE_OPTIONS = [
  { label: "Administrador", value: "admin" },
  { label: "Oficina", value: "dispatcher" },
  { label: "Conductor", value: "driver" },
  { label: "Almacén", value: "warehouse" },
  { label: "Logistica", value: "logistic" },
];

export default function UserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "dispatcher",
    active: true,
  });
  const [snack, setSnack] = useState({
    open: false,
    message: "",
    type: "success",
  });

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        setLoading(true);
        const u = await fetchUserById(id);
        if (!mounted) return;
        if (!u) {
          setSnack({
            open: true,
            message: "Usuario no encontrado",
            type: "error",
          });
          setUser(null);
          return;
        }
        setUser(u);
        setForm({
          name: u.name,
          email: u.email,
          role: u.role,
          active: u.active,
        });
      } catch (e) {
        if (!mounted) return;
        setSnack({
          open: true,
          message: "No se pudo cargar el usuario",
          type: "error",
        });
        setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [id]);

  const submit = async () => {
    try {
      const safeRole = form.role === "admin" ? user.role : form.role;
      const updated = await updateUserById(id, {
        name: form.name,
        email: form.email,
        role: safeRole,
        active: form.active,
      });
      if (!updated) {
        setSnack({
          open: true,
          message: "Usuario no encontrado",
          type: "error",
        });
        return;
      }
      setUser(updated);
      const current = getCurrentUser();
      if (current && (current.id === id || current._id === id)) {
        localStorage.setItem(
          "auth",
          JSON.stringify({ user: { ...current, ...updated } })
        );
      }
      setOpen(false);
      setSnack({ open: true, message: "Usuario actualizado", type: "success" });
    } catch (e) {
      setSnack({
        open: true,
        message: "Error actualizando usuario",
        type: "error",
      });
    }
  };

  if (loading) return <p>Cargando...</p>;
  if (!user) {
    return (
      <section className="card">
        <div className="card-header">
          <h2 className="card-title">Detalle usuario</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="icon-button"
              onClick={() => navigate(-1)}
              title="Atrás"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
          </div>
        </div>
        <div style={{ padding: 16 }}>
          <p>Usuario no disponible.</p>
        </div>
        <Snackbar
          open={snack.open}
          message={snack.message}
          type={snack.type}
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
        />
      </section>
    );
  }

  return (
    <section className="card">
      <div className="card-header">
        <h2 className="card-title">Detalle usuario</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="icon-button"
            onClick={() => setOpen(true)}
            title="Modificar"
          >
            <span className="material-symbols-outlined">edit</span>
          </button>
          <button
            className="icon-button"
            onClick={() => navigate(-1)}
            title="Atrás"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
        </div>
      </div>
      <div style={{ padding: 16 }}>
        <p>
          <strong>Nombre:</strong> {user.name}
        </p>
        <p>
          <strong>Email:</strong> {user.email}
        </p>
        <p>
          <strong>Rol:</strong>{" "}
          {ROLE_OPTIONS.find((ro) => ro.value === user.role)?.label ||
            user.role}
        </p>
        <p>
          <strong>Activo:</strong> {user.active ? "Sí" : "No"}
        </p>
      </div>

      <Modal
        open={open}
        title="Modificar usuario"
        onClose={() => setOpen(false)}
        onSubmit={submit}
        submitLabel="Guardar"
      >
        <div>
          <div className="label">Nombre</div>
          <input
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div>
          <div className="label">Email</div>
          <input
            className="input"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div className="form-row">
          <div>
            <div className="label">Rol</div>
            <select
              className="select"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              {ROLE_OPTIONS.filter((opt) => opt.value !== "admin").map(
                (opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                )
              )}
            </select>
          </div>
          <div>
            <div className="label">Activo</div>
            <select
              className="select"
              value={form.active ? "true" : "false"}
              onChange={(e) =>
                setForm({ ...form, active: e.target.value === "true" })
              }
            >
              <option value="true">Sí</option>
              <option value="false">No</option>
            </select>
          </div>
        </div>
      </Modal>

      <Snackbar
        open={snack.open}
        message={snack.message}
        type={snack.type}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
      />
    </section>
  );
}
