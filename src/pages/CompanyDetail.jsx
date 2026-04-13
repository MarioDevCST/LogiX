import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Modal from "../components/Modal.jsx";
import Snackbar from "../components/Snackbar.jsx";
import { getCurrentUser } from "../utils/roles.js";
import { fetchCompanyById, updateCompanyById } from "../firebase/auth.js";

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
  return null;
}

function formatDateTime(value) {
  const d = toDate(value);
  if (!d) return "-";
  return d.toLocaleString("es-ES");
}

export default function CompanyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [company, setCompany] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    nombre: "",
    direccion: "",
    telefono: "",
    email: "",
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
        const c = await fetchCompanyById(id);
        if (!mounted) return;
        setCompany(c);
        setForm({
          nombre: c?.nombre || "",
          direccion: String(c?.direccion || ""),
          telefono: String(c?.telefono || ""),
          email: String(c?.email || ""),
        });
      } catch {
        if (!mounted) return;
        setCompany(null);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [id]);

  const submit = async () => {
    try {
      const updated = await updateCompanyById(id, {
        ...form,
        modificado_por: getCurrentUser()?.name || "Testing",
      });
      if (!updated) {
        setSnack({
          open: true,
          message: "Empresa no encontrada",
          type: "error",
        });
        return;
      }
      setCompany(updated);
      setOpen(false);
      setSnack({ open: true, message: "Empresa actualizada", type: "success" });
    } catch (e) {
      setSnack({
        open: true,
        message: "Error actualizando empresa",
        type: "error",
      });
    }
  };

  if (!company) return <p>Cargando...</p>;

  return (
    <section className="card">
      <div className="card-header">
        <h2 className="card-title">Detalle empresa</h2>
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
          <strong>Nombre:</strong> {company.nombre}
        </p>
        <p>
          <strong>Dirección:</strong> {company.direccion || "-"}
        </p>
        <p>
          <strong>Teléfono:</strong> {company.telefono || "-"}
        </p>
        <p>
          <strong>Contacto:</strong> {company.email || "-"}
        </p>
        <p>
          <strong>Creación:</strong>{" "}
          {formatDateTime(company.createdAt || company.fecha_creacion)}
        </p>
      </div>

      <Modal
        open={open}
        title="Modificar empresa"
        onClose={() => setOpen(false)}
        onSubmit={submit}
        submitLabel="Guardar"
      >
        <div>
          <div className="label">Nombre</div>
          <input
            className="input"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          />
        </div>
        <div>
          <div className="label">Dirección (opcional)</div>
          <textarea
            className="input"
            value={form.direccion}
            onChange={(e) => setForm({ ...form, direccion: e.target.value })}
            rows={2}
            style={{ resize: "vertical" }}
          />
        </div>
        <div>
          <div className="label">Teléfono (opcional)</div>
          <input
            className="input"
            value={form.telefono}
            onChange={(e) => setForm({ ...form, telefono: e.target.value })}
            placeholder="+34..."
          />
        </div>
        <div>
          <div className="label">Contacto (opcional)</div>
          <input
            className="input"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="correo@ejemplo.com"
          />
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
