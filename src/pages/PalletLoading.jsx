import { useEffect, useMemo, useState } from "react";
import * as ReactRouterDom from "react-router-dom";
import Pagination from "../components/Pagination.jsx";
import Snackbar from "../components/Snackbar.jsx";
import FormField from "../components/FormField.jsx";
import LoadDivisionModal from "../components/LoadDivisionModal.jsx";
import {
  fetchAllLoads,
  fetchAllPallets,
  fetchAllUsers,
  fetchAllConsignees,
  fetchAllResponsables,
  updateLoadById,
  updatePalletById,
  createLoadReport,
} from "../firebase/auth.js";
import {
  getCurrentRole,
  getCurrentUser,
  hasPermission,
  PERMISSIONS,
} from "../utils/roles.js";
import Modal from "../components/Modal.jsx";

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

export default function PalletLoading() {
  const navigate = ReactRouterDom.useNavigate();
  const [loading, setLoading] = useState(true);
  const [loads, setLoads] = useState([]);
  const [pallets, setPallets] = useState([]);
  const [expandedLoadId, setExpandedLoadId] = useState("");
  const [hasPalletStateChanges, setHasPalletStateChanges] = useState(false);
  const [expandedProductsByPalletId, setExpandedProductsByPalletId] = useState(
    {},
  );
  const [leavePromptOpen, setLeavePromptOpen] = useState(false);
  const [pendingPath, setPendingPath] = useState("");
  const [finalizeSubmitting, setFinalizeSubmitting] = useState(false);
  const [finalizeLoadIdSubmitting, setFinalizeLoadIdSubmitting] = useState("");
  const [groupByTipoByLoadId, setGroupByTipoByLoadId] = useState({});
  const [hideUnloadedByLoadId, setHideUnloadedByLoadId] = useState({});
  const [reportOpen, setReportOpen] = useState(false);
  const [reportLoadId, setReportLoadId] = useState("");
  const [reportOperators, setReportOperators] = useState([]);
  const [reportNotes, setReportNotes] = useState("");
  const [reportChoferName, setReportChoferName] = useState("");
  const [reportConsignatarioName, setReportConsignatarioName] = useState("");
  const [usersList, setUsersList] = useState([]);
  const [responsablesList, setResponsablesList] = useState([]);
  const [consigneesList, setConsigneesList] = useState([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [snack, setSnack] = useState({
    open: false,
    message: "",
    type: "success",
  });
  const [divisionLoadId, setDivisionLoadId] = useState("");
  const [divisionSaving, setDivisionSaving] = useState(false);
  const [checklistTruckTabByLoadId, setChecklistTruckTabByLoadId] = useState(
    {},
  );

  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!hasPalletStateChanges) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasPalletStateChanges]);

  useEffect(() => {
    if (!hasPalletStateChanges) return;
    const onClickCapture = (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const a = target.closest("a");
      if (!a) return;
      if (a.target && a.target !== "_self") return;
      if (a.hasAttribute("download")) return;
      if (!a.href) return;
      let url;
      try {
        url = new URL(a.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      const next = `${url.pathname}${url.search}${url.hash}`;
      const cur = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (!next || next === cur) return;
      e.preventDefault();
      e.stopPropagation();
      setPendingPath(next);
      setLeavePromptOpen(true);
    };
    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, [hasPalletStateChanges]);

  const guardedNavigate = (to) => {
    const next = String(to || "").trim();
    if (!next) return;
    if (!hasPalletStateChanges) {
      navigate(next);
      return;
    }
    setPendingPath(next);
    setLeavePromptOpen(true);
  };

  const confirmLeave = () => {
    const next = String(pendingPath || "").trim();
    setLeavePromptOpen(false);
    setPendingPath("");
    setHasPalletStateChanges(false);
    if (next) navigate(next);
  };

  const cancelLeave = () => {
    setLeavePromptOpen(false);
    setPendingPath("");
  };

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        setLoading(true);
        const [loadList, palletList] = await Promise.all([
          fetchAllLoads(),
          fetchAllPallets(),
        ]);
        if (!mounted) return;
        setLoads(Array.isArray(loadList) ? loadList : []);
        setPallets(Array.isArray(palletList) ? palletList : []);
      } catch {
        if (!mounted) return;
        setLoads([]);
        setPallets([]);
        setSnack({
          open: true,
          message: "No se pudieron cargar las cargas o los palets",
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
    Promise.all([fetchAllUsers(), fetchAllResponsables(), fetchAllConsignees()])
      .then(([users, responsables, consignees]) => {
        if (!mounted) return;
        const currentUser = getCurrentUser();
        const currentId = String(currentUser?._id || currentUser?.id || "");
        const currentName = String(currentUser?.name || "").trim();
        const baseUsers = Array.isArray(users) ? users : [];
        const hasCurrent =
          currentId &&
          baseUsers.some((u) => String(u?.id || u?._id || "") === currentId);
        const mergedUsers = hasCurrent
          ? baseUsers
          : currentId || currentName
            ? [
                ...baseUsers,
                {
                  id: currentId || "current",
                  name: currentName || currentId,
                  email: "",
                  role: currentUser?.role || "",
                  active: true,
                },
              ]
            : baseUsers;
        setUsersList(mergedUsers);
        setResponsablesList(Array.isArray(responsables) ? responsables : []);
        setConsigneesList(Array.isArray(consignees) ? consignees : []);
      })
      .catch(() => {
        if (!mounted) return;
        setUsersList([]);
        setResponsablesList([]);
        setConsigneesList([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const normalizeEstado = (value) =>
    String(value || "")
      .trim()
      .toLowerCase();

  const normalizeTipo = (value) =>
    String(value || "")
      .trim()
      .toLowerCase();
  const tipoOrder = (tipo) => {
    const t = normalizeTipo(tipo);
    if (t === "congelado") return 0;
    if (t === "refrigerado") return 1;
    if (t === "seco") return 2;
    if (t === "técnico" || t === "tecnico") return 3;
    if (t === "fruta y verdura") return 4;
    if (t === "repuestos") return 5;
    return 99;
  };
  const tipoLabel = (tipo) => {
    const t = normalizeTipo(tipo);
    if (t === "técnico" || t === "tecnico") return "Técnico";
    if (!t) return "Sin tipo";
    return t.charAt(0).toUpperCase() + t.slice(1);
  };
  const tipoTint = (tipo) => {
    const t = normalizeTipo(tipo);
    if (t === "congelado") return "#dbeafe";
    if (t === "refrigerado") return "#dcfce7";
    if (t === "seco") return "#fef3c7";
    if (t === "técnico" || t === "tecnico") return "#ede9fe";
    if (t === "fruta y verdura") return "#ccfbf1";
    if (t === "repuestos") return "#fee2e2";
    return "var(--hover)";
  };
  const tipoColor = (tipo) => {
    const t = normalizeTipo(tipo);
    if (t === "congelado") return "#2563eb";
    if (t === "refrigerado") return "#16a34a";
    if (t === "seco") return "#d97706";
    if (t === "técnico" || t === "tecnico") return "#7c3aed";
    if (t === "fruta y verdura") return "#0f766e";
    if (t === "repuestos") return "#dc2626";
    return "#64748b";
  };

  const role = getCurrentRole() || getCurrentUser()?.role || null;
  const canManagePallets = hasPermission(role, PERMISSIONS.MANAGE_PALLETS);
  const canManageLoads = hasPermission(role, PERMISSIONS.MANAGE_LOADS);
  const canFinalize = canManageLoads || canManagePallets;

  const loadsCargando = useMemo(() => {
    return loads
      .filter((l) => normalizeEstado(l?.estado_viaje) === "cargando")
      .map((l) => ({
        ...l,
        _id: l?._id || l?.id,
        id: l?.id || l?._id,
      }));
  }, [loads]);

  const palletById = useMemo(() => {
    return new Map(
      pallets
        .map((p) => [String(p?._id || p?.id || ""), p])
        .filter((pair) => pair[0]),
    );
  }, [pallets]);

  const palletsByLoadId = useMemo(() => {
    const byRelation = new Map();
    pallets.forEach((p) => {
      const loadId = String(p?.carga?._id || p?.carga || "");
      if (!loadId) return;
      const arr = byRelation.get(loadId) || [];
      arr.push(p);
      byRelation.set(loadId, arr);
    });

    const out = new Map();
    loadsCargando.forEach((l) => {
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
        const found = palletById.get(String(pid));
        if (found) uniq.set(String(pid), found);
      });

      out.set(loadId, Array.from(uniq.values()));
    });
    return out;
  }, [pallets, loadsCargando, palletById]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return loadsCargando.filter((l) => {
      if (!q) return true;
      const loadId = String(l?._id || l?.id || "");
      const palletsInLoad = palletsByLoadId.get(loadId) || [];
      const anyPalletMatch = palletsInLoad.some((p) => {
        const numero = String(p?.numero_palet || "").toLowerCase();
        const tipo = String(p?.tipo || "").toLowerCase();
        return numero.includes(q) || tipo.includes(q);
      });
      return (
        String(l?.nombre || "")
          .toLowerCase()
          .includes(q) ||
        String(formatDateLabel(l?.fecha_de_carga) || "")
          .toLowerCase()
          .includes(q) ||
        String(l?.estado_viaje || "")
          .toLowerCase()
          .includes(q) ||
        anyPalletMatch
      );
    });
  }, [loadsCargando, query, palletsByLoadId]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filtered.slice(start, end);
  }, [filtered, page, pageSize]);

  const togglePallet = async (loadId, palletId) => {
    const lid = String(loadId || "").trim();
    const pid = String(palletId || "").trim();
    if (!lid || !pid) return;

    const current = pallets.find((p) => String(p?._id || p?.id || "") === pid);
    const nextEstado = !(current?.estado === true);
    setHasPalletStateChanges(true);

    setPallets((prev) =>
      prev.map((p) => {
        const id = String(p?._id || p?.id || "");
        if (!id || id !== pid) return p;
        return { ...p, estado: nextEstado };
      }),
    );

    try {
      await updatePalletById(pid, { estado: nextEstado });
    } catch (e) {
      setPallets((prev) =>
        prev.map((p) => {
          const id = String(p?._id || p?.id || "");
          if (!id || id !== pid) return p;
          return { ...p, estado: current?.estado === true };
        }),
      );
      setSnack({
        open: true,
        message: String(
          e?.message || "No se pudo actualizar el estado del palet",
        ),
        type: "error",
      });
    }
  };

  const toggleGroupByTipo = (loadId) => {
    const id = String(loadId || "");
    if (!id) return;
    setGroupByTipoByLoadId((prev) => ({
      ...prev,
      [id]: !prev?.[id],
    }));
  };

  const toggleHideUnloaded = (loadId) => {
    const id = String(loadId || "");
    if (!id) return;
    setHideUnloadedByLoadId((prev) => ({
      ...prev,
      [id]: !prev?.[id],
    }));
  };

  const togglePalletProducts = (palletId) => {
    const pid = String(palletId || "").trim();
    if (!pid) return;
    setExpandedProductsByPalletId((prev) => ({
      ...prev,
      [pid]: !prev?.[pid],
    }));
  };

  const responsableNameById = useMemo(() => {
    const map = new Map();
    responsablesList.forEach((r) => {
      const id = String(r?._id || r?.id || "");
      if (!id) return;
      const name = String(r?.nombre || r?.name || "").trim();
      if (name) map.set(id, name);
    });
    return map;
  }, [responsablesList]);

  const consigneeNameById = useMemo(() => {
    const map = new Map();
    consigneesList.forEach((c) => {
      const id = String(c?._id || c?.id || "");
      if (!id) return;
      const name = String(c?.nombre || c?.name || "").trim();
      if (name) map.set(id, name);
    });
    return map;
  }, [consigneesList]);

  const getUserLabel = (u) =>
    String(u?.name || u?.nombre || u?.email || u?.id || "").trim();

  const userNameById = useMemo(() => {
    const map = new Map();
    usersList.forEach((u) => {
      const id = String(u?._id || u?.id || "").trim();
      if (!id) return;
      const name = getUserLabel(u);
      if (name) map.set(id, name);
    });
    return map;
  }, [usersList]);

  const getRefId = (value) => {
    if (!value) return "";
    if (typeof value === "object") {
      return String(value?._id || value?.id || value?.docId || "").trim();
    }
    return String(value || "").trim();
  };
  const getRefName = (value) => {
    if (!value || typeof value !== "object") return "";
    return String(value?.nombre || value?.name || "").trim();
  };

  const openFinalizeReport = (loadId) => {
    const id = String(loadId || "");
    if (!id) return;
    const loadEntity =
      loadsCargando.find((x) => String(x?._id || x?.id || "") === id) || null;
    const camiones = Array.isArray(loadEntity?.camiones)
      ? loadEntity.camiones
      : [];
    if (camiones.length > 0) {
      const palletsInLoad = palletsByLoadId.get(id) || [];
      const allIds = palletsInLoad
        .map((p) => String(p?._id || p?.id || ""))
        .filter(Boolean);
      const assigned = new Set();
      camiones.forEach((t) => {
        (Array.isArray(t?.pallet_ids) ? t.pallet_ids : [])
          .map((v) => String(v))
          .filter(Boolean)
          .forEach((pid) => assigned.add(pid));
      });
      const unassigned = allIds.filter((pid) => !assigned.has(pid));
      const readyAll = camiones.every((t) => !!t?.ready || !!t?.loaded_at);
      if (unassigned.length > 0 || !readyAll) {
        setSnack({
          open: true,
          message:
            "No se puede finalizar: asigna todos los palets a camiones y marca todos los camiones como listos.",
          type: "warning",
        });
        setExpandedLoadId(id);
        setDivisionLoadId(id);
        return;
      }
    }
    setReportLoadId(id);
    const currentUser = getCurrentUser();
    const currentId = String(currentUser?._id || currentUser?.id || "").trim();
    setReportOperators(currentId ? [currentId] : []);
    setReportNotes("");
    const choferId = getRefId(loadEntity?.chofer);
    const choferName = getRefName(loadEntity?.chofer);
    const consigneeId = getRefId(loadEntity?.consignatario);
    const consigneeName = getRefName(loadEntity?.consignatario);
    setReportChoferName(
      userNameById.get(choferId) ||
        responsableNameById.get(choferId) ||
        choferName ||
        "",
    );
    setReportConsignatarioName(
      consigneeNameById.get(consigneeId) || consigneeName || "",
    );
    setReportOpen(true);
  };

  useEffect(() => {
    if (!reportOpen) return;
    const loadId = String(reportLoadId || "");
    if (!loadId) return;
    const loadEntity =
      loadsCargando.find((x) => String(x?._id || x?.id || "") === loadId) ||
      null;
    if (loadEntity) {
      if (!String(reportChoferName || "").trim()) {
        const key = getRefId(loadEntity?.chofer);
        const name =
          userNameById.get(key) ||
          responsableNameById.get(key) ||
          getRefName(loadEntity?.chofer) ||
          "";
        if (name) setReportChoferName(name);
      }
      if (!String(reportConsignatarioName || "").trim()) {
        const key = getRefId(loadEntity?.consignatario);
        const name =
          consigneeNameById.get(key) ||
          getRefName(loadEntity?.consignatario) ||
          "";
        if (name) setReportConsignatarioName(name);
      }
    }
    if (reportOperators.length === 0) {
      const currentUser = getCurrentUser();
      const currentId = String(
        currentUser?._id || currentUser?.id || "",
      ).trim();
      if (currentId) setReportOperators([currentId]);
    }
  }, [
    reportOpen,
    reportLoadId,
    loadsCargando,
    responsableNameById,
    consigneeNameById,
    userNameById,
    reportChoferName,
    reportConsignatarioName,
    reportOperators.length,
  ]);

  const finalizeLoad = async (loadId) => {
    const id = String(loadId || "");
    if (!id) return;
    if (!canFinalize) {
      setSnack({
        open: true,
        message: "No tienes permiso para finalizar cargas",
        type: "error",
      });
      return;
    }
    const palletsInLoad = palletsByLoadId.get(id) || [];
    const loadEntity =
      loadsCargando.find((x) => String(x?._id || x?.id || "") === id) || null;
    const camiones = Array.isArray(loadEntity?.camiones)
      ? loadEntity.camiones
      : [];
    if (camiones.length > 0) {
      const allIds = palletsInLoad
        .map((p) => String(p?._id || p?.id || ""))
        .filter(Boolean);
      const assigned = new Set();
      camiones.forEach((t) => {
        (Array.isArray(t?.pallet_ids) ? t.pallet_ids : [])
          .map((v) => String(v))
          .filter(Boolean)
          .forEach((pid) => assigned.add(pid));
      });
      const unassigned = allIds.filter((pid) => !assigned.has(pid));
      const readyAll = camiones.every((t) => !!t?.ready || !!t?.loaded_at);
      if (unassigned.length > 0 || !readyAll) {
        setSnack({
          open: true,
          message:
            "No se puede finalizar: asigna todos los palets a camiones y marca todos los camiones como listos.",
          type: "warning",
        });
        return;
      }
      const pending = palletsInLoad.filter((p) => p?.estado !== true);
      if (pending.length > 0) {
        setSnack({
          open: true,
          message:
            "No se puede finalizar: hay palets pendientes. Marca todos los palets del/los camiones como cargados.",
          type: "warning",
        });
        return;
      }
    }
    const selectedIds = palletsInLoad
      .filter((p) => p?.estado === true)
      .map((p) => String(p?._id || p?.id || ""))
      .filter(Boolean);
    if (selectedIds.length === 0) {
      setSnack({
        open: true,
        message: "Selecciona al menos un palet",
        type: "error",
      });
      return;
    }
    if (finalizeSubmitting) return;
    try {
      setFinalizeSubmitting(true);
      setFinalizeLoadIdSubmitting(id);
      await Promise.all(
        selectedIds.map((pid) =>
          updatePalletById(pid, { estado: true }).catch(() => null),
        ),
      );
      const updatedLoad = await updateLoadById(id, {
        estado_viaje: "Viajando",
        modificado_por: getCurrentUser()?.name || "Testing",
      });
      const loadNombre = loadEntity?.nombre || "";
      const operatorObjs = [];
      const byId = new Map(
        usersList
          .map((u) => [String(u?.id || u?._id || ""), u])
          .filter((pair) => pair[0]),
      );
      reportOperators.forEach((oid) => {
        const key = String(oid || "").trim();
        if (!key) return;
        const u = byId.get(key);
        if (u) {
          operatorObjs.push({
            user_id: String(u?.id || u?._id || ""),
            name: getUserLabel(u),
          });
          return;
        }
        const currentUser = getCurrentUser();
        const currentId = String(
          currentUser?._id || currentUser?.id || "",
        ).trim();
        if (currentId && currentId === key) {
          operatorObjs.push({
            user_id: currentId,
            name: String(currentUser?.name || currentId),
          });
        }
      });
      try {
        await createLoadReport({
          load_id: id,
          load_nombre: loadNombre,
          pallet_ids: selectedIds,
          cargado_por: operatorObjs,
          cargado_a: {
            chofer_id: getRefId(loadEntity?.chofer),
            chofer_name: reportChoferName,
            consignatario_id: getRefId(loadEntity?.consignatario),
            consignatario_name: reportConsignatarioName,
          },
          notas: reportNotes,
          creado_por: getCurrentUser()?.name || "Testing",
        });
      } catch (e) {
        const msg = String(e?.message || "").trim();
        setSnack({
          open: true,
          message: msg || "No se pudo guardar el informe de carga",
          type: "error",
        });
      }
      setPallets((prev) =>
        prev.map((p) => {
          const pid = String(p?._id || p?.id || "");
          if (!pid) return p;
          if (!selectedIds.includes(pid)) return p;
          return { ...p, estado: true };
        }),
      );
      if (updatedLoad) {
        setLoads((prev) =>
          prev.map((l) =>
            String(l?._id || l?.id || "") === id
              ? { ...l, ...updatedLoad, _id: updatedLoad._id || updatedLoad.id }
              : l,
          ),
        );
      } else {
        setLoads((prev) =>
          prev.map((l) =>
            String(l?._id || l?.id || "") === id
              ? { ...l, estado_viaje: "Viajando" }
              : l,
          ),
        );
      }
      if (expandedLoadId === id) setExpandedLoadId("");
      setSnack({
        open: true,
        message: "Carga finalizada",
        type: "success",
      });
      setReportOpen(false);
    } catch (e) {
      setSnack({
        open: true,
        message: String(e?.message || "Error finalizando la carga"),
        type: "error",
      });
    } finally {
      setFinalizeSubmitting(false);
      setFinalizeLoadIdSubmitting("");
    }
  };

  const closeDivision = () => {
    setDivisionLoadId("");
  };

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
        <input
          className="input"
          style={{ width: 320 }}
          placeholder="Buscar por carga, palet, fecha o estado"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <section className="card">
        <div className="card-header">
          <h2 className="card-title">Carga de Palets</h2>
        </div>
        <div style={{ padding: 12 }}>
          {loading ? (
            <div style={{ color: "var(--text-secondary)" }}>
              <span
                className="material-symbols-outlined"
                style={{ verticalAlign: "middle", marginRight: 6 }}
              >
                progress_activity
              </span>
              Cargando...
            </div>
          ) : paginated.length === 0 ? (
            <div style={{ color: "var(--text-secondary)" }}>
              No hay cargas en estado Cargando
            </div>
          ) : (
            paginated.map((l) => {
              const loadId = String(l?._id || l?.id || "");
              const expanded = expandedLoadId === loadId;
              const palletsInLoad = palletsByLoadId.get(loadId) || [];
              const camiones = Array.isArray(l?.camiones) ? l.camiones : [];
              const byTipo = !!groupByTipoByLoadId[loadId];
              const hideLoaded = !!hideUnloadedByLoadId[loadId];
              const divisionActive = String(divisionLoadId || "") === loadId;
              const selectedChecklistTruckIdRaw = String(
                checklistTruckTabByLoadId?.[loadId] || "all",
              ).trim();
              const selectedChecklistTruckId =
                selectedChecklistTruckIdRaw || "all";
              const selectedChecklistTruck =
                selectedChecklistTruckId !== "all"
                  ? camiones.find(
                      (t) =>
                        String(t?.id || t?._id || "").trim() ===
                        selectedChecklistTruckId,
                    ) || null
                  : null;
              const effectiveChecklistTruckId = selectedChecklistTruck
                ? selectedChecklistTruckId
                : "all";
              const selectedSet = new Set(
                palletsInLoad
                  .filter((p) => p?.estado === true)
                  .map((p) => String(p?._id || p?.id || ""))
                  .filter(Boolean),
              );
              const loadedCount = selectedSet.size;
              const totalCount = palletsInLoad.length;
              const loadedPct = totalCount
                ? Math.round((loadedCount / totalCount) * 100)
                : 0;
              const tipoMap = new Map();
              palletsInLoad.forEach((p) => {
                const tipo = normalizeTipo(p?.tipo) || "sin_tipo";
                tipoMap.set(tipo, (tipoMap.get(tipo) || 0) + 1);
              });
              const tipoEntries = Array.from(tipoMap.entries()).sort((a, b) => {
                const ao = tipoOrder(a[0]);
                const bo = tipoOrder(b[0]);
                if (ao !== bo) return ao - bo;
                return String(a[0]).localeCompare(String(b[0]), "es", {
                  sensitivity: "base",
                });
              });
              let acumuladoPct = 0;
              const donutSegments = tipoEntries
                .map(([tipo, count]) => {
                  const start = acumuladoPct;
                  const end = start + (count / Math.max(totalCount, 1)) * 100;
                  acumuladoPct = end;
                  return `${tipoColor(tipo)} ${start}% ${end}%`;
                })
                .join(", ");
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
                      borderLeft: divisionActive
                        ? "4px solid #7c3aed"
                        : "4px solid #6b7280",
                      borderRadius: expanded ? "10px 10px 0 0" : 10,
                      display: "flex",
                      alignItems: "center",
                    }}
                    onClick={() => {
                      if (expanded) {
                        setExpandedLoadId("");
                        if (String(divisionLoadId || "") === loadId)
                          setDivisionLoadId("");
                        return;
                      }
                      setExpandedLoadId(loadId);
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: 12,
                        width: "100%",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
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
                          {palletsInLoad.length > 0
                            ? ` · Palets: ${palletsInLoad.length}`
                            : ""}
                        </div>
                        {divisionActive || hideLoaded || byTipo ? (
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 6,
                              marginTop: 6,
                            }}
                          >
                            {divisionActive ? (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6,
                                  fontSize: 12,
                                  fontWeight: 800,
                                  borderRadius: 999,
                                  padding: "2px 8px",
                                  border: "1px solid #ddd6fe",
                                  background: "#f5f3ff",
                                  color: "#5b21b6",
                                }}
                              >
                                <span className="material-symbols-outlined">
                                  local_shipping
                                </span>
                                División
                              </span>
                            ) : null}
                            {hideLoaded ? (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6,
                                  fontSize: 12,
                                  fontWeight: 800,
                                  borderRadius: 999,
                                  padding: "2px 8px",
                                  border: "1px solid #bae6fd",
                                  background: "#f0f9ff",
                                  color: "#0369a1",
                                }}
                              >
                                <span className="material-symbols-outlined">
                                  visibility_off
                                </span>
                                Ocultar cargados
                              </span>
                            ) : null}
                            {byTipo ? (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6,
                                  fontSize: 12,
                                  fontWeight: 800,
                                  borderRadius: 999,
                                  padding: "2px 8px",
                                  border: "1px solid #fde68a",
                                  background: "#fffbeb",
                                  color: "#b45309",
                                }}
                              >
                                <span className="material-symbols-outlined">
                                  filter_alt
                                </span>
                                Por tipo
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      <button
                        className="icon-button"
                        title="Abrir carga"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          guardedNavigate(`/app/logistica/cargas/${loadId}`);
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
                        padding: "10px 12px 12px 12px",
                        background: "#fff",
                        border: "1px solid var(--border)",
                        borderTop: "none",
                        borderRadius: "0 0 10px 10px",
                        display: "grid",
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 10,
                          flexWrap: "wrap",
                        }}
                      >
                        <div
                          style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                        >
                          <button
                            type="button"
                            className={
                              !divisionActive
                                ? "primary-button"
                                : "secondary-button"
                            }
                            onClick={() => setDivisionLoadId("")}
                            style={{
                              height: 36,
                              padding: "0 10px",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                            title="Ver checklist"
                          >
                            <span className="material-symbols-outlined">
                              checklist
                            </span>
                            Checklist
                          </button>
                          <button
                            type="button"
                            className={
                              divisionActive
                                ? "primary-button"
                                : "secondary-button"
                            }
                            onClick={() => setDivisionLoadId(loadId)}
                            style={{
                              height: 36,
                              padding: "0 10px",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                            title="División de carga"
                          >
                            <span className="material-symbols-outlined">
                              local_shipping
                            </span>
                            División
                          </button>
                        </div>

                        <div
                          style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                        >
                          <button
                            className={
                              byTipo ? "primary-button" : "secondary-button"
                            }
                            type="button"
                            onClick={() => toggleGroupByTipo(loadId)}
                            title="Separar por tipo"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 8,
                              padding: "0 10px",
                              height: 36,
                              whiteSpace: "nowrap",
                            }}
                          >
                            <span className="material-symbols-outlined">
                              filter_alt
                            </span>
                            <span style={{ fontWeight: 700, fontSize: 13 }}>
                              Por tipo
                            </span>
                          </button>
                          <button
                            className={
                              hideLoaded ? "primary-button" : "secondary-button"
                            }
                            type="button"
                            onClick={() => toggleHideUnloaded(loadId)}
                            title={
                              hideLoaded
                                ? "Mostrar todos los palets"
                                : "Ocultar cargados"
                            }
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 8,
                              padding: "0 10px",
                              height: 36,
                              whiteSpace: "nowrap",
                            }}
                          >
                            <span className="material-symbols-outlined">
                              {hideLoaded ? "visibility_off" : "visibility"}
                            </span>
                            <span style={{ fontWeight: 700, fontSize: 13 }}>
                              {hideLoaded ? "Ocultando" : "Ocultar cargados"}
                            </span>
                          </button>
                        </div>
                      </div>

                      {divisionActive ? (
                        <LoadDivisionModal
                          open={divisionActive}
                          variant="inline"
                          load={
                            loads.find(
                              (x) => String(x?._id || x?.id || "") === loadId,
                            ) || null
                          }
                          pallets={palletsInLoad}
                          hideLoaded={hideLoaded}
                          actor={getCurrentUser()}
                          saving={divisionSaving}
                          onTogglePallet={(pid) => togglePallet(loadId, pid)}
                          onClose={closeDivision}
                          onSave={async ({ camiones, error }) => {
                            if (error) {
                              setSnack({
                                open: true,
                                message: String(error),
                                type: "error",
                              });
                              return;
                            }
                            if (!loadId) return;
                            if (!Array.isArray(camiones)) return;
                            if (divisionSaving) return;
                            try {
                              setDivisionSaving(true);
                              const updated = await updateLoadById(loadId, {
                                camiones,
                                modificado_por:
                                  getCurrentUser()?.name || "Testing",
                              });
                              if (updated) {
                                setLoads((prev) =>
                                  prev.map((item) =>
                                    String(item?._id || item?.id || "") ===
                                    String(loadId)
                                      ? {
                                          ...item,
                                          ...updated,
                                          _id: updated._id || updated.id,
                                        }
                                      : item,
                                  ),
                                );
                                setSnack({
                                  open: true,
                                  message: "División guardada",
                                  type: "success",
                                });
                                closeDivision();
                                return;
                              }
                              setSnack({
                                open: true,
                                message: "No se pudo guardar la división",
                                type: "error",
                              });
                            } catch (e) {
                              setSnack({
                                open: true,
                                message: String(
                                  e?.message || "Error guardando la división",
                                ),
                                type: "error",
                              });
                            } finally {
                              setDivisionSaving(false);
                            }
                          }}
                        />
                      ) : (
                        <>
                          <div
                            style={{
                              border: "1px solid var(--border)",
                              borderRadius: 10,
                              padding: 10,
                              display: "grid",
                              gap: 10,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                gap: 12,
                                alignItems: "center",
                              }}
                            >
                              <div
                                style={{
                                  width: 74,
                                  height: 74,
                                  borderRadius: "50%",
                                  background:
                                    totalCount > 0 && donutSegments
                                      ? `conic-gradient(${donutSegments})`
                                      : "#e5e7eb",
                                  display: "grid",
                                  placeItems: "center",
                                  flex: "0 0 auto",
                                }}
                                title="Distribución de palets por tipo"
                              >
                                <div
                                  style={{
                                    width: 46,
                                    height: 46,
                                    borderRadius: "50%",
                                    background: "#fff",
                                    display: "grid",
                                    placeItems: "center",
                                    fontSize: 12,
                                    fontWeight: 800,
                                  }}
                                >
                                  {totalCount}
                                </div>
                              </div>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: "var(--text-secondary)",
                                    marginBottom: 4,
                                  }}
                                >
                                  Carga completada
                                </div>
                                <div
                                  style={{
                                    height: 10,
                                    borderRadius: 999,
                                    background: "var(--hover)",
                                    overflow: "hidden",
                                  }}
                                >
                                  <div
                                    style={{
                                      width: `${loadedPct}%`,
                                      height: "100%",
                                      background:
                                        loadedPct >= 100
                                          ? "#16a34a"
                                          : "#2563eb",
                                    }}
                                  />
                                </div>
                                <div
                                  style={{
                                    marginTop: 6,
                                    fontSize: 12,
                                    color: "var(--text-secondary)",
                                  }}
                                >
                                  {loadedCount}/{totalCount} cargados (
                                  {loadedPct}%)
                                </div>
                              </div>
                            </div>

                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 8,
                              }}
                            >
                              {tipoEntries.map(([tipo, count]) => (
                                <div
                                  key={`${loadId}-tipo-${tipo}`}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 6,
                                    fontSize: 12,
                                    color: "var(--text-secondary)",
                                    border: "1px solid var(--border)",
                                    borderRadius: 999,
                                    padding: "3px 8px",
                                  }}
                                >
                                  <span
                                    style={{
                                      width: 8,
                                      height: 8,
                                      borderRadius: "50%",
                                      background: tipoColor(tipo),
                                    }}
                                  />
                                  {tipoLabel(tipo)}: {count}
                                </div>
                              ))}
                            </div>
                          </div>

                          {camiones.length > 1 ? (
                            <div
                              style={{
                                border: "1px solid var(--border)",
                                borderRadius: 10,
                                padding: 10,
                                display: "grid",
                                gap: 8,
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 12,
                                  fontWeight: 800,
                                  color: "var(--text-secondary)",
                                }}
                              >
                                Progreso por camión
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: 8,
                                }}
                              >
                                {camiones.map((t) => {
                                  const tid = String(
                                    t?.id || t?._id || "",
                                  ).trim();
                                  if (!tid) return null;
                                  const label = String(
                                    t?.alias || t?.matricula || "Camión",
                                  ).trim();
                                  const ids = Array.isArray(t?.pallet_ids)
                                    ? Array.from(
                                        new Set(
                                          t.pallet_ids
                                            .map((v) => String(v || "").trim())
                                            .filter(Boolean),
                                        ),
                                      )
                                    : [];
                                  const total = ids.length;
                                  const loaded = ids.filter((pid) =>
                                    selectedSet.has(pid),
                                  ).length;
                                  const pct = total
                                    ? Math.round((loaded / total) * 100)
                                    : 0;
                                  const ready = !!t?.ready || !!t?.loaded_at;
                                  return (
                                    <div
                                      key={`${loadId}-truck-progress-${tid}`}
                                      style={{
                                        width: 240,
                                        border: "1px solid var(--border)",
                                        borderRadius: 10,
                                        padding: 10,
                                        background: ready ? "#ecfdf5" : "#fff",
                                        display: "grid",
                                        gap: 6,
                                      }}
                                      title={label}
                                    >
                                      <div
                                        style={{
                                          display: "flex",
                                          justifyContent: "space-between",
                                          gap: 10,
                                          alignItems: "center",
                                        }}
                                      >
                                        <div
                                          style={{
                                            fontWeight: 800,
                                            fontSize: 13,
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                          }}
                                        >
                                          {label}
                                        </div>
                                        <div
                                          style={{
                                            fontSize: 12,
                                            color: "var(--text-secondary)",
                                            whiteSpace: "nowrap",
                                          }}
                                        >
                                          {loaded}/{total}
                                        </div>
                                      </div>
                                      <div
                                        style={{
                                          height: 8,
                                          borderRadius: 999,
                                          background: "var(--hover)",
                                          overflow: "hidden",
                                        }}
                                      >
                                        <div
                                          style={{
                                            width: `${pct}%`,
                                            height: "100%",
                                            background: ready
                                              ? "#16a34a"
                                              : pct >= 100
                                                ? "#16a34a"
                                                : "#2563eb",
                                          }}
                                        />
                                      </div>
                                      <div
                                        style={{
                                          fontSize: 12,
                                          color: "var(--text-secondary)",
                                        }}
                                      >
                                        {pct}% {ready ? "· listo" : ""}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null}

                          {camiones.length > 0 ? (
                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 8,
                              }}
                            >
                              <button
                                type="button"
                                className={
                                  effectiveChecklistTruckId === "all"
                                    ? "primary-button"
                                    : "secondary-button"
                                }
                                onClick={() =>
                                  setChecklistTruckTabByLoadId((prev) => ({
                                    ...prev,
                                    [loadId]: "all",
                                  }))
                                }
                                style={{ height: 34, padding: "0 10px" }}
                              >
                                Todos
                              </button>
                              {camiones.map((t) => {
                                const tid = String(
                                  t?.id || t?._id || "",
                                ).trim();
                                if (!tid) return null;
                                const label = String(
                                  t?.alias || t?.matricula || "Camión",
                                ).trim();
                                const count = Array.isArray(t?.pallet_ids)
                                  ? new Set(
                                      t.pallet_ids
                                        .map((v) => String(v || "").trim())
                                        .filter(Boolean),
                                    ).size
                                  : 0;
                                return (
                                  <button
                                    key={`${loadId}-truck-tab-${tid}`}
                                    type="button"
                                    className={
                                      effectiveChecklistTruckId === tid
                                        ? "primary-button"
                                        : "secondary-button"
                                    }
                                    onClick={() =>
                                      setChecklistTruckTabByLoadId((prev) => ({
                                        ...prev,
                                        [loadId]: tid,
                                      }))
                                    }
                                    style={{ height: 34, padding: "0 10px" }}
                                    title={label}
                                  >
                                    {label} ({count})
                                  </button>
                                );
                              })}
                            </div>
                          ) : null}

                          {palletsInLoad.length === 0 ? (
                            <div style={{ color: "var(--text-secondary)" }}>
                              Sin palets en esta carga
                            </div>
                          ) : (
                            (() => {
                              const baseSort = (a, b) =>
                                String(a?.numero_palet || "").localeCompare(
                                  String(b?.numero_palet || ""),
                                  "es",
                                  { numeric: true, sensitivity: "base" },
                                );
                              const truckPalletSet =
                                effectiveChecklistTruckId !== "all" &&
                                selectedChecklistTruck
                                  ? new Set(
                                      (Array.isArray(
                                        selectedChecklistTruck?.pallet_ids,
                                      )
                                        ? selectedChecklistTruck.pallet_ids
                                        : []
                                      )
                                        .map((v) => String(v || "").trim())
                                        .filter(Boolean),
                                    )
                                  : null;
                              const baseByTruck =
                                truckPalletSet instanceof Set
                                  ? palletsInLoad.filter((p) => {
                                      const pid = String(
                                        p?._id || p?.id || "",
                                      ).trim();
                                      if (!pid) return false;
                                      return truckPalletSet.has(pid);
                                    })
                                  : palletsInLoad;
                              const list = (
                                hideLoaded
                                  ? baseByTruck.filter(
                                      (p) => p?.estado !== true,
                                    )
                                  : baseByTruck
                              ).slice();
                              if (list.length === 0) {
                                return (
                                  <div
                                    style={{ color: "var(--text-secondary)" }}
                                  >
                                    {hideLoaded
                                      ? "No hay palets pendientes para mostrar"
                                      : effectiveChecklistTruckId !== "all"
                                        ? "No hay palets para este camión"
                                        : "Sin palets en esta carga"}
                                  </div>
                                );
                              }
                              const renderPalletCard = (p, key) => {
                                const pid = String(p?._id || p?.id || "");
                                const checked = selectedSet.has(pid);
                                const numero = String(
                                  p?.numero_palet || "",
                                ).trim();
                                const tipo = String(p?.tipo || "").trim();
                                const base = String(p?.base || "").trim();
                                const productos = String(
                                  p?.productos || "",
                                ).trim();
                                const hasProducts = !!productos;
                                const productsExpanded =
                                  !!expandedProductsByPalletId[pid];
                                return (
                                  <label
                                    key={key}
                                    style={{
                                      display: "flex",
                                      gap: 10,
                                      alignItems: "stretch",
                                      padding: "10px 10px",
                                      border: "1px solid var(--border)",
                                      borderRadius: 10,
                                      cursor: "pointer",
                                      background: checked
                                        ? tipoTint(tipo)
                                        : "#fff",
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => togglePallet(loadId, pid)}
                                      style={{ marginTop: 3 }}
                                    />
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                      <div
                                        style={{
                                          fontWeight: 800,
                                          fontSize: 16,
                                          lineHeight: "20px",
                                        }}
                                      >
                                        {numero || "—"}
                                      </div>
                                      <div
                                        style={{
                                          color: "var(--text-secondary)",
                                          fontSize: 13,
                                          lineHeight: "16px",
                                        }}
                                      >
                                        {[tipo, base]
                                          .filter(Boolean)
                                          .join(" · ") || "—"}
                                      </div>
                                      {hasProducts && productsExpanded ? (
                                        <div
                                          style={{
                                            marginTop: 6,
                                            fontSize: 13,
                                            lineHeight: "16px",
                                            color: "var(--text-secondary)",
                                            whiteSpace: "pre-wrap",
                                          }}
                                        >
                                          {productos}
                                        </div>
                                      ) : null}
                                    </div>
                                    <div
                                      style={{
                                        marginLeft: "auto",
                                        display: "flex",
                                        alignItems: "center",
                                      }}
                                    >
                                      <button
                                        type="button"
                                        title={
                                          hasProducts
                                            ? productsExpanded
                                              ? "Ocultar productos"
                                              : "Ver productos"
                                            : "Sin productos"
                                        }
                                        aria-label={
                                          hasProducts
                                            ? productsExpanded
                                              ? "Ocultar productos"
                                              : "Ver productos"
                                            : "Sin productos"
                                        }
                                        disabled={!hasProducts}
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          if (!hasProducts) return;
                                          togglePalletProducts(pid);
                                        }}
                                        style={{
                                          height: 28,
                                          minWidth: 94,
                                          border: "1px solid var(--border)",
                                          borderRadius: 999,
                                          background: hasProducts
                                            ? "#fff"
                                            : "#f3f4f6",
                                          cursor: hasProducts
                                            ? "pointer"
                                            : "not-allowed",
                                          display: "inline-flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          gap: 4,
                                          padding: "0 10px",
                                          color: hasProducts
                                            ? "#374151"
                                            : "#9ca3af",
                                          fontSize: 12,
                                          fontWeight: 700,
                                          whiteSpace: "nowrap",
                                        }}
                                      >
                                        <span
                                          className="material-symbols-outlined"
                                          style={{ fontSize: 16 }}
                                        >
                                          {hasProducts
                                            ? productsExpanded
                                              ? "expand_less"
                                              : "expand_more"
                                            : "block"}
                                        </span>
                                        {hasProducts
                                          ? productsExpanded
                                            ? "Ocultar"
                                            : "Productos"
                                          : "Sin prod."}
                                      </button>
                                    </div>
                                  </label>
                                );
                              };
                              if (!byTipo) {
                                return (
                                  <div
                                    style={{
                                      display: "grid",
                                      gridTemplateColumns:
                                        "repeat(2, minmax(0, 1fr))",
                                      gap: 8,
                                    }}
                                  >
                                    {list
                                      .sort(baseSort)
                                      .map((p) =>
                                        renderPalletCard(
                                          p,
                                          String(
                                            p?._id ||
                                              p?.id ||
                                              p?.numero_palet ||
                                              "",
                                          ),
                                        ),
                                      )}
                                  </div>
                                );
                              }

                              const grouped = new Map();
                              list.forEach((p) => {
                                const key = normalizeTipo(p?.tipo);
                                if (!grouped.has(key)) grouped.set(key, []);
                                grouped.get(key).push(p);
                              });
                              const keys = Array.from(grouped.keys()).sort(
                                (a, b) => {
                                  const ao = tipoOrder(a);
                                  const bo = tipoOrder(b);
                                  if (ao !== bo) return ao - bo;
                                  return String(a || "").localeCompare(
                                    String(b || ""),
                                    "es",
                                    {
                                      sensitivity: "base",
                                    },
                                  );
                                },
                              );

                              return keys.map((k) => {
                                const items = grouped.get(k) || [];
                                items.sort(baseSort);
                                const label = tipoLabel(k);
                                return (
                                  <div
                                    key={`group-${k || "sin-tipo"}`}
                                    style={{
                                      display: "grid",
                                      gap: 8,
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        padding: "6px 8px",
                                        borderRadius: 10,
                                        background: tipoTint(k),
                                        border: "1px solid var(--border)",
                                        fontWeight: 800,
                                      }}
                                    >
                                      {label}
                                      <span
                                        style={{
                                          color: "var(--text-secondary)",
                                          fontWeight: 700,
                                          fontSize: 12,
                                        }}
                                      >
                                        {items.length}
                                      </span>
                                    </div>
                                    <div
                                      style={{
                                        display: "grid",
                                        gridTemplateColumns:
                                          "repeat(2, minmax(0, 1fr))",
                                        gap: 8,
                                      }}
                                    >
                                      {items.map((p) => {
                                        const pid = String(
                                          p?._id ||
                                            p?.id ||
                                            p?.numero_palet ||
                                            "",
                                        );
                                        return renderPalletCard(
                                          p,
                                          `${k || "sin-tipo"}-${pid}`,
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              });
                            })()
                          )}
                        </>
                      )}

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "flex-end",
                          paddingTop: 8,
                        }}
                      >
                        <button
                          className="primary-button"
                          type="button"
                          disabled={
                            !canFinalize ||
                            selectedSet.size === 0 ||
                            (finalizeSubmitting &&
                              String(finalizeLoadIdSubmitting) === loadId)
                          }
                          onClick={() => openFinalizeReport(loadId)}
                        >
                          Finalizar carga
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      <Modal
        open={leavePromptOpen}
        title="Vas a salir de Carga de Palets"
        onClose={cancelLeave}
        onSubmit={confirmLeave}
        submitLabel="Salir"
        cancelLabel="Quedarme"
        width={560}
        footerStyle={{ gap: 16 }}
      >
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ color: "var(--text-secondary)" }}>
            Si sales ahora, los palets que hayas marcado se quedarán guardados
            como <strong>Cargados</strong>.
          </div>
          <div style={{ color: "var(--text-secondary)" }}>
            Si vuelves a entrar más tarde, verás los checks tal y como los has
            dejado. Si desmarcas un palet, se volverá a guardar como{" "}
            <strong>No cargado</strong>.
          </div>
        </div>
      </Modal>

      <Modal
        open={reportOpen}
        title="Informe de carga"
        onClose={() => setReportOpen(false)}
        onSubmit={() => finalizeLoad(reportLoadId)}
        submitLabel="Confirmar e informar"
        cancelLabel="Cancelar"
        width={680}
      >
        {(() => {
          const ids = (palletsByLoadId.get(String(reportLoadId || "")) || [])
            .filter((p) => p?.estado === true)
            .map((p) => String(p?._id || p?.id || ""))
            .filter(Boolean);
          return (
            <div
              style={{
                padding: "8px 10px",
                border: "1px solid var(--border)",
                borderRadius: 10,
                background: "var(--hover)",
                fontWeight: 800,
                fontSize: 13,
              }}
              title={ids.join(", ")}
            >
              Palets seleccionados: {ids.length}
            </div>
          );
        })()}

        <div className="form-row">
          <FormField label="Cargado por">
            <select
              className="select"
              value={reportOperators[0] || ""}
              onChange={(e) => {
                const value = String(e.target.value || "").trim();
                setReportOperators(value ? [value] : []);
              }}
            >
              <option value="">Selecciona</option>
              {usersList
                .filter((u) => {
                  const id = String(u?.id || u?._id || "");
                  if (!id) return false;
                  if (u?.active === false) return false;
                  return true;
                })
                .slice()
                .sort((a, b) =>
                  getUserLabel(a).localeCompare(getUserLabel(b), "es", {
                    sensitivity: "base",
                    numeric: true,
                  }),
                )
                .map((u) => {
                  const uid = String(u?.id || u?._id || "");
                  return (
                    <option key={uid} value={uid}>
                      {getUserLabel(u)}
                    </option>
                  );
                })}
            </select>
          </FormField>

          <div style={{ display: "grid", gap: 10 }}>
            <FormField label="Chofer">
              <input
                className="input"
                value={reportChoferName}
                onChange={(e) => setReportChoferName(e.target.value)}
                placeholder="Nombre del chofer"
              />
            </FormField>
            <FormField label="Consignatario">
              <input
                className="input"
                value={reportConsignatarioName}
                onChange={(e) => setReportConsignatarioName(e.target.value)}
                placeholder="Nombre del consignatario"
              />
            </FormField>
          </div>
        </div>

        <FormField label="Notas">
          <textarea
            className="input"
            rows="4"
            value={reportNotes}
            onChange={(e) => setReportNotes(e.target.value)}
            placeholder="Incidencias o comentarios"
            style={{ height: "auto", minHeight: 88, resize: "vertical" }}
          />
        </FormField>
      </Modal>

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

      <Snackbar
        open={snack.open}
        message={snack.message}
        type={snack.type}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
      />
    </>
  );
}
