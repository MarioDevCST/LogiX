import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Modal from "../components/Modal.jsx";
import Snackbar from "../components/Snackbar.jsx";
import {
  deleteMermaById,
  fetchMermaById,
  updateMermaById,
} from "../firebase/auth.js";
import { getCurrentUser } from "../utils/roles.js";

const UNIT_OPTIONS = [
  { value: "unidad", label: "Unidad" },
  { value: "peso", label: "Peso" },
];

const ESTADO_OPTIONS = [
  { value: "Pendiente", label: "Pendiente" },
  { value: "Atendido", label: "Atendido" },
];

const MOTIVE_OPTIONS = [
  "Rotura por caída",
  "Mar estado",
  "Caducado",
  "Estaba defectuoso dentro del Palet",
  "Estaba defectuoso dentro de la caja",
  "Diferencia de Inventario",
].map((label) => ({ value: label, label }));

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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export default function MermaDetail() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [loading, setLoading] = useState(true);
  const [merma, setMerma] = useState(null);
  const [openEdit, setOpenEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    codigo: "",
    nombre_producto: "",
    lote: "",
    fecha_caducidad: "",
    cantidad: "",
    unidad: "unidad",
    motivo: MOTIVE_OPTIONS[0]?.value || "",
    estado: "Pendiente",
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
        const m = await fetchMermaById(id);
        if (!mounted) return;
        setMerma(m);
        setEditForm({
          codigo: m?.codigo || "",
          nombre_producto: m?.nombre_producto || "",
          lote: m?.lote || "",
          fecha_caducidad: m?.fecha_caducidad || "",
          cantidad:
            typeof m?.cantidad === "number"
              ? String(m.cantidad)
              : String(m?.cantidad || ""),
          unidad:
            String(m?.unidad || "unidad")
              .trim()
              .toLowerCase() === "peso"
              ? "peso"
              : "unidad",
          motivo: m?.motivo || MOTIVE_OPTIONS[0]?.value || "",
          estado:
            String(m?.estado || "Pendiente")
              .trim()
              .toLowerCase() === "atendido"
              ? "Atendido"
              : "Pendiente",
        });
      } catch {
        if (!mounted) return;
        setMerma(null);
        setSnack({
          open: true,
          message: "Error cargando merma",
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
      { label: "Código", value: merma?.codigo || "-" },
      { label: "Nombre del Producto", value: merma?.nombre_producto || "-" },
      { label: "Lote", value: merma?.lote || "-" },
      { label: "Fecha de Caducidad", value: merma?.fecha_caducidad || "-" },
      {
        label: "Cantidad",
        value:
          typeof merma?.cantidad === "number"
            ? merma.cantidad
            : String(merma?.cantidad || "-"),
      },
      {
        label: "Unidad",
        value:
          UNIT_OPTIONS.find(
            (o) =>
              o.value ===
              String(merma?.unidad || "")
                .trim()
                .toLowerCase(),
          )?.label ||
          merma?.unidad ||
          "-",
      },
      { label: "Motivo", value: merma?.motivo || "-" },
      { label: "Estado", value: formatEstadoLabel(merma?.estado) },
      { label: "Creado por", value: merma?.creado_por || "-" },
    ];
  }, [merma]);

  const downloadPdf = () => {
    const printableRows = [
      { label: "ID", value: merma?.id || merma?._id || id || "-" },
      ...rows,
      { label: "Fecha creación", value: toLabelDate(merma?.fecha_creacion) },
      {
        label: "Última modificación",
        value: toLabelDate(merma?.fecha_modificacion),
      },
    ];
    const nowLabel = toLabelDate(new Date());
    const title =
      merma?.codigo && merma?.nombre_producto
        ? `Informe de merma · ${merma.codigo} · ${merma.nombre_producto}`
        : "Informe de merma";
    const content = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; }
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"; margin: 0; padding: 32px; color: #111827; }
    header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
    h1 { font-size: 20px; margin: 0; }
    .meta { font-size: 12px; color: #6b7280; text-align: right; }
    table { width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; }
    th, td { padding: 10px 12px; vertical-align: top; }
    th { text-align: left; width: 220px; background: #f9fafb; border-bottom: 1px solid #e5e7eb; color: #111827; font-weight: 700; }
    td { border-bottom: 1px solid #f3f4f6; color: #111827; }
    tr:last-child th, tr:last-child td { border-bottom: none; }
    .footer { margin-top: 14px; font-size: 11px; color: #6b7280; }
    @media print { body { padding: 18mm; } }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>${escapeHtml(title)}</h1>
    </div>
    <div class="meta">
      <div>Generado: ${escapeHtml(nowLabel)}</div>
    </div>
  </header>
  <table>
    <tbody>
      ${printableRows
        .map(
          (r) =>
            `<tr><th>${escapeHtml(r.label)}</th><td>${escapeHtml(r.value)}</td></tr>`,
        )
        .join("")}
    </tbody>
  </table>
  <div class="footer">LogiX</div>
</body>
</html>`;

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";
    iframe.srcdoc = content;

    const cleanup = () => {
      if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
    };

    const doPrint = () => {
      try {
        const pw = iframe.contentWindow;
        if (!pw) throw new Error("No se pudo acceder al documento del informe");
        pw.focus();
        pw.print();
      } catch (e) {
        const msg = String(e?.message || "").trim();
        setSnack({
          open: true,
          message: msg || "No se pudo abrir el diálogo de impresión",
          type: "error",
        });
      }
      window.setTimeout(cleanup, 1200);
    };

    iframe.addEventListener("load", () => {
      window.setTimeout(doPrint, 50);
    });

    document.body.appendChild(iframe);
    window.setTimeout(doPrint, 700);
  };

  const submitEdit = async () => {
    try {
      if (!editForm.codigo || !editForm.nombre_producto) {
        setSnack({
          open: true,
          message: "Código y nombre del producto son obligatorios",
          type: "error",
        });
        return;
      }
      const payload = {
        codigo: editForm.codigo,
        nombre_producto: editForm.nombre_producto,
        lote: editForm.lote,
        fecha_caducidad: editForm.fecha_caducidad,
        cantidad: editForm.cantidad,
        unidad: editForm.unidad,
        motivo: editForm.motivo,
        estado: editForm.estado,
        modificado_por: getCurrentUser()?.name || "Testing",
      };
      const updated = await updateMermaById(id, payload);
      if (!updated) {
        setSnack({ open: true, message: "Merma no encontrada", type: "error" });
        return;
      }
      setMerma(updated);
      setOpenEdit(false);
      setSnack({ open: true, message: "Merma actualizada", type: "success" });
    } catch {
      setSnack({
        open: true,
        message: "Error actualizando merma",
        type: "error",
      });
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("¿Seguro que deseas borrar esta merma?")) return;
    try {
      await deleteMermaById(id);
      setSnack({ open: true, message: "Merma borrada", type: "success" });
      navigate("/app/mermas");
    } catch {
      setSnack({ open: true, message: "Error borrando merma", type: "error" });
    }
  };

  if (loading) return <div className="card">Cargando...</div>;
  if (!merma) return <div className="card">No encontrado</div>;

  return (
    <>
      <section className="card">
        <div className="card-header">
          <h2 className="card-title">Detalle merma</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="icon-button" onClick={downloadPdf} title="PDF">
              <span className="material-symbols-outlined">picture_as_pdf</span>
            </button>
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
              gridTemplateColumns: "180px 1fr",
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
        title="Modificar merma"
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
          <div className="label">Nombre del Producto</div>
          <input
            className="input"
            value={editForm.nombre_producto}
            onChange={(e) =>
              setEditForm((prev) => ({
                ...prev,
                nombre_producto: e.target.value,
              }))
            }
            placeholder="Nombre del Producto"
          />
        </div>

        <div>
          <div className="label">Lote</div>
          <input
            className="input"
            value={editForm.lote}
            onChange={(e) =>
              setEditForm((prev) => ({ ...prev, lote: e.target.value }))
            }
            placeholder="Lote"
          />
        </div>

        <div>
          <div className="label">Fecha de Caducidad</div>
          <input
            className="input"
            type="date"
            value={editForm.fecha_caducidad}
            onChange={(e) =>
              setEditForm((prev) => ({
                ...prev,
                fecha_caducidad: e.target.value,
              }))
            }
          />
        </div>

        <div>
          <div className="label">Cantidad</div>
          <input
            className="input"
            type="number"
            step="0.01"
            value={editForm.cantidad}
            onChange={(e) =>
              setEditForm((prev) => ({ ...prev, cantidad: e.target.value }))
            }
            placeholder="Cantidad"
          />
        </div>

        <div>
          <div className="label">Unidad</div>
          <select
            className="input"
            value={editForm.unidad}
            onChange={(e) =>
              setEditForm((prev) => ({
                ...prev,
                unidad: String(e.target.value || "")
                  .trim()
                  .toLowerCase(),
              }))
            }
          >
            {UNIT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="label">Motivo</div>
          <select
            className="input"
            value={editForm.motivo}
            onChange={(e) =>
              setEditForm((prev) => ({ ...prev, motivo: e.target.value }))
            }
          >
            {MOTIVE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="label">Estado</div>
          <select
            className="input"
            value={editForm.estado}
            onChange={(e) =>
              setEditForm((prev) => ({
                ...prev,
                estado: String(e.target.value || "").trim(),
              }))
            }
          >
            {ESTADO_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
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
