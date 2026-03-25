import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Pagination from "../components/Pagination.jsx";
import Snackbar from "../components/Snackbar.jsx";
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
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loads, setLoads] = useState([]);
  const [pallets, setPallets] = useState([]);
  const [expandedLoadId, setExpandedLoadId] = useState("");
  const [selectedByLoadId, setSelectedByLoadId] = useState({});
  const [finalizeSubmitting, setFinalizeSubmitting] = useState(false);
  const [finalizeLoadIdSubmitting, setFinalizeLoadIdSubmitting] = useState("");
  const [groupByTipoByLoadId, setGroupByTipoByLoadId] = useState({});
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

  const togglePallet = (loadId, palletId) => {
    const lid = String(loadId || "");
    const pid = String(palletId || "");
    if (!lid || !pid) return;
    setSelectedByLoadId((prev) => {
      const next = { ...prev };
      const set = new Set((next[lid] || []).map((v) => String(v)));
      if (set.has(pid)) set.delete(pid);
      else set.add(pid);
      next[lid] = Array.from(set);
      return next;
    });
  };

  const toggleGroupByTipo = (loadId) => {
    const id = String(loadId || "");
    if (!id) return;
    setGroupByTipoByLoadId((prev) => ({
      ...prev,
      [id]: !prev?.[id],
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
    setReportLoadId(id);
    const currentUser = getCurrentUser();
    const currentId = String(currentUser?._id || currentUser?.id || "").trim();
    setReportOperators(currentId ? [currentId] : []);
    setReportNotes("");
    const loadEntity =
      loadsCargando.find((x) => String(x?._id || x?.id || "") === id) || null;
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
    const selectedIds = (selectedByLoadId[id] || [])
      .map((v) => String(v))
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
      const loadEntity =
        loadsCargando.find((l) => String(l?._id || l?.id || "") === id) || null;
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
      setSelectedByLoadId((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
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
              const selectedSet = new Set(
                (selectedByLoadId[loadId] || []).map((v) => String(v)),
              );
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
                        String(cur || "") === loadId ? "" : loadId,
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
                      </div>
                      <button
                        className="icon-button"
                        title="Abrir carga"
                        type="button"
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
                          justifyContent: "flex-start",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => toggleGroupByTipo(loadId)}
                          title="Separar por tipo"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "8px 10px",
                            height: 36,
                            whiteSpace: "nowrap",
                          }}
                        >
                          <span className="material-symbols-outlined">
                            filter_alt
                          </span>
                          <span style={{ fontWeight: 700, fontSize: 13 }}>
                            {groupByTipoByLoadId[loadId]
                              ? "Ver por número"
                              : "Separar por tipo"}
                          </span>
                        </button>
                      </div>

                      {palletsInLoad.length === 0 ? (
                        <div style={{ color: "var(--text-secondary)" }}>
                          Sin palets en esta carga
                        </div>
                      ) : (
                        (() => {
                          const byTipo = !!groupByTipoByLoadId[loadId];
                          const baseSort = (a, b) =>
                            String(a?.numero_palet || "").localeCompare(
                              String(b?.numero_palet || ""),
                              "es",
                              { numeric: true, sensitivity: "base" },
                            );
                          const list = palletsInLoad.slice();
                          if (!byTipo) {
                            return list.sort(baseSort).map((p) => {
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
                              return (
                                <label
                                  key={pid || numero}
                                  style={{
                                    display: "flex",
                                    gap: 10,
                                    alignItems: "flex-start",
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
                                    {productos ? (
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
                                </label>
                              );
                            });
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

                          return keys.flatMap((k) => {
                            const items = grouped.get(k) || [];
                            items.sort(baseSort);
                            const label = tipoLabel(k);
                            const header = (
                              <div
                                key={`header-${k || "sin-tipo"}`}
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
                            );
                            const rows = items.map((p) => {
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
                              return (
                                <label
                                  key={pid || `${k}-${numero}`}
                                  style={{
                                    display: "flex",
                                    gap: 10,
                                    alignItems: "flex-start",
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
                                    {productos ? (
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
                                </label>
                              );
                            });
                            return [header, ...rows];
                          });
                        })()
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
                            (selectedByLoadId[loadId] || []).length === 0 ||
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
        open={reportOpen}
        title="Informe de carga"
        onClose={() => setReportOpen(false)}
        onSubmit={() => finalizeLoad(reportLoadId)}
        submitLabel="Confirmar e informar"
        cancelLabel="Cancelar"
        width={680}
      >
        {(() => {
          const ids = (selectedByLoadId[reportLoadId] || []).map((v) =>
            String(v),
          );
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
          <div>
            <div className="label">Cargado por</div>
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
          </div>

          <div>
            <div className="label">Chofer</div>
            <input
              className="input"
              value={reportChoferName}
              onChange={(e) => setReportChoferName(e.target.value)}
              placeholder="Nombre del chofer"
            />
            <div className="label" style={{ marginTop: 10 }}>
              Consignatario
            </div>
            <input
              className="input"
              value={reportConsignatarioName}
              onChange={(e) => setReportConsignatarioName(e.target.value)}
              placeholder="Nombre del consignatario"
            />
          </div>
        </div>

        <div>
          <div className="label">Notas</div>
          <textarea
            className="input"
            rows="4"
            value={reportNotes}
            onChange={(e) => setReportNotes(e.target.value)}
            placeholder="Incidencias o comentarios"
            style={{ height: "auto", minHeight: 88, resize: "vertical" }}
          />
        </div>
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
