import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Modal from "../components/Modal.jsx";
import Snackbar from "../components/Snackbar.jsx";
import { getCurrentUser } from "../utils/roles.js";
import {
  deletePalletById,
  fetchPalletById,
  updatePalletById,
} from "../firebase/auth.js";

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

export default function PalletDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [pallet, setPallet] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    numero_palet: "",
    tipo: "Seco",
    base: "Europeo",
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
        const p = await fetchPalletById(id);
        if (!mounted) return;
        setPallet(p);
        setForm({
          numero_palet: p?.numero_palet || "",
          tipo: p?.tipo || "Seco",
          base: p?.base || "Europeo",
        });
      } catch {
        if (!mounted) return;
        setPallet(null);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [id]);

  const submit = async () => {
    try {
      const updated = await updatePalletById(id, {
        ...form,
        modificado_por: getCurrentUser()?.name || "Testing",
      });
      if (!updated) {
        setSnack({ open: true, message: "Palet no encontrado", type: "error" });
        return;
      }
      setPallet(updated);
      setOpen(false);
      setSnack({ open: true, message: "Palet actualizado", type: "success" });
    } catch (e) {
      setSnack({
        open: true,
        message: "Error actualizando palet",
        type: "error",
      });
    }
  };

  const onDelete = async () => {
    try {
      const confirmed = window.confirm(
        "¿Seguro que quieres borrar este palet?"
      );
      if (!confirmed) return;
      const typed = window.prompt(
        "Escribe BORRAR para confirmar la eliminación"
      );
      if (typed !== "BORRAR") {
        setSnack({
          open: true,
          message: "Confirmación inválida. Escribe BORRAR exactamente.",
          type: "error",
        });
        return;
      }
      await deletePalletById(id);
      setSnack({ open: true, message: "Palet borrado", type: "success" });
      const fromRaw = location?.state?.from;
      const from =
        typeof fromRaw === "string" && fromRaw.trim().startsWith("/app/")
          ? fromRaw.trim()
          : "";
      navigate(from || "/app/palets", { replace: true });
    } catch (e) {
      setSnack({
        open: true,
        message: "Error eliminando palet",
        type: "error",
      });
    }
  };

  if (!pallet) return <p>Cargando...</p>;

  return (
    <section className="card">
      <div className="card-header">
        <h2 className="card-title">Detalle palet</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="icon-button"
            onClick={() => setOpen(true)}
            title="Modificar"
          >
            <span className="material-symbols-outlined">edit</span>
          </button>
          <button className="icon-button" onClick={onDelete} title="Borrar">
            <span className="material-symbols-outlined">delete</span>
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
          <strong>Nombre:</strong> {pallet.nombre || "-"}
        </p>
        <p>
          <strong>Número de palet:</strong> {pallet.numero_palet}
        </p>
        <p>
          <strong>Tipo:</strong> {pallet.tipo}
        </p>
        <p>
          <strong>Base:</strong> {pallet.base || "-"}
        </p>
        <p>
          <strong>Carga:</strong> {pallet.carga_nombre || pallet.carga || "-"}
        </p>
        <p>
          <strong>Productos:</strong>{" "}
          {pallet.productos ? pallet.productos : "-"}
        </p>
        <p>
          <strong>Creado:</strong>{" "}
          {formatDateTime(pallet.createdAt || pallet.fecha_creacion)}
        </p>
        <p>
          <strong>Actualizado:</strong>{" "}
          {formatDateTime(pallet.updatedAt || pallet.fecha_modificacion)}
        </p>
      </div>

      <Modal
        open={open}
        title="Modificar palet"
        onClose={() => setOpen(false)}
        onSubmit={submit}
        submitLabel="Guardar"
      >
        <div>
          <div className="label">Número de palet</div>
          <input
            className="input"
            value={form.numero_palet}
            onChange={(e) => setForm({ ...form, numero_palet: e.target.value })}
          />
        </div>
        <div>
          <div className="label">Tipo</div>
          <select
            className="select"
            value={form.tipo}
            onChange={(e) => setForm({ ...form, tipo: e.target.value })}
          >
            <option value="Seco">Seco</option>
            <option value="Refrigerado">Refrigerado</option>
            <option value="Congelado">Congelado</option>
            <option value="Técnico">Técnico</option>
            <option value="Fruta y verdura">Fruta y verdura</option>
            <option value="Repuestos">Repuestos</option>
          </select>
        </div>
        <div>
          <div className="label">Base</div>
          <select
            className="select"
            value={form.base || "Europeo"}
            onChange={(e) => setForm({ ...form, base: e.target.value })}
          >
            <option value="Europeo">Europeo</option>
            <option value="Americano">Americano</option>
          </select>
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
