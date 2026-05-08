import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import DataTable from "../components/DataTable.jsx";
import Modal from "../components/Modal.jsx";
import Snackbar from "../components/Snackbar.jsx";
import Pagination from "../components/Pagination.jsx";
import NumericPad from "../components/NumericPad.jsx";
import PalletFuseModal from "../components/PalletFuseModal.jsx";
import PalletDuplicateModal from "../components/PalletDuplicateModal.jsx";
import LoadStartConfirmModal from "../components/LoadStartConfirmModal.jsx";
import ProductsPicker from "../components/ProductsPicker.jsx";
import FormField from "../components/FormField.jsx";
import {
  combineDateTime,
  formatDateLabel,
  getTipoColors,
  getTipoLabel,
  normalizePalletBase,
  normalizePalletNumber,
} from "../utils/pallets.js";
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
  fetchAllProductos,
  fusePallets,
  updateLoadById,
} from "../firebase/auth.js";

const TIPO_OPTIONS = [
  { label: "Seco", value: "Seco" },
  { label: "Refrigerado", value: "Refrigerado" },
  { label: "Congelado", value: "Congelado" },
  { label: "Técnico", value: "Técnico" },
  { label: "Fruta y verdura", value: "Fruta y verdura" },
  { label: "Repuestos", value: "Repuestos" },
];

export default function Pallets({
  title = "Palets",
  restrictLoadEstado = "Preparando",
} = {}) {
  const columns = [
    { key: "nombre", header: "Nombre" },
    { key: "numero_palet", header: "Número de palet" },
    { key: "tipo", header: "Tipo" },
    { key: "base", header: "Base" },
  ];

  const navigate = useNavigate();
  const [view, _setView] = useState("dual");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [numeroPadOpen, setNumeroPadOpen] = useState(false);
  const numeroPadRootRef = useRef(null);
  const [duplicatePalletOpen, setDuplicatePalletOpen] = useState(false);
  const [duplicatePalletNumero, setDuplicatePalletNumero] = useState("");
  const [expandedLoadId, setExpandedLoadId] = useState(null);
  const [dragPalletId, setDragPalletId] = useState("");
  const [dragPalletTipo, setDragPalletTipo] = useState("");
  const [dragOverPalletId, setDragOverPalletId] = useState("");
  const [openFuseDnD, setOpenFuseDnD] = useState(false);
  const [fuseDnDSourceId, setFuseDnDSourceId] = useState("");
  const [fuseDnDTargetId, setFuseDnDTargetId] = useState("");
  const [fuseDnDBaseChoice, setFuseDnDBaseChoice] = useState("");
  const [fuseSubmitting, setFuseSubmitting] = useState(false);
  const [loadEstadoSubmitting, setLoadEstadoSubmitting] = useState(false);
  const [loadEstadoIdSubmitting, setLoadEstadoIdSubmitting] = useState("");
  const [openLoadStartConfirm, setOpenLoadStartConfirm] = useState(false);
  const [loadStartConfirmId, setLoadStartConfirmId] = useState("");
  const lastTapRef = useRef({ id: "", at: 0 });
  const isTouchMode = useMemo(() => {
    try {
      const coarse =
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(pointer: coarse)").matches;
      const noHover =
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(hover: none)").matches;
      const touchPoints =
        typeof navigator !== "undefined" &&
        Number(navigator.maxTouchPoints) > 0;
      return (
        (coarse && noHover) ||
        (touchPoints && noHover) ||
        (coarse && touchPoints)
      );
    } catch {
      return false;
    }
  }, []);

  const [form, setForm] = useState({
    numero_palet: "",
    tipo: "Seco",
    base: "Europeo",
    carga: "",
    productos: "",
  });
  const [productosCatalogo, setProductosCatalogo] = useState([]);
  const [productosItems, setProductosItems] = useState([]);
  const [productosPickerKey, setProductosPickerKey] = useState(0);

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
        const visible = Array.isArray(list) ? list : [];
        setPalletDocs(visible);
        const mapped = visible.map((p) => ({
          id: p._id || p.id,
          nombre: p.nombre,
          numero_palet: p.numero_palet,
          tipo: p.tipo,
          base: p.base || "",
          creado_por: p.creado_por || "",
          carga_id: String(p?.carga?._id || p?.carga || ""),
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
    setForm({
      numero_palet: "",
      tipo: "Seco",
      base: "Europeo",
      carga: "",
      productos: "",
    });
    setProductosItems([]);
    setProductosPickerKey((v) => v + 1);
    setOpen(true);
  };

  useEffect(() => {
    if (!numeroPadOpen) return;
    const onPointerDown = (e) => {
      const root = numeroPadRootRef.current;
      if (!root) return;
      if (root.contains(e.target)) return;
      setNumeroPadOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [numeroPadOpen]);

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
  const clearDnDState = () => {
    setDragPalletId("");
    setDragPalletTipo("");
    setDragOverPalletId("");
  };
  const isDoubleTap = (id) => {
    const now = Date.now();
    const prev = lastTapRef.current || { id: "", at: 0 };
    lastTapRef.current = { id, at: now };
    return (
      String(prev.id || "") === String(id || "") &&
      now - Number(prev.at || 0) < 320
    );
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
        [
          normalizePalletBase(fuseDnDSource?.base),
          normalizePalletBase(fuseDnDTarget?.base),
        ]
          .map((v) => String(v || "").trim())
          .filter(Boolean),
      ),
    );
    const needsBaseChoice = baseCandidates.length > 1;
    const effectiveBaseChoice = normalizePalletBase(fuseDnDBaseChoice);
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
      const visible = Array.isArray(palletsList) ? palletsList : [];
      setPalletDocs(visible);
      setRows(
        visible.map((p) => ({
          id: p._id || p.id,
          nombre: p.nombre,
          numero_palet: p.numero_palet,
          tipo: p.tipo,
          base: p.base || "",
          carga_id: String(p?.carga?._id || p?.carga || ""),
        })),
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

  const setLoadEstado = async ({ loadId, estado }) => {
    const id = String(loadId || "");
    if (!id) return false;
    if (!canManageLoads) {
      setSnack({
        open: true,
        message: "No tienes permiso para modificar cargas",
        type: "error",
      });
      return false;
    }
    if (loadEstadoSubmitting) return false;
    try {
      setLoadEstadoSubmitting(true);
      setLoadEstadoIdSubmitting(id);
      const updated = await updateLoadById(id, {
        estado_viaje: String(estado || "").trim(),
        modificado_por: getCurrentUser()?.name || "Testing",
      });
      if (updated) {
        setLoads((prev) =>
          prev.map((l) =>
            String(l?._id || l?.id || "") === id
              ? { ...l, ...updated, _id: updated._id || updated.id }
              : l,
          ),
        );
        setSnack({
          open: true,
          message: "Carga actualizada",
          type: "success",
        });
        return true;
      } else {
        setSnack({
          open: true,
          message: "No se pudo actualizar la carga",
          type: "error",
        });
        return false;
      }
    } catch (e) {
      setSnack({
        open: true,
        message: String(e?.message || "Error actualizando carga"),
        type: "error",
      });
      return false;
    } finally {
      setLoadEstadoSubmitting(false);
      setLoadEstadoIdSubmitting("");
    }
  };

  const openStartLoadConfirm = (loadId) => {
    const id = String(loadId || "");
    if (!id) return;
    setLoadStartConfirmId(id);
    setOpenLoadStartConfirm(true);
  };
  const closeStartLoadConfirm = () => {
    setOpenLoadStartConfirm(false);
    setLoadStartConfirmId("");
  };
  const confirmStartLoad = async () => {
    const id = String(loadStartConfirmId || "");
    if (!id) return;
    const ok = await setLoadEstado({ loadId: id, estado: "Cargando" });
    if (!ok) return;
    closeStartLoadConfirm();
    navigate("/app/logistica/carga-palets");
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
    setProductosItems([]);
    setProductosPickerKey((v) => v + 1);
    setOpen(true);
  };

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
      const nextNumero = String(form.numero_palet || "").trim();
      const normalizedNext = normalizePalletNumber(nextNumero);
      const cargaId = String(form.carga || "").trim();
      const hasDuplicate = palletDocs.some((p) => {
        const pCarga = String(p?.carga?._id || p?.carga || "").trim();
        if (!pCarga || pCarga !== cargaId) return false;
        const pNumero = String(p?.numero_palet || "").trim();
        return normalizePalletNumber(pNumero) === normalizedNext;
      });
      if (hasDuplicate) {
        setDuplicatePalletNumero(nextNumero);
        setDuplicatePalletOpen(true);
        return;
      }
      const load = loads.find((l) => String(l._id) === String(form.carga));
      const cargaNombre =
        load?.nombre || load?.barco?.nombre_del_barco || "Sin carga";
      const productosText = buildProductosText(productosItems);
      const created = await createPallet({
        ...form,
        carga_nombre: cargaNombre,
        productos: productosText,
        productos_items: productosItems,
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
          carga_id: String(created?.carga?._id || created?.carga || form.carga),
        },
      ]);
      setPalletDocs((prev) => [...prev, created]);
      setOpen(false);
      setNumeroPadOpen(false);

      setForm({
        numero_palet: "",
        tipo: "Seco",
        base: "Europeo",
        carga: "",
        productos: "",
      });
      setProductosItems([]);
      setProductosPickerKey((v) => v + 1);
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

  const normalizeEstado = (value) =>
    String(value || "")
      .trim()
      .toLowerCase();
  const restrictEstadoKey = normalizeEstado(restrictLoadEstado);
  const visibleLoads = useMemo(() => {
    if (!restrictEstadoKey) return loads;
    return loads.filter(
      (l) => normalizeEstado(l?.estado_viaje) === restrictEstadoKey,
    );
  }, [loads, restrictEstadoKey]);
  const visibleLoadIds = useMemo(() => {
    if (!restrictEstadoKey) return null;
    const set = new Set();
    visibleLoads.forEach((l) => {
      const id = String(l?._id || l?.id || "");
      if (id) set.add(id);
    });
    return set;
  }, [visibleLoads, restrictEstadoKey]);
  const effectiveLoading = loading || (!!restrictEstadoKey && loadsLoading);

  const scopedRows = useMemo(() => {
    if (!restrictEstadoKey) return rows;
    const set = visibleLoadIds;
    if (!set) return [];
    return rows.filter((r) => set.has(String(r?.carga_id || "")));
  }, [rows, restrictEstadoKey, visibleLoadIds]);

  const dualFilteredLoads = useMemo(() => {
    if (view !== "dual") return visibleLoads;
    const q = query.trim().toLowerCase();
    if (!q) return visibleLoads;
    return visibleLoads.filter((l) => {
      const nombre = String(l?.nombre || "").toLowerCase();
      const fecha = String(
        formatDateLabel(l?.fecha_de_carga) || "",
      ).toLowerCase();
      const hora = String(l?.hora_de_carga || "").toLowerCase();
      const estado = String(l?.estado_viaje || "").toLowerCase();
      return (
        nombre.includes(q) ||
        fecha.includes(q) ||
        hora.includes(q) ||
        estado.includes(q)
      );
    });
  }, [visibleLoads, query, view]);

  const filtered = useMemo(() => {
    if (view === "dual") return scopedRows;
    const q = query.trim().toLowerCase();
    return scopedRows.filter(
      (r) =>
        q === "" ||
        (r.nombre && r.nombre.toLowerCase().includes(q)) ||
        r.numero_palet.toLowerCase().includes(q) ||
        r.tipo.toLowerCase().includes(q),
    );
  }, [scopedRows, query, view]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filtered.slice(start, end);
  }, [filtered, page, pageSize]);

  // derivados para el modo dual
  const loadsSorted = useMemo(() => {
    const withDate = dualFilteredLoads.filter((l) => !!l.fecha_de_carga);
    return [...withDate].sort((a, b) => {
      const ad =
        combineDateTime(a.fecha_de_carga, a.hora_de_carga) ||
        new Date(8640000000000000);
      const bd =
        combineDateTime(b.fecha_de_carga, b.hora_de_carga) ||
        new Date(8640000000000000);
      return ad - bd;
    });
  }, [dualFilteredLoads]);
  const loadsSortedPage = useMemo(() => {
    const start = (loadsListPage - 1) * loadsListPageSize;
    const end = start + loadsListPageSize;
    return loadsSorted.slice(start, end);
  }, [loadsSorted, loadsListPage, loadsListPageSize]);

  const palletsByLoadId = useMemo(() => {
    const palletById = new Map(
      palletDocs
        .map((p) => [String(p?._id || p?.id || ""), p])
        .filter((pair) => pair[0]),
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
    visibleLoads.forEach((l) => {
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
  }, [palletDocs, visibleLoads]);

  useEffect(() => {
    if (view === "dual") setLoadsListPage(1);
    else setPage(1);
  }, [query, view]);

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
            placeholder={
              view === "dual"
                ? "Buscar carga por nombre, fecha o estado"
                : "Buscar por número o tipo"
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {view === "table" ? (
        <DataTable
          title={title}
          columns={columns}
          data={paginated}
          loading={effectiveLoading}
          createLabel={canCreatePallets ? "Crear palet" : undefined}
          onCreate={canCreatePallets ? onCreate : undefined}
          onRowClick={goDetail}
        />
      ) : view === "cards" ? (
        <section className="card">
          <div className="card-header">
            <h2 className="card-title">{title}</h2>
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
                const cargaNombre = (() => {
                  const direct = String(r?.carga_nombre || "").trim();
                  if (direct) return direct;
                  const raw = String(nombre || "").trim();
                  if (!raw) return "";
                  if (!raw.includes(" - ")) return "";
                  return raw.split(" - ").slice(1).join(" - ").trim();
                })();
                const creadoPor = String(r?.creado_por || "").trim();
                const avatarText = numero || "?";
                const baseKey = base.trim().toLowerCase();
                const tipoLetter = getTipoLabel(tipo);
                const baseLetter =
                  baseKey === "europeo"
                    ? "E"
                    : baseKey === "americano"
                      ? "A"
                      : baseKey
                        ? baseKey[0].toUpperCase()
                        : "";
                const title =
                  tipoLetter && baseLetter
                    ? `${tipoLetter} · ${baseLetter}`
                    : tipoLetter
                      ? tipoLetter
                      : numero || "Palet";
                const subtitle = "";
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
                    title={cargaNombre || ""}
                    onClick={() =>
                      pid ? navigate(`/app/palets/${pid}`) : null
                    }
                  >
                    <div className="card-item-header">
                      <div
                        className="avatar"
                        style={{
                          width: 48,
                          height: 48,
                          fontSize: String(avatarText).length > 3 ? 16 : 20,
                          padding: 0,
                          textAlign: "center",
                          lineHeight: 1,
                        }}
                      >
                        {avatarText}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div
                          className="card-item-title"
                          style={{ fontSize: 20, lineHeight: "22px" }}
                        >
                          {title}
                        </div>
                        <div className="card-item-sub">{subtitle || " "}</div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--text-secondary)",
                            marginTop: 2,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                          title={creadoPor || ""}
                        >
                          {creadoPor ? `Creado por: ${creadoPor}` : " "}
                        </div>
                      </div>
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
                              String(cur || "") === loadId ? null : loadId,
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
                            {canManageLoads && (
                              <button
                                className="secondary-button"
                                type="button"
                                disabled={
                                  String(l?.estado_viaje || "").trim() ===
                                    "Cargando" ||
                                  (loadEstadoSubmitting &&
                                    String(loadEstadoIdSubmitting) === loadId)
                                }
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openStartLoadConfirm(loadId);
                                }}
                                style={{ height: 34, padding: "0 10px" }}
                              >
                                Cargar
                              </button>
                            )}
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
                              onClick={(e) => {
                                if (!isTouchMode) return;
                                if (!dragPalletId) return;
                                const t = e.target;
                                if (
                                  t &&
                                  typeof t.closest === "function" &&
                                  t.closest(".card-item")
                                )
                                  return;
                                clearDnDState();
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
                                  p?.numero_palet || "",
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
                                const cargaTitle = String(
                                  l?.nombre ||
                                    l?.barco?.nombre_del_barco ||
                                    p?.carga_nombre ||
                                    "Sin carga",
                                ).trim();
                                const creadoPor = String(
                                  p?.creado_por || "",
                                ).trim();
                                const subtitle = "";
                                const avatarText = numero || "?";
                                const baseKey = base.trim().toLowerCase();
                                const tipoLetter = getTipoLabel(tipo);
                                const baseLetter =
                                  baseKey === "europeo"
                                    ? "E"
                                    : baseKey === "americano"
                                      ? "A"
                                      : baseKey
                                        ? baseKey[0].toUpperCase()
                                        : "";
                                const title =
                                  tipoLetter && baseLetter
                                    ? `${tipoLetter} · ${baseLetter}`
                                    : tipoLetter
                                      ? tipoLetter
                                      : numero || "Palet";
                                return (
                                  <div
                                    key={pid || `${loadId}-${numero || nombre}`}
                                    className="card-item"
                                    draggable={!isTouchMode && canManagePallets}
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
                                    title={cargaTitle || ""}
                                    onDragStart={(e) => {
                                      if (isTouchMode) return;
                                      if (!canManagePallets) return;
                                      if (!idStr) return;
                                      e.dataTransfer.effectAllowed = "copy";
                                      try {
                                        e.dataTransfer.setData(
                                          "text/plain",
                                          String(idStr),
                                        );
                                      } catch {
                                        void 0;
                                      }
                                      setDragPalletId(String(idStr));
                                      setDragPalletTipo(String(tipo || ""));
                                      setDragOverPalletId("");
                                    }}
                                    onDragEnd={() => {
                                      if (isTouchMode) return;
                                      setDragPalletId("");
                                      setDragPalletTipo("");
                                      setDragOverPalletId("");
                                    }}
                                    onDragOver={(e) => {
                                      if (isTouchMode) return;
                                      if (!canManagePallets) return;
                                      if (!canDnDFuseTo(p)) return;
                                      e.preventDefault();
                                      e.dataTransfer.dropEffect = "copy";
                                      if (dragOverPalletId !== idStr)
                                        setDragOverPalletId(idStr);
                                    }}
                                    onDrop={(e) => {
                                      if (isTouchMode) return;
                                      if (!canManagePallets) return;
                                      if (!canDnDFuseTo(p)) return;
                                      e.preventDefault();
                                      setFuseDnDSourceId(String(dragPalletId));
                                      setFuseDnDTargetId(String(idStr));
                                      setFuseDnDBaseChoice(
                                        String(base || "").trim(),
                                      );
                                      setOpenFuseDnD(true);
                                      setDragPalletId("");
                                      setDragPalletTipo("");
                                      setDragOverPalletId("");
                                    }}
                                    onClick={(e) => {
                                      if (!idStr) return;
                                      if (isTouchMode) {
                                        e.stopPropagation();
                                        if (isDoubleTap(idStr)) {
                                          clearDnDState();
                                          navigate(`/app/palets/${pid}`);
                                          return;
                                        }
                                        if (!canManagePallets) return;
                                        if (!dragPalletId) {
                                          setDragPalletId(String(idStr));
                                          setDragPalletTipo(String(tipo || ""));
                                          setDragOverPalletId("");
                                          return;
                                        }
                                        if (
                                          String(idStr) === String(dragPalletId)
                                        ) {
                                          clearDnDState();
                                          return;
                                        }
                                        if (!canDnDFuseTo(p)) {
                                          setSnack({
                                            open: true,
                                            message:
                                              "Solo puedes fusionar palets del mismo tipo",
                                            type: "error",
                                          });
                                          return;
                                        }
                                        setFuseDnDSourceId(
                                          String(dragPalletId),
                                        );
                                        setFuseDnDTargetId(String(idStr));
                                        setFuseDnDBaseChoice(
                                          String(base || "").trim(),
                                        );
                                        setOpenFuseDnD(true);
                                        clearDnDState();
                                        return;
                                      }
                                      if (dragPalletId) return;
                                      navigate(`/app/palets/${pid}`);
                                    }}
                                  >
                                    <div className="card-item-header">
                                      <div
                                        className="avatar"
                                        style={{
                                          fontSize:
                                            String(avatarText).length > 3
                                              ? 16
                                              : 20,
                                          width: 48,
                                          height: 48,
                                          padding: 0,
                                          textAlign: "center",
                                          lineHeight: 1,
                                        }}
                                      >
                                        {avatarText}
                                      </div>
                                      <div style={{ minWidth: 0 }}>
                                        <div
                                          className="card-item-title"
                                          style={{
                                            fontSize: 20,
                                            lineHeight: "22px",
                                          }}
                                        >
                                          {title}
                                        </div>
                                        <div className="card-item-sub">
                                          {subtitle || " "}
                                        </div>
                                        <div
                                          style={{
                                            fontSize: 12,
                                            color: "var(--text-secondary)",
                                            marginTop: 2,
                                            whiteSpace: "nowrap",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                          }}
                                          title={creadoPor || ""}
                                        >
                                          {creadoPor
                                            ? `Creado por: ${creadoPor}`
                                            : " "}
                                        </div>
                                      </div>
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
                  })(),
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

      {view !== "dual" && (
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
      )}

      {(() => {
        const baseCandidates = Array.from(
          new Set(
            [
              normalizePalletBase(fuseDnDSource?.base),
              normalizePalletBase(fuseDnDTarget?.base),
            ]
              .map((v) => String(v || "").trim())
              .filter(Boolean),
          ),
        );
        const value =
          normalizePalletBase(fuseDnDBaseChoice) ||
          normalizePalletBase(fuseDnDTarget?.base) ||
          baseCandidates[0] ||
          "";
        return (
          <PalletFuseModal
            open={openFuseDnD}
            sourceNumero={fuseDnDSource?.numero_palet || "-"}
            targetNumero={fuseDnDTarget?.numero_palet || "-"}
            baseCandidates={baseCandidates}
            baseValue={value}
            onBaseChange={(v) => setFuseDnDBaseChoice(v)}
            onClose={closeFuseDnD}
            onSubmit={submitFuseDnD}
          />
        );
      })()}

      <Modal
        open={open}
        title="Crear palet"
        onClose={() => {
          setOpen(false);
          setNumeroPadOpen(false);
        }}
        onSubmit={submit}
        submitLabel="Crear"
      >
        <FormField label="Número de palet">
          <div
            ref={numeroPadRootRef}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <input
              className="input"
              value={form.numero_palet}
              inputMode="numeric"
              pattern="[0-9]*"
              onFocus={() => {
                if (isTouchMode) setNumeroPadOpen(true);
              }}
              onClick={() => {
                if (isTouchMode) setNumeroPadOpen(true);
              }}
              onChange={(e) =>
                setForm({ ...form, numero_palet: e.target.value })
              }
              placeholder="Nº de palet"
              style={{ flex: "1 1 180px", minWidth: 180 }}
            />
            {isTouchMode && numeroPadOpen && (
              <NumericPad
                onDigit={(d) =>
                  setForm((p) => ({
                    ...p,
                    numero_palet: `${String(p.numero_palet || "")}${d}`,
                  }))
                }
                onDelete={() =>
                  setForm((p) => ({
                    ...p,
                    numero_palet: String(p.numero_palet || "").slice(0, -1),
                  }))
                }
                onAccept={() => setNumeroPadOpen(false)}
              />
            )}
          </div>
        </FormField>
        <FormField label="Tipo">
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
        </FormField>
        <FormField label="Base">
          <select
            className="select"
            value={form.base || "Europeo"}
            onChange={(e) => setForm({ ...form, base: e.target.value })}
          >
            <option value="Europeo">Europeo</option>
            <option value="Americano">Americano</option>
          </select>
        </FormField>
        <FormField label="Carga asociada">
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
        </FormField>
        <ProductsPicker
          key={productosPickerKey}
          catalog={productosCatalogo}
          items={productosItems}
          onChangeItems={setProductosItems}
          onError={(message) => {
            setSnack({
              open: true,
              message: String(message || ""),
              type: "error",
            });
          }}
        />
      </Modal>

      <PalletDuplicateModal
        open={duplicatePalletOpen}
        numero={duplicatePalletNumero}
        onAccept={() => {
          setDuplicatePalletOpen(false);
          setDuplicatePalletNumero("");
        }}
      />

      <LoadStartConfirmModal
        open={openLoadStartConfirm}
        onClose={closeStartLoadConfirm}
        onConfirm={confirmStartLoad}
      />

      <Snackbar
        open={snack.open}
        message={snack.message}
        type={snack.type}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
      />
    </>
  );
}
