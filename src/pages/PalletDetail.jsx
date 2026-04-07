import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Modal from "../components/Modal.jsx";
import Snackbar from "../components/Snackbar.jsx";
import { ROLES, getCurrentRole, getCurrentUser } from "../utils/roles.js";
import {
  deletePalletById,
  fetchPalletById,
  fetchAllProductos,
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
  const role = getCurrentRole();
  const isOffice = role === ROLES.OFICINA;
  const [pallet, setPallet] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    numero_palet: "",
    tipo: "Seco",
    base: "Europeo",
    productos: "",
  });
  const [productosCatalogo, setProductosCatalogo] = useState([]);
  const [productosItems, setProductosItems] = useState([]);
  const [productoSearch, setProductoSearch] = useState("");
  const [productoSuggestOpen, setProductoSuggestOpen] = useState(false);
  const [selectedProductoId, setSelectedProductoId] = useState("");
  const [productoCantidad, setProductoCantidad] = useState("");
  const [snack, setSnack] = useState({
    open: false,
    message: "",
    type: "success",
  });

  const productoSuggestions = (() => {
    const q = String(productoSearch || "")
      .trim()
      .toLowerCase();
    if (!q) return [];
    const list = Array.isArray(productosCatalogo) ? productosCatalogo : [];
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
      return aLabel.localeCompare(bLabel, "es", { sensitivity: "base" });
    });
    return matches.slice(0, 10);
  })();

  const buildProductosText = (items) => {
    const list = Array.isArray(items) ? items : [];
    return list
      .map((it) => {
        const code = String(it?.codigo || "").trim();
        const name = String(it?.nombre_producto || "").trim();
        const qty =
          typeof it?.cantidad === "number"
            ? it.cantidad
            : Number(String(it?.cantidad || "").trim());
        const cantidad = Number.isFinite(qty) ? qty : 0;
        const label = code || name || String(it?.producto_id || "").trim();
        if (!label) return "";
        const suffix = name && code ? ` — ${name}` : name && !code ? name : "";
        return `${label}${suffix}: ${cantidad}`;
      })
      .filter(Boolean)
      .join("\n");
  };

  useEffect(() => {
    let mounted = true;
    fetchAllProductos()
      .then((list) => {
        if (!mounted) return;
        setProductosCatalogo(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!mounted) return;
        setProductosCatalogo([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

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
          productos: String(p?.productos || ""),
        });
        setProductosItems(
          Array.isArray(p?.productos_items) ? p.productos_items : [],
        );
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
      if (isOffice) {
        setSnack({
          open: true,
          message: "No tienes permisos para modificar palets",
          type: "error",
        });
        return;
      }
      const productosText =
        productosItems.length > 0
          ? buildProductosText(productosItems)
          : String(form.productos || "");
      const updated = await updatePalletById(id, {
        ...form,
        productos: productosText,
        productos_items: productosItems,
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
      if (isOffice) {
        setSnack({
          open: true,
          message: "No tienes permisos para borrar palets",
          type: "error",
        });
        return;
      }
      const confirmed = window.confirm(
        "¿Seguro que quieres borrar este palet?",
      );
      if (!confirmed) return;
      const typed = window.prompt(
        "Escribe BORRAR para confirmar la eliminación",
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
          {!isOffice && (
            <>
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
            </>
          )}
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
          {Array.isArray(pallet?.productos_items) &&
          pallet.productos_items.length > 0 ? (
            <span style={{ whiteSpace: "pre-wrap" }}>
              {buildProductosText(pallet.productos_items) || "-"}
            </span>
          ) : pallet.productos ? (
            <span style={{ whiteSpace: "pre-wrap" }}>{pallet.productos}</span>
          ) : (
            "-"
          )}
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

      {!isOffice && (
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
              onChange={(e) =>
                setForm({ ...form, numero_palet: e.target.value })
              }
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
          <div>
            <div className="label">Productos</div>
            <div style={{ display: "grid", gap: 10 }}>
              <div
                style={{ display: "flex", gap: 10, alignItems: "flex-start" }}
              >
                <div style={{ flex: 1, position: "relative" }}>
                  <input
                    className="input"
                    value={productoSearch}
                    onChange={(e) => {
                      setProductoSearch(String(e.target.value || ""));
                      setProductoSuggestOpen(true);
                      setSelectedProductoId("");
                    }}
                    placeholder="Buscar por código o nombre"
                    onFocus={() => setProductoSuggestOpen(true)}
                    onBlur={() =>
                      setTimeout(() => setProductoSuggestOpen(false), 120)
                    }
                  />
                  {productoSuggestOpen && productoSuggestions.length > 0 && (
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
                        const pid = String(p?.id || p?._id || "").trim();
                        const code = String(p?.codigo || "").trim();
                        const name = String(p?.nombre_producto || "").trim();
                        const estado = String(p?.estado || "").trim();
                        return (
                          <button
                            key={pid || `${code}-${name}`}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setSelectedProductoId(pid);
                              setProductoSearch(
                                `${code || "—"} — ${name || "—"}`.trim(),
                              );
                              setProductoSuggestOpen(false);
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
                            <span style={{ fontWeight: 800 }}>
                              {code || name || "—"}
                            </span>
                            <span
                              style={{
                                color: "var(--text-secondary)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {code && name
                                ? name
                                : estado
                                  ? `(${estado})`
                                  : "—"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <input
                  className="input"
                  style={{ width: 140 }}
                  type="number"
                  step="0.01"
                  min="0"
                  value={productoCantidad}
                  onChange={(e) =>
                    setProductoCantidad(String(e.target.value || ""))
                  }
                  placeholder="Cantidad"
                />

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    const pid = String(selectedProductoId || "").trim();
                    const qtyNum = Number(
                      String(productoCantidad || "").trim(),
                    );
                    const cantidad = Number.isFinite(qtyNum) ? qtyNum : 0;
                    if (!pid) {
                      setSnack({
                        open: true,
                        message: "Selecciona un producto",
                        type: "error",
                      });
                      return;
                    }
                    if (!cantidad) {
                      setSnack({
                        open: true,
                        message: "La cantidad debe ser mayor que 0",
                        type: "error",
                      });
                      return;
                    }
                    const selected = (
                      Array.isArray(productosCatalogo) ? productosCatalogo : []
                    ).find((p) => String(p?.id || p?._id || "").trim() === pid);
                    if (!selected) {
                      setSnack({
                        open: true,
                        message: "Producto no encontrado",
                        type: "error",
                      });
                      return;
                    }
                    const code = String(selected?.codigo || "").trim();
                    const name = String(selected?.nombre_producto || "").trim();
                    setProductosItems((prev) => {
                      const list = Array.isArray(prev) ? prev.slice() : [];
                      const idx = list.findIndex(
                        (it) =>
                          String(it?.producto_id || "").trim() === pid ||
                          String(it?.id || "").trim() === pid,
                      );
                      if (idx >= 0) {
                        const prevQty =
                          typeof list[idx]?.cantidad === "number"
                            ? list[idx].cantidad
                            : Number(String(list[idx]?.cantidad || "").trim());
                        const nextQty =
                          (Number.isFinite(prevQty) ? prevQty : 0) + cantidad;
                        list[idx] = { ...list[idx], cantidad: nextQty };
                        return list;
                      }
                      list.push({
                        producto_id: pid,
                        codigo: code,
                        nombre_producto: name,
                        cantidad,
                      });
                      return list;
                    });
                    setProductoSearch("");
                    setSelectedProductoId("");
                    setProductoCantidad("");
                    setProductoSuggestOpen(false);
                  }}
                >
                  Añadir
                </button>
              </div>

              {productosItems.length > 0 ? (
                <div style={{ display: "grid", gap: 8 }}>
                  {productosItems.map((it, idx) => {
                    const pid = String(it?.producto_id || it?.id || idx);
                    const code = String(it?.codigo || "").trim();
                    const name = String(it?.nombre_producto || "").trim();
                    const qty =
                      typeof it?.cantidad === "number"
                        ? it.cantidad
                        : Number(String(it?.cantidad || "").trim());
                    const cantidad = Number.isFinite(qty) ? qty : 0;
                    return (
                      <div
                        key={pid}
                        style={{
                          display: "flex",
                          gap: 10,
                          alignItems: "center",
                          border: "1px solid var(--border)",
                          borderRadius: 10,
                          padding: 10,
                          background: "#fff",
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 800 }}>
                            {code || name || "—"}
                          </div>
                          <div
                            style={{
                              color: "var(--text-secondary)",
                              fontSize: 13,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {code && name ? name : pid}
                          </div>
                        </div>
                        <input
                          className="input"
                          style={{ width: 140 }}
                          type="number"
                          step="0.01"
                          min="0"
                          value={String(cantidad)}
                          onChange={(e) => {
                            const next = Number(
                              String(e.target.value || "").trim(),
                            );
                            setProductosItems((prev) => {
                              const list = Array.isArray(prev)
                                ? prev.slice()
                                : [];
                              const nextQty = Number.isFinite(next) ? next : 0;
                              list[idx] = { ...list[idx], cantidad: nextQty };
                              return list;
                            });
                          }}
                        />
                        <button
                          type="button"
                          className="icon-button"
                          title="Borrar"
                          onClick={() => {
                            setProductosItems((prev) =>
                              (Array.isArray(prev) ? prev : []).filter(
                                (_, i) => i !== idx,
                              ),
                            );
                          }}
                        >
                          <span className="material-symbols-outlined">
                            delete
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                  No hay productos añadidos.
                </div>
              )}

              <textarea
                className="input"
                rows="4"
                value={form.productos}
                onChange={(e) =>
                  setForm({ ...form, productos: e.target.value })
                }
                placeholder="Texto libre (opcional)"
              />
            </div>
          </div>
        </Modal>
      )}

      <Snackbar
        open={snack.open}
        message={snack.message}
        type={snack.type}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
      />
    </section>
  );
}
