import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Modal from "../components/Modal.jsx";
import Snackbar from "../components/Snackbar.jsx";
import {
  deleteProductoById,
  fetchProductoById,
  updateProductoById,
} from "../firebase/auth.js";
import { getCurrentUser } from "../utils/roles.js";

function toLabelDate(value) {
  if (!value) return "-";
  if (typeof value?.toDate === "function") {
    const d = value.toDate();
    if (Number.isNaN(d.getTime())) return "-";
    return new Intl.DateTimeFormat("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function formatEstadoLabel(value) {
  const raw = String(value || "").trim();
  if (!raw) return "-";
  const lower = raw.toLowerCase();
  return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
}

function normalizeEstadoProducto(value) {
  const lower = String(value || "")
    .trim()
    .toLowerCase();
  if (!lower) return "disponible";
  if (lower === "no disponible") return "no disponible";
  if (lower === "disponible") return "disponible";
  if (lower === "pendiente") return "disponible";
  if (lower === "validado") return "disponible";
  return "disponible";
}

export default function ProductDetail() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [loading, setLoading] = useState(true);
  const [producto, setProducto] = useState(null);
  const [openEdit, setOpenEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    codigo: "",
    nombre_producto: "",
    familia: "",
    composicion: "",
    alergenos: "",
    estado: "disponible",
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
        const p = await fetchProductoById(id);
        if (!mounted) return;
        setProducto(p);
        setEditForm({
          codigo: p?.codigo || "",
          nombre_producto: p?.nombre_producto || "",
          familia: p?.familia || "",
          composicion: p?.composicion || "",
          alergenos: p?.alergenos || "",
          estado: normalizeEstadoProducto(p?.estado),
        });
      } catch (e) {
        if (!mounted) return;
        setProducto(null);
        setSnack({
          open: true,
          message: "Error cargando producto",
          type: "error",
        });
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [id]);

  const rows = useMemo(() => {
    return [
      { label: "Código", value: producto?.codigo || "-" },
      { label: "Nombre del producto", value: producto?.nombre_producto || "-" },
      { label: "Familia", value: producto?.familia || "-" },
      { label: "Composición", value: producto?.composicion || "-" },
      { label: "Alérgenos", value: producto?.alergenos || "-" },
      { label: "Estado", value: formatEstadoLabel(producto?.estado) },
      { label: "Creado por", value: producto?.creado_por || "-" },
      { label: "Fecha creación", value: toLabelDate(producto?.fecha_creacion) },
      {
        label: "Última modificación",
        value: toLabelDate(producto?.fecha_modificacion),
      },
    ];
  }, [producto]);

  const submitEdit = async () => {
    try {
      if (!editForm.nombre_producto) {
        setSnack({
          open: true,
          message: "El nombre del producto es obligatorio",
          type: "error",
        });
        return;
      }
      const payload = {
        codigo: editForm.codigo,
        nombre_producto: editForm.nombre_producto,
        familia: editForm.familia,
        composicion: editForm.composicion,
        alergenos: editForm.alergenos,
        estado: editForm.estado,
        modificado_por: getCurrentUser()?.name || "Testing",
      };
      const updated = await updateProductoById(id, payload);
      if (!updated) {
        setSnack({
          open: true,
          message: "Producto no encontrado",
          type: "error",
        });
        return;
      }
      setProducto(updated);
      setOpenEdit(false);
      setSnack({
        open: true,
        message: "Producto actualizado",
        type: "success",
      });
    } catch (e) {
      setSnack({
        open: true,
        message: "Error actualizando producto",
        type: "error",
      });
    }
  };

  const handleDelete = async () => {
    const label = producto?.nombre_producto || producto?.codigo || "";
    if (
      !window.confirm(
        `¿Seguro que deseas borrar este producto${label ? ` "${label}"` : ""}?`,
      )
    )
      return;
    try {
      await deleteProductoById(id);
      setSnack({ open: true, message: "Producto borrado", type: "success" });
      navigate("/app/productos");
    } catch {
      setSnack({
        open: true,
        message: "Error borrando producto",
        type: "error",
      });
    }
  };

  if (loading) return <div className="card">Cargando...</div>;
  if (!producto) return <div className="card">No encontrado</div>;

  return (
    <>
      <section className="card">
        <div className="card-header">
          <h2 className="card-title">Detalle producto</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="icon-button"
              onClick={() => setOpenEdit(true)}
              title="Modificar"
            >
              <span className="material-symbols-outlined">edit</span>
            </button>
            <button
              className="icon-button"
              onClick={handleDelete}
              title="Borrar"
            >
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
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "160px 1fr",
              gap: 8,
            }}
          >
            {rows.map((r) => (
              <FragmentRow key={r.label} label={r.label} value={r.value} />
            ))}
          </div>
        </div>
      </section>

      <Modal
        open={openEdit}
        title="Modificar producto"
        onClose={() => setOpenEdit(false)}
        onSubmit={submitEdit}
        submitLabel="Guardar"
      >
        <div>
          <div className="label">Código</div>
          <input
            className="input"
            value={editForm.codigo}
            onChange={(e) =>
              setEditForm((prev) => ({ ...prev, codigo: e.target.value }))
            }
            placeholder="Código"
          />
        </div>
        <div>
          <div className="label">Nombre del producto</div>
          <input
            className="input"
            value={editForm.nombre_producto}
            onChange={(e) =>
              setEditForm((prev) => ({
                ...prev,
                nombre_producto: e.target.value,
              }))
            }
            placeholder="Nombre del producto"
          />
        </div>
        <div>
          <div className="label">Familia</div>
          <input
            className="input"
            value={editForm.familia}
            onChange={(e) =>
              setEditForm((prev) => ({ ...prev, familia: e.target.value }))
            }
            placeholder="Familia"
          />
        </div>
        <div>
          <div className="label">Composición</div>
          <input
            className="input"
            value={editForm.composicion}
            onChange={(e) =>
              setEditForm((prev) => ({ ...prev, composicion: e.target.value }))
            }
            placeholder="Composición"
          />
        </div>
        <div>
          <div className="label">Alérgenos</div>
          <input
            className="input"
            value={editForm.alergenos}
            onChange={(e) =>
              setEditForm((prev) => ({ ...prev, alergenos: e.target.value }))
            }
            placeholder="Alérgenos"
          />
        </div>
        <div>
          <div className="label">Estado</div>
          <select
            className="input"
            value={editForm.estado}
            onChange={(e) =>
              setEditForm((prev) => ({
                ...prev,
                estado: normalizeEstadoProducto(e.target.value),
              }))
            }
          >
            <option value="disponible">Disponible</option>
            <option value="no disponible">No disponible</option>
          </select>
        </div>
      </Modal>

      <Snackbar
        open={snack.open}
        message={snack.message}
        type={snack.type}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
      />
    </>
  );
}

function FragmentRow({ label, value }) {
  return (
    <>
      <div className="label">{label}</div>
      <div>{value}</div>
    </>
  );
}
