import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DataTable from "../components/DataTable.jsx";
import Modal from "../components/Modal.jsx";
import Pagination from "../components/Pagination.jsx";
import Snackbar from "../components/Snackbar.jsx";
import FormField from "../components/FormField.jsx";
import {
  createMerma,
  fetchAllMerma,
  fetchAllProductos,
} from "../firebase/auth.js";
import { ROLES, getCurrentRole, getCurrentUser } from "../utils/roles.js";

function formatDateDMY(value) {
  if (!value) return "-";
  if (typeof value?.toDate === "function") {
    const d = value.toDate();
    if (Number.isNaN(d.getTime())) return "-";
    return new Intl.DateTimeFormat("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d);
  }
  const raw = String(value || "").trim();
  if (!raw) return "-";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

function statusChip(estadoValue) {
  const raw = String(estadoValue || "").trim();
  const lower = raw.toLowerCase();
  const label = lower
    ? `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`
    : "-";

  const palette =
    lower === "atendido"
      ? { bg: "#dcfce7", fg: "#166534" }
      : { bg: "#fef9c3", fg: "#854d0e" };

  return (
    <span
      className="chip"
      style={{
        background: palette.bg,
        color: palette.fg,
        fontWeight: 600,
      }}
    >
      {label}
    </span>
  );
}

const UNIT_OPTIONS = [
  { value: "unidad", label: "Unidad" },
  { value: "peso", label: "Peso" },
];

const MOTIVE_OPTIONS = [
  "Rotura por caída",
  "Mar estado",
  "Caducado",
  "Estaba defectuoso dentro del Palet",
  "Estaba defectuoso dentro de la caja",
  "Diferencia de Inventario",
].map((label) => ({ value: label, label }));

export default function Waste() {
  const navigate = useNavigate();
  const role = getCurrentRole();
  const isWarehouse = role === ROLES.ALMACEN;
  const isOffice = role === ROLES.OFICINA;

  const columns = [
    { key: "codigo", header: "Código" },
    { key: "nombre_producto", header: "Nombre del Producto" },
    { key: "lote", header: "Lote" },
    { key: "fecha_caducidad", header: "Fecha de Caducidad" },
    { key: "cantidad", header: "Cantidad" },
    { key: "unidad", header: "Unidad" },
    { key: "motivo", header: "Motivo" },
    { key: "estado", header: "Estado" },
    { key: "creado_por", header: "Creado por" },
  ];

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [productos, setProductos] = useState([]);
  const [query, setQuery] = useState("");
  const [motivoFilter, setMotivoFilter] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [estadoFilter, setEstadoFilter] = useState("pendiente");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [open, setOpen] = useState(false);
  const [activeSuggest, setActiveSuggest] = useState(null);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [form, setForm] = useState({
    codigo: "",
    nombre_producto: "",
    lote: "",
    fecha_caducidad: "",
    cantidad: "",
    unidad: "unidad",
    motivo: MOTIVE_OPTIONS[0]?.value || "",
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
        const list = await fetchAllMerma();
        if (!mounted) return;
        setItems(Array.isArray(list) ? list : []);
      } catch (e) {
        if (!mounted) return;
        setItems([]);
        const code = String(e?.code || "").trim();
        const msg = String(e?.message || "").trim();
        const isPerm =
          code === "permission-denied" ||
          code === "PERMISSION_DENIED" ||
          msg.toLowerCase().includes("insufficient permissions");
        setSnack({
          open: true,
          message: isPerm
            ? "No tienes permisos para leer Mermas en Firestore (revisa firestore.rules desplegadas)"
            : `Error cargando mermas${code ? ` (${code})` : ""}`,
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
  }, []);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        const list = await fetchAllProductos();
        if (!mounted) return;
        setProductos(Array.isArray(list) ? list : []);
      } catch {
        if (!mounted) return;
        setProductos([]);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, []);

  const productoSuggestions = useMemo(() => {
    const q = String(productSearch || "")
      .trim()
      .toLowerCase();
    if (!q) return [];
    const list = Array.isArray(productos) ? productos : [];
    const matches = list.filter((p) => {
      const code = String(p?.codigo || "")
        .trim()
        .toLowerCase();
      const name = String(p?.nombre_producto || "")
        .trim()
        .toLowerCase();
      return code.includes(q) || name.includes(q);
    });
    matches.sort((a, b) => {
      const aCode = String(a?.codigo || "").trim();
      const bCode = String(b?.codigo || "").trim();
      const aName = String(a?.nombre_producto || "").trim();
      const bName = String(b?.nombre_producto || "").trim();
      const aStarts =
        aCode.toLowerCase().startsWith(q) || aName.toLowerCase().startsWith(q);
      const bStarts =
        bCode.toLowerCase().startsWith(q) || bName.toLowerCase().startsWith(q);
      if (aStarts !== bStarts) return aStarts ? -1 : 1;
      const aLabel = `${aCode} ${aName}`.trim();
      const bLabel = `${bCode} ${bName}`.trim();
      return aLabel.localeCompare(bLabel, "es");
    });
    return matches.slice(0, 10);
  }, [productSearch, productos]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const motivoQ = String(motivoFilter || "")
      .trim()
      .toLowerCase();
    const estadoQ = String(estadoFilter || "")
      .trim()
      .toLowerCase();
    return items.filter((i) => {
      if (motivoQ) {
        const m = String(i?.motivo || "")
          .trim()
          .toLowerCase();
        if (m !== motivoQ) return false;
      }
      if (estadoQ) {
        const e = String(i?.estado || "")
          .trim()
          .toLowerCase();
        if (e !== estadoQ) return false;
      }
      if (q === "") return true;
      return (
        String(i?.codigo || "")
          .toLowerCase()
          .includes(q) ||
        String(i?.nombre_producto || "")
          .toLowerCase()
          .includes(q) ||
        String(i?.lote || "")
          .toLowerCase()
          .includes(q) ||
        String(i?.motivo || "")
          .toLowerCase()
          .includes(q) ||
        String(i?.estado || "")
          .toLowerCase()
          .includes(q)
      );
    });
  }, [items, query, motivoFilter, estadoFilter]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filtered.slice(start, end);
  }, [filtered, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [query, motivoFilter, estadoFilter]);

  const rows = useMemo(() => {
    const labelForUnit = (value) => {
      const v = String(value || "")
        .trim()
        .toLowerCase();
      return UNIT_OPTIONS.find((o) => o.value === v)?.label || value || "-";
    };
    return paginated.map((m) => ({
      id: m?._id || m?.id,
      codigo: m?.codigo || "-",
      nombre_producto: m?.nombre_producto || "-",
      lote: m?.lote || "-",
      fecha_caducidad: formatDateDMY(m?.fecha_caducidad),
      cantidad:
        typeof m?.cantidad === "number"
          ? m.cantidad
          : String(m?.cantidad || "-"),
      unidad: labelForUnit(m?.unidad),
      motivo: m?.motivo || "-",
      estado: statusChip(m?.estado || "Pendiente"),
      creado_por: m?.creado_por || "-",
    }));
  }, [paginated]);

  const onCreate = () => {
    setOpen(true);
    setActiveSuggest(null);
    setSelectedProductId("");
    setProductSearch("");
    setForm({
      codigo: "",
      nombre_producto: "",
      lote: "",
      fecha_caducidad: "",
      cantidad: "",
      unidad: "unidad",
      motivo: MOTIVE_OPTIONS[0]?.value || "",
    });
  };

  const submit = async () => {
    try {
      const selected = (Array.isArray(productos) ? productos : []).find((p) => {
        const pid = String(p?.id || p?._id || "").trim();
        return pid && pid === String(selectedProductId || "").trim();
      });
      if (!selected) {
        setSnack({
          open: true,
          message: "Selecciona un producto ya registrado para crear la merma",
          type: "error",
        });
        return;
      }
      const codigo = String(selected?.codigo || "").trim();
      const nombre_producto = String(selected?.nombre_producto || "").trim();
      if (!codigo || !nombre_producto) {
        setSnack({
          open: true,
          message:
            "El producto seleccionado no tiene código o nombre. Revisa el registro del producto.",
          type: "error",
        });
        return;
      }
      const payload = {
        codigo,
        nombre_producto,
        lote: form.lote,
        fecha_caducidad: form.fecha_caducidad,
        cantidad: form.cantidad,
        unidad: form.unidad,
        motivo: form.motivo,
        creado_por: getCurrentUser()?.name || "Testing",
      };
      const created = await createMerma(payload);
      if (!created) {
        setSnack({
          open: true,
          message: "Error creando merma",
          type: "error",
        });
        return;
      }
      setItems((prev) => [created, ...(Array.isArray(prev) ? prev : [])]);
      setOpen(false);
      setActiveSuggest(null);
      setForm({
        codigo: "",
        nombre_producto: "",
        lote: "",
        fecha_caducidad: "",
        cantidad: "",
        unidad: "unidad",
        motivo: MOTIVE_OPTIONS[0]?.value || "",
      });
      setSnack({ open: true, message: "Merma creada", type: "success" });
    } catch (e) {
      const code = String(e?.code || "").trim();
      const msg = String(e?.message || "").trim();
      const isPerm =
        code === "permission-denied" ||
        code === "PERMISSION_DENIED" ||
        msg.toLowerCase().includes("insufficient permissions");
      setSnack({
        open: true,
        message: isPerm
          ? "No tienes permisos para crear Mermas en Firestore (revisa firestore.rules desplegadas)"
          : msg || `Error creando merma${code ? ` (${code})` : ""}`,
        type: "error",
      });
    }
  };

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            className="input"
            placeholder="Buscar por código, producto, lote, motivo o estado"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            className="input"
            value={motivoFilter}
            onChange={(e) => setMotivoFilter(e.target.value)}
            title="Filtrar por motivo"
          >
            <option value="">Todos los motivos</option>
            {MOTIVE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {!isWarehouse && !isOffice && (
            <button
              className="secondary-button"
              title={showHistory ? "Ver solo pendientes" : "Ver historial"}
              onClick={() => {
                setShowHistory((prev) => {
                  const next = !prev;
                  setEstadoFilter(next ? "" : "pendiente");
                  return next;
                });
              }}
            >
              <span className="material-symbols-outlined">history</span>
              {showHistory ? "Solo pendientes" : "Historial"}
            </button>
          )}
        </div>
      </div>

      <DataTable
        title="Mermas"
        columns={columns}
        data={rows}
        loading={loading}
        createLabel="Crear merma"
        onCreate={onCreate}
        onRowClick={(row) => {
          const id = String(row?.id || "").trim();
          if (!id) return;
          navigate(`/app/mermas/${id}`);
        }}
      />

      <Pagination
        page={page}
        pageSize={pageSize}
        total={filtered.length}
        onPageChange={(p) => setPage(Math.max(1, p))}
        onPageSizeChange={(s) => {
          setPageSize(s);
          setPage(1);
        }}
      />

      <Modal
        open={open}
        title="Crear merma"
        onClose={() => setOpen(false)}
        onSubmit={submit}
        submitLabel="Crear"
      >
        <FormField label="Producto">
          <div style={{ position: "relative", display: "flex", gap: 8 }}>
            <input
              className="input"
              value={productSearch}
              onChange={(e) => setProductSearch(String(e.target.value || ""))}
              placeholder="Buscar por código o nombre"
              onFocus={() => {
                if (!selectedProductId) setActiveSuggest("producto");
              }}
              onBlur={() => setTimeout(() => setActiveSuggest(null), 120)}
              readOnly={!!selectedProductId}
            />
            {selectedProductId && (
              <button
                type="button"
                className="icon-button"
                title="Cambiar producto"
                onClick={() => {
                  setSelectedProductId("");
                  setProductSearch("");
                  setForm((prev) => ({
                    ...prev,
                    codigo: "",
                    nombre_producto: "",
                  }));
                }}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            )}
            {activeSuggest === "producto" &&
              !selectedProductId &&
              productoSuggestions.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 6px)",
                    left: 0,
                    right: 0,
                    zIndex: 50,
                    background: "#fff",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
                    overflow: "hidden",
                    maxHeight: 240,
                    overflowY: "auto",
                  }}
                >
                  {productoSuggestions.map((p) => {
                    const pid = String(p?.id || p?._id || "");
                    const code = String(p?.codigo || "").trim();
                    const name = String(p?.nombre_producto || "").trim();
                    return (
                      <button
                        key={pid || `${code}-${name}`}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setSelectedProductId(pid);
                          setProductSearch(
                            `${code || "—"} — ${name || "—"}`.trim(),
                          );
                          setForm((prev) => ({
                            ...prev,
                            codigo: code || prev.codigo,
                            nombre_producto: name || prev.nombre_producto,
                          }));
                          setActiveSuggest(null);
                        }}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: "10px 12px",
                          border: "none",
                          background: "#fff",
                          cursor: "pointer",
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                        }}
                      >
                        <span style={{ fontWeight: 700 }}>{code || "—"}</span>
                        <span
                          style={{
                            color: "var(--text-secondary)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {name || "—"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
          </div>
        </FormField>

        <FormField label="Lote">
          <input
            className="input"
            value={form.lote}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, lote: e.target.value }))
            }
            placeholder="Lote"
          />
        </FormField>

        <FormField label="Fecha de Caducidad">
          <input
            className="input"
            type="date"
            value={form.fecha_caducidad}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, fecha_caducidad: e.target.value }))
            }
          />
        </FormField>

        <FormField label="Cantidad">
          <input
            className="input"
            type="number"
            step="0.01"
            value={form.cantidad}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, cantidad: e.target.value }))
            }
            placeholder="Cantidad"
          />
        </FormField>

        <FormField label="Unidad">
          <select
            className="input"
            value={form.unidad}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, unidad: e.target.value }))
            }
          >
            {UNIT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Motivo">
          <select
            className="input"
            value={form.motivo}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, motivo: e.target.value }))
            }
          >
            {MOTIVE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </FormField>
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
