import { useEffect, useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import DataTable from "../components/DataTable.jsx";
import Modal from "../components/Modal.jsx";
import Snackbar from "../components/Snackbar.jsx";
import Pagination from "../components/Pagination.jsx";
import {
  getCurrentRole,
  hasPermission,
  PERMISSIONS,
  getCurrentUser,
} from "../utils/roles.js";
import {
  createPallet,
  fetchAllLoads,
  fetchAllPallets,
  fusePallets,
} from "../firebase/auth.js";

const TIPO_OPTIONS = [
  { label: "Seco", value: "Seco" },
  { label: "Refrigerado", value: "Refrigerado" },
  { label: "Congelado", value: "Congelado" },
  { label: "Técnico", value: "Técnico" },
  { label: "Fruta y verdura", value: "Fruta y verdura" },
  { label: "Repuestos", value: "Repuestos" },
];

function getTipoColors(tipo) {
  const t = String(tipo || "")
    .trim()
    .toLowerCase();
  if (t === "seco") return { color: "#f59e0b", strong: "#b45309" };
  if (t === "refrigerado") return { color: "#22c55e", strong: "#15803d" };
  if (t === "congelado") return { color: "#3b82f6", strong: "#1d4ed8" };
  if (t === "técnico" || t === "tecnico")
    return { color: "#a78bfa", strong: "#6d28d9" };
  if (t === "fruta y verdura") return { color: "#14b8a6", strong: "#0f766e" };
  if (t === "repuestos") return { color: "#ef4444", strong: "#991b1b" };
  return { color: "#9ca3af", strong: "#374151" };
}

function formatDateLabel(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

function combineDateTime(dateValue, timeValue) {
  if (!dateValue) return null;
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return null;
  if (timeValue) {
    const [hh, mm] = String(timeValue).split(":");
    d.setHours(Number(hh) || 0, Number(mm) || 0, 0, 0);
  }
  return d;
}

export default function Pallets() {
  const columns = [
    { key: "nombre", header: "Nombre" },
    { key: "numero_palet", header: "Número de palet" },
    { key: "tipo", header: "Tipo" },
    { key: "base", header: "Base" },
  ];

  const navigate = useNavigate();
  const [view, setView] = useState("dual");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [expandedLoadId, setExpandedLoadId] = useState(null);
  const [dragPalletId, setDragPalletId] = useState("");
  const [dragPalletTipo, setDragPalletTipo] = useState("");
  const [dragOverPalletId, setDragOverPalletId] = useState("");
  const [openFuseDnD, setOpenFuseDnD] = useState(false);
  const [fuseDnDSourceId, setFuseDnDSourceId] = useState("");
  const [fuseDnDTargetId, setFuseDnDTargetId] = useState("");
  const [fuseDnDBaseChoice, setFuseDnDBaseChoice] = useState("");
  const [fuseSubmitting, setFuseSubmitting] = useState(false);

  const [form, setForm] = useState({
    numero_palet: "",
    tipo: "Seco",
    base: "Europeo",
    carga: "",
    productos: "",
  });

  const role = getCurrentRole() || getCurrentUser()?.role || null;
  const canManagePallets =
    hasPermission(role, PERMISSIONS.MANAGE_PALLETS) ||
    String(role || "")
      .trim()
      .toLowerCase() === "dispatcher";
  const canManageLoads = hasPermission(role, PERMISSIONS.MANAGE_LOADS);
  const canCreatePallets = canManagePallets || canManageLoads;
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [snack, setSnack] = useState({
    open: false,
    message: "",
    type: "success",
  });

  // nuevos estados para modo dual
  const [palletDocs, setPalletDocs] = useState([]);
  const [loads, setLoads] = useState([]);
  const [loadsLoading, setLoadsLoading] = useState(false);
  // paginación local para listas de la vista dual
  const [loadsListPage, setLoadsListPage] = useState(1);
  const [loadsListPageSize, setLoadsListPageSize] = useState(10);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        setLoading(true);
        const list = await fetchAllPallets();
        if (!mounted) return;
        setPalletDocs(list);
        const mapped = list.map((p) => ({
          id: p._id || p.id,
          nombre: p.nombre,
          numero_palet: p.numero_palet,
          tipo: p.tipo,
          base: p.base || "",
        }));
        setRows(mapped);
      } catch {
        if (!mounted) return;
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();

    // cargar cargas para el modo dual
    setLoadsLoading(true);
    fetchAllLoads()
      .then((list) => {
        if (!mounted) return;
        const normalize = (x) => ({
          ...x,
          _id: x?._id || x?.id,
          id: x?.id || x?._id,
        });
        setLoads(Array.isArray(list) ? list.map(normalize) : []);
      })
      .catch(() => {
        if (!mounted) return;
        setLoads([]);
      })
      .finally(() => {
        if (!mounted) return;
        setLoadsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const location = useLocation();
  useEffect(() => {
    const cargaId = location.state && location.state.createPalletForCarga;
    if (cargaId) {
      setOpen(true);
      setForm((prev) => ({ ...prev, carga: cargaId }));
    }
  }, [location.state]);

  const onCreate = () => {
    if (!canCreatePallets) {
      setSnack({
        open: true,
        message: "No tienes permiso para crear palets",
        type: "error",
      });
      return;
    }
    setOpen(true);
  };

  const canDnDFuseTo = (targetPallet) => {
    if (!canManagePallets) return false;
    if (!dragPalletId) return false;
    const targetId = String(targetPallet?._id || targetPallet?.id || "");
    if (!targetId) return false;
    if (String(targetId) === String(dragPalletId)) return false;
    return (
      String(targetPallet?.tipo || "").trim() ===
      String(dragPalletTipo || "").trim()
    );
  };

  const closeFuseDnD = () => {
    setOpenFuseDnD(false);
    setFuseDnDSourceId("");
    setFuseDnDTargetId("");
    setFuseDnDBaseChoice("");
    setDragPalletId("");
    setDragPalletTipo("");
    setDragOverPalletId("");
  };

  const normalizeBase = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const lower = raw.toLowerCase();
    if (lower === "europeo") return "Europeo";
    if (lower === "americano") return "Americano";
    return raw;
  };

  const fuseDnDSource = useMemo(() => {
    const sid = String(fuseDnDSourceId || "");
    if (!sid) return null;
    return (
      palletDocs.find((p) => String(p?._id || p?.id || "") === sid) || null
    );
  }, [palletDocs, fuseDnDSourceId]);

  const fuseDnDTarget = useMemo(() => {
    const tid = String(fuseDnDTargetId || "");
    if (!tid) return null;
    return (
      palletDocs.find((p) => String(p?._id || p?.id || "") === tid) || null
    );
  }, [palletDocs, fuseDnDTargetId]);

  const submitFuseDnD = async () => {
    if (!canManagePallets) return;
    if (fuseSubmitting) return;
    const targetId = String(fuseDnDTargetId || "");
    const sourceId = String(fuseDnDSourceId || "");
    if (!targetId || !sourceId) {
      closeFuseDnD();
      return;
    }

    const baseCandidates = Array.from(
      new Set(
        [normalizeBase(fuseDnDSource?.base), normalizeBase(fuseDnDTarget?.base)]
          .map((v) => String(v || "").trim())
          .filter(Boolean)
      )
    );
    const needsBaseChoice = baseCandidates.length > 1;
    const effectiveBaseChoice = normalizeBase(fuseDnDBaseChoice);
    if (needsBaseChoice && !effectiveBaseChoice) {
      setSnack({
        open: true,
        message: `Elige base (${baseCandidates.join(" o ")}) para fusionar`,
        type: "error",
      });
      return;
    }

    try {
      setFuseSubmitting(true);
      await fusePallets({
        mode: "ids",
        targetPalletId: targetId,
        sourcePalletIds: [sourceId],
        baseChoice: needsBaseChoice ? effectiveBaseChoice : undefined,
        modificado_por: getCurrentUser()?.name || "Testing",
      });

      const [palletsList, loadsList] = await Promise.all([
        fetchAllPallets(),
        fetchAllLoads(),
      ]);
      setPalletDocs(palletsList);
      setRows(
        palletsList.map((p) => ({
          id: p._id || p.id,
          nombre: p.nombre,
          numero_palet: p.numero_palet,
          tipo: p.tipo,
          base: p.base || "",
        }))
      );
      const normalize = (x) => ({
        ...x,
        _id: x?._id || x?.id,
        id: x?.id || x?._id,
      });
      setLoads(Array.isArray(loadsList) ? loadsList.map(normalize) : []);
      setSnack({ open: true, message: "Palets fusionados", type: "success" });
      closeFuseDnD();
    } catch (e) {
      setSnack({
        open: true,
        message: String(e?.message || "Error fusionando palets"),
        type: "error",
      });
    } finally {
      setFuseSubmitting(false);
    }
  };

  const openCreateForLoad = (loadId) => {
    if (!canCreatePallets) {
      setSnack({
        open: true,
        message: "No tienes permiso para crear palets",
        type: "error",
      });
      return;
    }
    setForm({
      numero_palet: "",
      tipo: "Seco",
      base: "Europeo",
      carga: String(loadId || ""),
      productos: "",
    });
    setOpen(true);
  };

  const submit = async () => {
    try {
      if (!form.numero_palet || !form.tipo || !form.carga) {
        setSnack({
          open: true,
          message: "Número de palet, tipo y carga son obligatorios",
          type: "error",
        });
        return;
      }
      const load = loads.find((l) => String(l._id) === String(form.carga));
      const cargaNombre =
        load?.nombre || load?.barco?.nombre_del_barco || "Sin carga";
      const created = await createPallet({
        ...form,
        carga_nombre: cargaNombre,
        creado_por: getCurrentUser()?.name || "Testing",
      });
      setRows((prev) => [
        ...prev,
        {
          id: created._id || created.id,
          nombre: created.nombre,
          numero_palet: created.numero_palet,
          tipo: created.tipo,
          base: created.base || "",
        },
      ]);
      setPalletDocs((prev) => [...prev, created]);
      setOpen(false);

      setForm({
        numero_palet: "",
        tipo: "Seco",
        base: "Europeo",
        carga: "",
        productos: "",
      });
      setSnack({ open: true, message: "Palet creado", type: "success" });
    } catch (e) {
      const message =
        e?.message === "numero_palet es obligatorio"
          ? "El número de palet es obligatorio"
          : e?.message === "tipo es obligatorio"
          ? "El tipo es obligatorio"
          : e?.message === "carga es obligatoria"
          ? "La carga es obligatoria"
          : "Error creando palet";
      setSnack({
        open: true,
        message,
        type: "error",
      });
    }
  };

  const goDetail = (row) => {
    if (row.id) navigate(`/app/palets/${row.id}`);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        q === "" ||
        (r.nombre && r.nombre.toLowerCase().includes(q)) ||
        r.numero_palet.toLowerCase().includes(q) ||
        r.tipo.toLowerCase().includes(q)
    );
  }, [rows, query]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filtered.slice(start, end);
  }, [filtered, page, pageSize]);

  // derivados para el modo dual
  const loadsSorted = useMemo(() => {
    const withDate = loads.filter((l) => !!l.fecha_de_carga);
    return [...withDate].sort((a, b) => {
      const ad =
        combineDateTime(a.fecha_de_carga, a.hora_de_carga) ||
        new Date(8640000000000000);
      const bd =
        combineDateTime(b.fecha_de_carga, b.hora_de_carga) ||
        new Date(8640000000000000);
      return ad - bd;
    });
  }, [loads]);
  const loadsSortedPage = useMemo(() => {
    const start = (loadsListPage - 1) * loadsListPageSize;
    const end = start + loadsListPageSize;
    return loadsSorted.slice(start, end);
  }, [loadsSorted, loadsListPage, loadsListPageSize]);

  const palletsByLoadId = useMemo(() => {
    const palletById = new Map(
      palletDocs
        .map((p) => [String(p?._id || p?.id || ""), p])
        .filter((pair) => pair[0])
    );
    const byRelation = new Map();
    palletDocs.forEach((p) => {
      const loadId = String(p?.carga?._id || p?.carga || "");
      if (!loadId) return;
      const arr = byRelation.get(loadId) || [];
      arr.push(p);
      byRelation.set(loadId, arr);
    });
    const out = new Map();
    loads.forEach((l) => {
      const loadId = String(l?._id || l?.id || "");
      if (!loadId) return;
      const uniq = new Map();
      const rel = byRelation.get(loadId) || [];
      rel.forEach((p) => {
        const pid = String(p?._id || p?.id || "");
        if (pid) uniq.set(pid, p);
      });
      const ids = Array.isArray(l?.palets)
        ? l.palets
            .map((p) => String(p?._id || p?.id || p || ""))
            .filter(Boolean)
        : [];
      ids.forEach((pid) => {
        const found = palletById.get(pid);
        if (found) uniq.set(pid, found);
      });
      out.set(loadId, Array.from(uniq.values()));
    });
    return out;
  }, [palletDocs, loads]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          <input
            className="input"
            style={{ width: 280 }}
            placeholder="Buscar por número o tipo"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {canCreatePallets && (
            <button
              className="icon-button"
              onClick={onCreate}
              title="Crear palet"
            >
              <span className="material-symbols-outlined">add_box</span>
            </button>
          )}
          {canManageLoads && (
            <button
              className="icon-button"
              onClick={() => navigate("/app/logistica/cargas")}
              title="Crear carga"
            >
              <span className="material-symbols-outlined">add_business</span>
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="icon-button"
            title="Vista tabla"
            onClick={() => setView("table")}
          >
            <span className="material-symbols-outlined">table</span>
          </button>
          <button
            className="icon-button"
            title="Vista tarjetas"
            onClick={() => setView("cards")}
          >
            <span className="material-symbols-outlined">view_agenda</span>
          </button>
          <button
            className="icon-button"
            title="Vista dual"
            onClick={() => setView("dual")}
          >
            <span className="material-symbols-outlined">view_column</span>
          </button>
        </div>
      </div>

      {view === "table" ? (
        <DataTable
          title="Palets"
          columns={columns}
          data={paginated}
          loading={loading}
          createLabel={canCreatePallets ? "Crear palet" : undefined}
          onCreate={canCreatePallets ? onCreate : undefined}
          onRowClick={goDetail}
        />
      ) : view === "cards" ? (
        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Palets</h2>
            {canCreatePallets && (
              <button
                className="primary-button"
                onClick={onCreate}
                aria-label="Crear palet"
              >
                <span
                  className="material-symbols-outlined"
                  style={{ marginRight: 6 }}
                >
                  add
                </span>
                Crear palet
              </button>
            )}
          </div>
          <div className="card-grid">
            {loading ? (
              <div className="table-empty">
                <span
                  className="material-symbols-outlined"
                  style={{ verticalAlign: "middle", marginRight: 8 }}
                >
                  progress_activity
                </span>
                Cargando datos...
              </div>
            ) : paginated.length === 0 ? (
              <div className="table-empty">No hay registros todavía.</div>
            ) : (
              paginated.map((r) => {
                const pid = String(r?.id || "");
                const numero = String(r?.numero_palet || "").trim();
                const nombre = String(r?.nombre || "").trim();
                const tipo = String(r?.tipo || "").trim();
                const base = String(r?.base || "").trim();
                const isAmericano = base.trim().toLowerCase() === "americano";
                const colors = getTipoColors(tipo);
                const accent = isAmericano ? colors.strong : colors.color;
                const avatarText = (() => {
                  if (numero) return numero;
                  if (nombre && !nombre.includes(" - ")) return nombre;
                  if (nombre) return nombre.split(" - ")[0];
                  return "?";
                })();
                const title = (() => {
                  if (nombre) return nombre;
                  if (numero) return numero;
                  return "Palet";
                })();
                const subtitle = [tipo, base].filter(Boolean).join(" · ");
                return (
                  <div
                    key={pid || `${numero || nombre}`}
                    className="card-item"
                    style={{
                      cursor: "pointer",
                      borderLeft: `${isAmericano ? 10 : 6}px solid ${accent}`,
                      width: "fit-content",
                      minWidth: 210,
                      maxWidth: 320,
                    }}
                    onClick={() =>
                      pid ? navigate(`/app/palets/${pid}`) : null
                    }
                  >
                    <div className="card-item-header">
                      <div
                        className="avatar"
                        style={{
                          fontSize: String(avatarText).length > 3 ? 12 : 16,
                          padding: 4,
                          textAlign: "center",
                          lineHeight: "14px",
                        }}
                      >
                        {avatarText}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div
                          className="card-item-title"
                          style={{ fontSize: 16, lineHeight: "20px" }}
                        >
                          {title}
                        </div>
                        <div className="card-item-sub">{subtitle || " "}</div>
                      </div>
                    </div>
                    <div className="card-item-meta">
                      {tipo && <span className="chip">{tipo}</span>}
                      {base && <span className="chip">{base}</span>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      ) : (
        <section style={{ display: "grid", gap: 16 }}>
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Cargas por fecha</h2>
            </div>
            <div style={{ padding: 12 }}>
              {loadsLoading ? (
                <div style={{ color: "var(--text-secondary)" }}>
                  <span
                    className="material-symbols-outlined"
                    style={{ verticalAlign: "middle", marginRight: 6 }}
                  >
                    progress_activity
                  </span>
                  Cargando...
                </div>
              ) : loadsSorted.length === 0 ? (
                <div style={{ color: "var(--text-secondary)" }}>
                  Sin cargas con fecha
                </div>
              ) : (
                loadsSortedPage.map((l) =>
                  (() => {
                    const loadId = String(l?._id || l?.id || "");
                    const expanded = expandedLoadId === loadId;
                    const palletsInLoad = palletsByLoadId.get(loadId) || [];
                    const palletNumbers = palletsInLoad
                      .map((p) => String(p?.numero_palet || "").trim())
                      .filter(Boolean);
                    return (
                      <div key={loadId} style={{ marginBottom: 8 }}>
                        <div
                          className="calendar-item"
                          style={{
                            padding: "10px 12px",
                            minHeight: 56,
                            cursor: "pointer",
                            background: "#f8fafc",
                            border: "1px solid var(--border)",
                            borderLeft: "4px solid #6b7280",
                            borderRadius: expanded ? "10px 10px 0 0" : 10,
                            display: "flex",
                            alignItems: "center",
                          }}
                          onClick={() =>
                            setExpandedLoadId((cur) =>
                              String(cur || "") === loadId ? null : loadId
                            )
                          }
                        >
                          <div
                            style={{
                              display: "flex",
                              gap: 12,
                              width: "100%",
                              alignItems: "center",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "center",
                                flex: 1,
                                minWidth: 0,
                              }}
                            >
                              <div style={{ fontSize: 18, lineHeight: "22px" }}>
                                <strong>
                                  {l.nombre ||
                                    l.barco?.nombre_del_barco ||
                                    "Sin barco"}
                                </strong>
                              </div>
                              <div style={{ color: "var(--text-secondary)" }}>
                                {formatDateLabel(l.fecha_de_carga)}
                                {l.hora_de_carga ? `, ${l.hora_de_carga}` : ""}
                              </div>
                              {palletNumbers.length > 0 && (
                                <div
                                  style={{
                                    marginTop: 4,
                                    color: "var(--text-secondary)",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                  title={palletNumbers.join(", ")}
                                >
                                  Palets: {palletNumbers.join(", ")}
                                </div>
                              )}
                            </div>
                            <button
                              className="icon-button"
                              title="Abrir carga"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/app/logistica/cargas/${loadId}`);
                              }}
                            >
                              <span className="material-symbols-outlined">
                                open_in_new
                              </span>
                            </button>
                            <span
                              className="material-symbols-outlined"
                              style={{
                                transition: "transform 150ms ease",
                                transform: expanded
                                  ? "rotate(180deg)"
                                  : "rotate(0deg)",
                                color: "var(--text-secondary)",
                              }}
                            >
                              expand_more
                            </span>
                          </div>
                        </div>

                        {expanded && (
                          <div
                            style={{
                              padding: "10px 12px 0 12px",
                              background: "#fff",
                              border: "1px solid var(--border)",
                              borderTop: "none",
                              borderRadius: "0 0 10px 10px",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 12,
                                paddingBottom: 12,
                                alignItems: "flex-start",
                              }}
                            >
                              {palletsInLoad.map((p) => {
                                const pid = String(p?._id || p?.id || "");
                                const idStr = pid;
                                const isDragging = !!dragPalletId;
                                const isSource =
                                  isDragging &&
                                  idStr &&
                                  String(idStr) === String(dragPalletId);
                                const isDroppable =
                                  isDragging && canDnDFuseTo(p);
                                const isDisabled =
                                  isDragging && !isSource && !isDroppable;
                                const isOver =
                                  isDroppable &&
                                  idStr &&
                                  String(idStr) === String(dragOverPalletId);
                                const numero = String(
                                  p?.numero_palet || ""
                                ).trim();
                                const nombre = String(p?.nombre || "").trim();
                                const tipo = String(p?.tipo || "").trim();
                                const base = String(p?.base || "").trim();
                                const isAmericano =
                                  base.trim().toLowerCase() === "americano";
                                const colors = getTipoColors(tipo);
                                const accent = isAmericano
                                  ? colors.strong
                                  : colors.color;
                                const avatarText = (() => {
                                  if (nombre && !nombre.includes(" - "))
                                    return nombre;
                                  if (numero) return numero;
                                  if (nombre) return nombre.split(" - ")[0];
                                  return "?";
                                })();
                                const cargaTitle = String(
                                  l?.nombre ||
                                    l?.barco?.nombre_del_barco ||
                                    p?.carga_nombre ||
                                    "Sin carga"
                                ).trim();
                                const title = cargaTitle || "Sin carga";
                                const subtitle = [tipo, base]
                                  .filter(Boolean)
                                  .join(" · ");
                                return (
                                  <div
                                    key={pid || `${loadId}-${numero || nombre}`}
                                    className="card-item"
                                    draggable={canManagePallets}
                                    style={{
                                      cursor: isDragging
                                        ? isSource
                                          ? "grabbing"
                                          : isDroppable
                                          ? "copy"
                                          : "not-allowed"
                                        : "pointer",
                                      borderLeft: `${
                                        isAmericano ? 10 : 6
                                      }px solid ${accent}`,
                                      width: "fit-content",
                                      minWidth: 210,
                                      maxWidth: 320,
                                      opacity: isDisabled ? 0.45 : 1,
                                      filter: isDisabled
                                        ? "grayscale(1)"
                                        : "none",
                                      background: isOver
                                        ? "var(--hover)"
                                        : undefined,
                                    }}
                                    onDragStart={(e) => {
                                      if (!canManagePallets) return;
                                      if (!idStr) return;
                                      e.dataTransfer.effectAllowed = "copy";
                                      setDragPalletId(String(idStr));
                                      setDragPalletTipo(String(tipo || ""));
                                      setDragOverPalletId("");
                                    }}
                                    onDragEnd={() => {
                                      setDragPalletId("");
                                      setDragPalletTipo("");
                                      setDragOverPalletId("");
                                    }}
                                    onDragOver={(e) => {
                                      if (!canManagePallets) return;
                                      if (!canDnDFuseTo(p)) return;
                                      e.preventDefault();
                                      e.dataTransfer.dropEffect = "copy";
                                      if (dragOverPalletId !== idStr)
                                        setDragOverPalletId(idStr);
                                    }}
                                    onDrop={(e) => {
                                      if (!canManagePallets) return;
                                      if (!canDnDFuseTo(p)) return;
                                      e.preventDefault();
                                      setFuseDnDSourceId(String(dragPalletId));
                                      setFuseDnDTargetId(String(idStr));
                                      setFuseDnDBaseChoice(
                                        String(base || "").trim()
                                      );
                                      setOpenFuseDnD(true);
                                      setDragPalletId("");
                                      setDragPalletTipo("");
                                      setDragOverPalletId("");
                                    }}
                                    onClick={() =>
                                      dragPalletId
                                        ? undefined
                                        : navigate(`/app/palets/${pid}`)
                                    }
                                  >
                                    <div className="card-item-header">
                                      <div
                                        className="avatar"
                                        style={{
                                          fontSize:
                                            String(avatarText).length > 3
                                              ? 12
                                              : 16,
                                          padding: 4,
                                          textAlign: "center",
                                          lineHeight: "14px",
                                        }}
                                      >
                                        {avatarText}
                                      </div>
                                      <div style={{ minWidth: 0 }}>
                                        <div
                                          className="card-item-title"
                                          style={{
                                            fontSize: 16,
                                            lineHeight: "20px",
                                          }}
                                        >
                                          {title}
                                        </div>
                                        <div className="card-item-sub">
                                          {subtitle || " "}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="card-item-meta">
                                      {tipo && (
                                        <span className="chip">{tipo}</span>
                                      )}
                                      {base && (
                                        <span className="chip">{base}</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}

                              <div
                                className="card-item"
                                style={{
                                  cursor: "pointer",
                                  width: "fit-content",
                                  minWidth: 210,
                                  maxWidth: 320,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  border: "2px dashed var(--border)",
                                  background: "#fff",
                                }}
                                onClick={() => openCreateForLoad(loadId)}
                                title="Crear palet"
                              >
                                <span
                                  className="material-symbols-outlined"
                                  style={{
                                    fontSize: 32,
                                    color: "var(--text-secondary)",
                                  }}
                                >
                                  add
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()
                )
              )}
              <Pagination
                page={loadsListPage}
                pageSize={loadsListPageSize}
                total={loadsSorted.length}
                onPageChange={(p) => setLoadsListPage(Math.max(1, p))}
                onPageSizeChange={(s) => {
                  setLoadsListPageSize(s);
                  setLoadsListPage(1);
                }}
              />
            </div>
          </div>
        </section>
      )}

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
        open={openFuseDnD}
        title="Fusionar palets"
        onClose={closeFuseDnD}
        onSubmit={submitFuseDnD}
        submitLabel="Fusionar"
        width={520}
        bodyStyle={{ gridTemplateColumns: "1fr" }}
      >
        <div style={{ fontSize: 16 }}>
          ¿Desea fusionar los palets {fuseDnDSource?.numero_palet || "-"} y{" "}
          {fuseDnDTarget?.numero_palet || "-"}?
        </div>
        {(() => {
          const baseCandidates = Array.from(
            new Set(
              [
                normalizeBase(fuseDnDSource?.base),
                normalizeBase(fuseDnDTarget?.base),
              ]
                .map((v) => String(v || "").trim())
                .filter(Boolean)
            )
          );
          if (baseCandidates.length <= 1) return null;
          const value =
            normalizeBase(fuseDnDBaseChoice) ||
            normalizeBase(fuseDnDTarget?.base) ||
            baseCandidates[0] ||
            "";
          return (
            <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
              <div className="label">Base final</div>
              <select
                className="select"
                value={value}
                onChange={(e) => setFuseDnDBaseChoice(e.target.value)}
              >
                {baseCandidates.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          );
        })()}
      </Modal>

      <Modal
        open={open}
        title="Crear palet"
        onClose={() => setOpen(false)}
        onSubmit={submit}
        submitLabel="Crear"
      >
        <div>
          <div className="label">Número de palet</div>
          <input
            className="input"
            value={form.numero_palet}
            onChange={(e) => setForm({ ...form, numero_palet: e.target.value })}
            placeholder="Nº de palet"
          />
        </div>
        <div>
          <div className="label">Tipo</div>
          <select
            className="select"
            value={form.tipo}
            onChange={(e) => setForm({ ...form, tipo: e.target.value })}
          >
            {TIPO_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
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
          <div className="label">Carga asociada</div>
          <select
            className="select"
            value={form.carga || ""}
            onChange={(e) => setForm({ ...form, carga: e.target.value })}
          >
            <option value="">Selecciona carga</option>
            {loadsSorted.map((l) => (
              <option key={l._id} value={l._id}>
                {l.nombre || l.barco?.nombre_del_barco || "Sin barco"} ·{" "}
                {formatDateLabel(l.fecha_de_carga)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="label">Productos</div>
          <textarea
            className="input"
            rows="4"
            value={form.productos}
            onChange={(e) => setForm({ ...form, productos: e.target.value })}
          />
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
