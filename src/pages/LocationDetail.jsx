import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Modal from "../components/Modal.jsx";
import Snackbar from "../components/Snackbar.jsx";
import FormField from "../components/FormField.jsx";
import { getCurrentUser } from "../utils/roles.js";
import {
  deleteLocationById,
  fetchLocationById,
  updateLocationById,
} from "../firebase/auth.js";

export default function LocationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [location, setLocation] = useState(null);
  const [open, setOpen] = useState(false);
  const current = getCurrentUser();
  const canDeleteLocation =
    current?.role === "dispatcher" || current?.role === "admin";
  const [form, setForm] = useState({
    nombre: "",
    ciudad: "",
    puerto: "",
    coordenadas: "",
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
        const l = await fetchLocationById(id);
        if (!mounted) return;
        setLocation(l);
        setForm({
          nombre: l?.nombre || "",
          ciudad: l?.ciudad || "",
          puerto: l?.puerto || "",
          coordenadas: l?.coordenadas || "",
        });
      } catch {
        if (!mounted) return;
        setLocation(null);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [id]);

  const submit = async () => {
    try {
      const updated = await updateLocationById(id, {
        ...form,
        modificado_por: getCurrentUser()?.name || "Testing",
      });
      if (!updated) {
        setSnack({
          open: true,
          message: "Localización no encontrada",
          type: "error",
        });
        return;
      }
      setLocation(updated);
      setOpen(false);
      setSnack({
        open: true,
        message: "Localización actualizada",
        type: "success",
      });
    } catch (e) {
      setSnack({
        open: true,
        message: "Error actualizando localización",
        type: "error",
      });
    }
  };

  const handleDelete = async () => {
    if (!location) return;
    const label = location.nombre || location.id || "";
    if (
      !window.confirm(`¿Seguro que deseas borrar la localización "${label}"?`)
    )
      return;
    try {
      await deleteLocationById(id);
      setOpen(false);
      setSnack({
        open: true,
        message: "Localización borrada",
        type: "success",
      });
      navigate("/app/admin/localizaciones");
    } catch {
      setSnack({
        open: true,
        message: "Error borrando localización",
        type: "error",
      });
    }
  };

  if (!location) return <p>Cargando...</p>;

  return (
    <section className="card">
      <div className="card-header">
        <h2 className="card-title">Detalle localización</h2>
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
          <strong>Nombre:</strong> {location.nombre}
        </p>
        <p>
          <strong>Ciudad:</strong> {location.ciudad}
        </p>
        <p>
          <strong>Puerto:</strong> {location.puerto || "-"}
        </p>
        <p>
          <strong>Coordenadas:</strong> {location.coordenadas || "-"}
        </p>
      </div>

      <Modal
        open={open}
        title="Modificar localización"
        onClose={() => setOpen(false)}
        onSubmit={submit}
        submitLabel="Guardar"
      >
        <FormField label="Nombre">
          <input
            className="input"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          />
        </FormField>
        <FormField label="Ciudad">
          <input
            className="input"
            value={form.ciudad}
            onChange={(e) => setForm({ ...form, ciudad: e.target.value })}
          />
        </FormField>
        <FormField label="Puerto">
          <input
            className="input"
            value={form.puerto}
            onChange={(e) => setForm({ ...form, puerto: e.target.value })}
          />
        </FormField>
        <FormField label="Coordenadas">
          <input
            className="input"
            value={form.coordenadas}
            onChange={(e) => setForm({ ...form, coordenadas: e.target.value })}
          />
        </FormField>
        {canDeleteLocation && (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              className="secondary-button"
              style={{ borderColor: "#d93025", color: "#d93025" }}
              onClick={handleDelete}
              type="button"
              title="Eliminar localización"
            >
              Eliminar localización
            </button>
          </div>
        )}
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
