import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Modal from "../components/Modal.jsx";
import Snackbar from "../components/Snackbar.jsx";
import {
  getCurrentRole,
  hasPermission,
  PERMISSIONS,
  getCurrentUser,
} from "../utils/roles.js";
import {
  fetchAllConsignees,
  fetchAllLocations,
  fetchAllPallets,
  fetchAllResponsables,
  fetchAllShips,
  fetchAllUsers,
  deleteLoadById,
  fetchLoadById,
  fusePallets,
  updateLoadById,
} from "../firebase/auth.js";

const ESTADO_VIAJE_OPTIONS = [
  "Preparando",
  "Cargando",
  "Viajando",
  "Entregado",
  "Cancelado",
];
const CARGA_OPTIONS = [
  "Seco",
  "Refrigerado",
  "Congelado",
  "Técnico",
  "Fruta y verdura",
  "Repuestos",
];
const ENTREGA_OPTIONS = ["Provisión", "Repuesto", "Técnico"];

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

function toDateInput(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateLabel(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

function parseNumeroPaletsInput(value) {
  const raw = String(value || "");
  const tokens = raw
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const out = [];
  for (const tok of tokens) {
    const match = tok.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (match) {
      const a = Number(match[1]);
      const b = Number(match[2]);
      if (Number.isFinite(a) && Number.isFinite(b)) {
        const start = Math.min(a, b);
        const end = Math.max(a, b);
        if (end - start <= 500) {
          for (let n = start; n <= end; n += 1) out.push(String(n));
          continue;
        }
      }
    }
    out.push(tok);
  }
  return Array.from(new Set(out));
}

export default function LoadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [load, setLoad] = useState(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [ships, setShips] = useState([]);
  const [pallets, setPallets] = useState([]);
  const [users, setUsers] = useState([]);
  const [responsables, setResponsables] = useState([]);
  const [consignees, setConsignees] = useState([]);
  const [locations, setLocations] = useState([]);
  const [responsableQuery, setResponsableQuery] = useState("");
  const [form, setForm] = useState({
    barco: "",
    entrega: [],
    chofer: "",
    responsable: "",
    consignatario: "",
    terminal_entrega: "",
    palets: [],
    carga: [],
    fecha_de_carga: "",
    hora_de_carga: "",
    fecha_de_descarga: "",
    hora_de_descarga: "",
    cash: false,
    lancha: false,
    estado_viaje: "Preparando",
  });
  const [snack, setSnack] = useState({
    open: false,
    message: "",
    type: "success",
  });
  const [openFuse, setOpenFuse] = useState(false);
  const [fuseMode, setFuseMode] = useState("seleccion");
  const [fuseTargetId, setFuseTargetId] = useState("");
  const [fuseSourceIds, setFuseSourceIds] = useState([]);
  const [fuseNumbers, setFuseNumbers] = useState("");
  const [fuseSubmitting, setFuseSubmitting] = useState(false);
  const [fuseBaseChoice, setFuseBaseChoice] = useState("");
  const [dragPalletId, setDragPalletId] = useState("");
  const [dragPalletTipo, setDragPalletTipo] = useState("");
  const [dragOverPalletId, setDragOverPalletId] = useState("");
  const [openFuseDnD, setOpenFuseDnD] = useState(false);
  const [fuseDnDSourceId, setFuseDnDSourceId] = useState("");
  const [fuseDnDTargetId, setFuseDnDTargetId] = useState("");
  const [fuseDnDBaseChoice, setFuseDnDBaseChoice] = useState("");

  // Carga detalle y precarga formulario
  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        const l = await fetchLoadById(id);
        if (!mounted) return;
        setLoad(l);
        if (!l) return;
        setForm({
          barco: String(l.barco?._id || l.barco || ""),
          entrega: Array.isArray(l.entrega) ? l.entrega : [],
          chofer: String(l.chofer?._id || l.chofer || ""),
          responsable: String(l.responsable?._id || l.responsable || ""),
          consignatario: String(l.consignatario?._id || l.consignatario || ""),
          terminal_entrega: String(
            l.terminal_entrega?._id || l.terminal_entrega || ""
          ),
          palets: Array.isArray(l.palets) ? l.palets.map((p) => String(p)) : [],
          carga: Array.isArray(l.carga) ? l.carga : [],
          fecha_de_carga: toDateInput(l.fecha_de_carga),
          hora_de_carga: l.hora_de_carga || "",
          fecha_de_descarga: toDateInput(l.fecha_de_descarga),
          hora_de_descarga: l.hora_de_descarga || "",
          cash: !!l.cash,
          lancha: !!l.lancha,
          estado_viaje: l.estado_viaje || "Preparando",
        });
      } catch {
        if (!mounted) return;
        setLoad(null);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [id]);

  // Datos auxiliares para selects
  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        const results = await Promise.allSettled([
          fetchAllShips(),
          fetchAllPallets(),
          fetchAllUsers(),
          fetchAllConsignees(),
          fetchAllLocations(),
          fetchAllResponsables(),
        ]);
        const values = results.map((r) =>
          r.status === "fulfilled" && Array.isArray(r.value) ? r.value : []
        );
        const [
          shipsList,
          palletsList,
          usersList,
          consigneesList,
          locationsList,
          responsablesList,
        ] = values;
        if (!mounted) return;
        const normalize = (x) => ({
          ...x,
          _id: x?._id || x?.id,
          id: x?.id || x?._id,
        });
        setShips(shipsList.map(normalize));
        setPallets(palletsList.map(normalize));
        setUsers(usersList.map(normalize));
        setConsignees(consigneesList.map(normalize));
        setLocations(locationsList.map(normalize));
        setResponsables(responsablesList.map(normalize));
      } catch {
        if (!mounted) return;
        setShips([]);
        setPallets([]);
        setUsers([]);
        setConsignees([]);
        setLocations([]);
        setResponsables([]);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, []);

  const currentUser = getCurrentUser();
  const role = getCurrentRole() || currentUser?.role || null;
  const canManageLoads =
    hasPermission(role, PERMISSIONS.MANAGE_LOADS) ||
    String(role || "")
      .trim()
      .toLowerCase() === "dispatcher";
  const canManagePallets =
    hasPermission(role, PERMISSIONS.MANAGE_PALLETS) ||
    canManageLoads ||
    String(role || "")
      .trim()
      .toLowerCase() === "dispatcher";
  const canDeleteLoad =
    String(role || "")
      .trim()
      .toLowerCase() === "dispatcher";

  const handleDelete = async () => {
    if (deleting) return;
    if (!load) return;
    const label = String(load.nombre || "").trim();
    if (
      !window.confirm(
        `¿Seguro que deseas borrar la carga "${label || String(id || "")}"?`
      )
    )
      return;
    try {
      setDeleting(true);
      await deleteLoadById(String(load?._id || load?.id || id));
      navigate("/app/logistica/cargas");
    } catch (e) {
      const msg = String(e?.message || "");
      setSnack({
        open: true,
        message: msg || "Error borrando carga",
        type: "error",
      });
    } finally {
      setDeleting(false);
    }
  };

  const submit = async () => {
    try {
      const payload = {
        barco: form.barco || undefined,
        entrega: form.entrega,
        chofer: form.chofer || undefined,
        responsable: form.responsable || undefined,
        palets: form.palets,
        carga: form.carga,
        consignatario: form.consignatario || undefined,
        terminal_entrega: form.terminal_entrega || undefined,
        fecha_de_carga: form.fecha_de_carga || undefined,
        hora_de_carga: form.hora_de_carga || undefined,
        fecha_de_descarga: form.fecha_de_descarga || undefined,
        hora_de_descarga: form.hora_de_descarga || undefined,
        cash: !!form.cash,
        lancha: !!form.lancha,
        estado_viaje: form.estado_viaje,
        modificado_por: getCurrentUser()?.name || "Testing",
      };
      const updated = await updateLoadById(id, payload);
      if (!updated) {
        setSnack({
          open: true,
          message: "Error actualizando carga",
          type: "error",
        });
        return;
      }
      setLoad(updated);
      setOpen(false);
      setSnack({ open: true, message: "Carga actualizada", type: "success" });
    } catch (e) {
      const msg = String(e?.message || "");
      setSnack({
        open: true,
        message: msg || "Error de red actualizando carga",
        type: "error",
      });
    }
  };

  if (!load) return <p>Cargando...</p>;

  const loadId = String(load?._id || load?.id || id || "");

  const palletsInLoad = (() => {
    const byRelation = pallets.filter(
      (p) => String(p.carga?._id || p.carga) === String(loadId)
    );
    const byArrayIds = Array.isArray(load.palets)
      ? load.palets.map((p) => String(p?._id || p?.id || p)).filter(Boolean)
      : [];
    const byId = new Map(
      byRelation.map((p) => [String(p._id || p.id), p]).filter((p) => p[0])
    );
    byArrayIds.forEach((pid) => {
      const found = pallets.find((p) => String(p._id || p.id) === String(pid));
      if (found) byId.set(String(found._id || found.id), found);
    });
    return Array.from(byId.values());
  })();

  const totalPallets = palletsInLoad.length;
  const tipoCounts = palletsInLoad.reduce((acc, p) => {
    const t = p.tipo || "Sin tipo";
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});
  const baseCounts = palletsInLoad.reduce(
    (acc, p) => {
      const b = String(p?.base || "")
        .trim()
        .toLowerCase();
      if (b === "europeo") acc.europeo += 1;
      if (b === "americano") acc.americano += 1;
      return acc;
    },
    { europeo: 0, americano: 0 }
  );

  const fuseTarget = palletsInLoad.find(
    (p) => String(p._id) === String(fuseTargetId)
  );
  const fuseOthers = palletsInLoad.filter(
    (p) => String(p._id) !== String(fuseTargetId)
  );
  const fuseParsedNumbers = parseNumeroPaletsInput(fuseNumbers);
  const fuseMatchedByNumbers = palletsInLoad.filter(
    (p) =>
      fuseParsedNumbers.includes(String(p.numero_palet)) &&
      String(p._id) !== String(fuseTargetId)
  );
  const fuseMissingNumbers = fuseParsedNumbers.filter(
    (n) =>
      !palletsInLoad.some(
        (p) =>
          String(p.numero_palet) === String(n) &&
          String(p._id) !== String(fuseTargetId)
      )
  );

  const openFuseModal = () => {
    if (palletsInLoad.length < 2) {
      setSnack({
        open: true,
        message: "Necesitas al menos 2 palets para fusionar",
        type: "error",
      });
      return;
    }
    setFuseMode("seleccion");
    setFuseNumbers("");
    setFuseSourceIds([]);
    setFuseTargetId(String(palletsInLoad[0]?._id || ""));
    setFuseBaseChoice(String(palletsInLoad[0]?.base || "").trim());
    setOpenFuse(true);
  };

  const submitFuse = async () => {
    if (fuseSubmitting) return;
    const targetId = String(fuseTargetId || "");
    if (!targetId) {
      setSnack({
        open: true,
        message: "Selecciona un palet destino",
        type: "error",
      });
      return;
    }

    const isSelectMode = fuseMode === "seleccion";
    const sourceIds = isSelectMode ? fuseSourceIds : [];
    const sourceNumbers = !isSelectMode ? fuseParsedNumbers : [];

    if (isSelectMode && sourceIds.length === 0) {
      setSnack({
        open: true,
        message: "Selecciona al menos un palet para fusionar",
        type: "error",
      });
      return;
    }
    if (!isSelectMode && sourceNumbers.length === 0) {
      setSnack({
        open: true,
        message: "Introduce números de palet para fusionar",
        type: "error",
      });
      return;
    }
    if (!isSelectMode && fuseMissingNumbers.length > 0) {
      setSnack({
        open: true,
        message: `Números no encontrados: ${fuseMissingNumbers.join(", ")}`,
        type: "error",
      });
      return;
    }

    const normalizeBase = (value) => {
      const raw = String(value || "").trim();
      if (!raw) return "";
      const lower = raw.toLowerCase();
      if (lower === "europeo") return "Europeo";
      if (lower === "americano") return "Americano";
      return raw;
    };
    const selectedSources = isSelectMode
      ? palletsInLoad.filter((p) =>
          fuseSourceIds.some((sid) => String(sid) === String(p?._id))
        )
      : fuseMatchedByNumbers;
    const baseCandidates = Array.from(
      new Set(
        [
          normalizeBase(fuseTarget?.base),
          ...selectedSources.map((p) => normalizeBase(p?.base)),
        ]
          .map((v) => String(v || "").trim())
          .filter(Boolean)
      )
    );
    const needsBaseChoice = baseCandidates.length > 1;
    const effectiveBaseChoice = normalizeBase(fuseBaseChoice);
    if (needsBaseChoice && !effectiveBaseChoice) {
      setSnack({
        open: true,
        message: `Elige base (${baseCandidates.join(" o ")}) para fusionar`,
        type: "error",
      });
      return;
    }

    if (!window.confirm("¿Seguro que quieres fusionar estos palets?")) return;

    try {
      setFuseSubmitting(true);
      await fusePallets({
        mode: isSelectMode ? "ids" : "numbers",
        targetPalletId: targetId,
        sourcePalletIds: isSelectMode ? sourceIds : undefined,
        sourcePalletNumbers: !isSelectMode ? sourceNumbers : undefined,
        baseChoice: needsBaseChoice ? effectiveBaseChoice : undefined,
        modificado_por: getCurrentUser()?.name || "Testing",
      });

      const [l, palletsList] = await Promise.all([
        fetchLoadById(id),
        fetchAllPallets(),
      ]);
      setLoad(l);
      setPallets(
        palletsList.map((x) => ({
          ...x,
          _id: x?._id || x?.id,
          id: x?.id || x?._id,
        }))
      );
      if (l) {
        setForm({
          barco: String(l.barco?._id || l.barco || ""),
          entrega: Array.isArray(l.entrega) ? l.entrega : [],
          chofer: String(l.chofer?._id || l.chofer || ""),
          responsable: String(l.responsable?._id || l.responsable || ""),
          consignatario: String(l.consignatario?._id || l.consignatario || ""),
          terminal_entrega: String(
            l.terminal_entrega?._id || l.terminal_entrega || ""
          ),
          palets: Array.isArray(l.palets) ? l.palets.map((p) => String(p)) : [],
          carga: Array.isArray(l.carga) ? l.carga : [],
          fecha_de_carga: toDateInput(l.fecha_de_carga),
          hora_de_carga: l.hora_de_carga || "",
          fecha_de_descarga: toDateInput(l.fecha_de_descarga),
          hora_de_descarga: l.hora_de_descarga || "",
          cash: !!l.cash,
          lancha: !!l.lancha,
          estado_viaje: l.estado_viaje || "Preparando",
        });
      }

      setOpenFuse(false);
      setSnack({ open: true, message: "Palets fusionados", type: "success" });
    } catch (e) {
      const msg = String(e?.message || "");
      setSnack({
        open: true,
        message: msg || "Error de red fusionando palets",
        type: "error",
      });
    } finally {
      setFuseSubmitting(false);
    }
  };

  const canDnDFuseTo = (targetPallet) => {
    if (!dragPalletId) return false;
    if (!targetPallet?._id) return false;
    if (String(targetPallet._id) === String(dragPalletId)) return false;
    return String(targetPallet.tipo || "") === String(dragPalletTipo || "");
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

  const submitFuseDnD = async () => {
    if (fuseSubmitting) return;
    const targetId = String(fuseDnDTargetId || "");
    const sourceId = String(fuseDnDSourceId || "");
    if (!targetId || !sourceId) {
      closeFuseDnD();
      return;
    }

    const normalizeBase = (value) => {
      const raw = String(value || "").trim();
      if (!raw) return "";
      const lower = raw.toLowerCase();
      if (lower === "europeo") return "Europeo";
      if (lower === "americano") return "Americano";
      return raw;
    };
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

      const [l, palletsList] = await Promise.all([
        fetchLoadById(id),
        fetchAllPallets(),
      ]);
      setLoad(l);
      setPallets(
        palletsList.map((x) => ({
          ...x,
          _id: x?._id || x?.id,
          id: x?.id || x?._id,
        }))
      );
      if (l) {
        setForm({
          barco: String(l.barco || ""),
          entrega: Array.isArray(l.entrega) ? l.entrega : [],
          chofer: String(l.chofer || ""),
          responsable: String(l.responsable || ""),
          consignatario: String(l.consignatario || ""),
          terminal_entrega: String(l.terminal_entrega || ""),
          palets: Array.isArray(l.palets) ? l.palets.map((p) => String(p)) : [],
          carga: Array.isArray(l.carga) ? l.carga : [],
          fecha_de_carga: toDateInput(l.fecha_de_carga),
          hora_de_carga: l.hora_de_carga || "",
          fecha_de_descarga: toDateInput(l.fecha_de_descarga),
          hora_de_descarga: l.hora_de_descarga || "",
          cash: !!l.cash,
          lancha: !!l.lancha,
          estado_viaje: l.estado_viaje || "Preparando",
        });
      }

      setSnack({ open: true, message: "Palets fusionados", type: "success" });
      closeFuseDnD();
    } catch (e) {
      const msg = String(e?.message || "");
      setSnack({
        open: true,
        message: msg || "Error de red fusionando palets",
        type: "error",
      });
    } finally {
      setFuseSubmitting(false);
    }
  };

  const fuseDnDSource = palletsInLoad.find(
    (p) => String(p._id) === String(fuseDnDSourceId)
  );
  const fuseDnDTarget = palletsInLoad.find(
    (p) => String(p._id) === String(fuseDnDTargetId)
  );

  const shipById = new Map(
    ships.map((s) => [String(s._id || s.id || ""), s]).filter((p) => p[0])
  );
  const userById = new Map(
    users.map((u) => [String(u._id || u.id || ""), u]).filter((p) => p[0])
  );
  const consigneeById = new Map(
    consignees.map((c) => [String(c._id || c.id || ""), c]).filter((p) => p[0])
  );
  const locationById = new Map(
    locations.map((l) => [String(l._id || l.id || ""), l]).filter((p) => p[0])
  );

  const barcoId = String(load?.barco?._id || load?.barco || "");
  const choferId = String(load?.chofer?._id || load?.chofer || "");
  const consignatarioId = String(
    load?.consignatario?._id || load?.consignatario || ""
  );
  const terminalEntregaId = String(
    load?.terminal_entrega?._id || load?.terminal_entrega || ""
  );

  const barcoObj =
    shipById.get(barcoId) ||
    (load?.barco && typeof load.barco === "object" ? load.barco : null);
  const choferObj =
    userById.get(choferId) ||
    (load?.chofer && typeof load.chofer === "object" ? load.chofer : null);
  const consignatarioObj =
    consigneeById.get(consignatarioId) ||
    (load?.consignatario && typeof load.consignatario === "object"
      ? load.consignatario
      : null);
  const terminalEntregaObj =
    locationById.get(terminalEntregaId) ||
    (load?.terminal_entrega && typeof load.terminal_entrega === "object"
      ? load.terminal_entrega
      : null);

  return (
    <section className="card">
      <div className="card-header">
        <h2 className="card-title">Detalle carga</h2>
        <div style={{ display: "flex", gap: 8 }}>
          {canManageLoads && (
            <button
              className="icon-button"
              onClick={() => {
                setResponsableQuery("");
                setOpen(true);
              }}
              title="Modificar"
            >
              <span className="material-symbols-outlined">edit</span>
            </button>
          )}
          {canManagePallets && (
            <button
              className="icon-button"
              onClick={openFuseModal}
              title="Fusionar palets"
            >
              <span className="material-symbols-outlined">call_merge</span>
            </button>
          )}
          <button
            className="icon-button"
            onClick={() =>
              navigate("/app/palets", { state: { createPalletForCarga: id } })
            }
            title="Crear palet"
          >
            <span className="material-symbols-outlined">add_box</span>
          </button>
          {canDeleteLoad && (
            <button
              className="icon-button"
              onClick={handleDelete}
              title="Borrar carga"
              disabled={deleting}
            >
              <span className="material-symbols-outlined">delete</span>
            </button>
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
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            columnGap: 16,
            rowGap: 6,
            alignItems: "start",
          }}
        >
          <div>
            <strong>Barco:</strong> {barcoObj?.nombre_del_barco || "-"}
          </div>
          <div>
            <strong>Entrega:</strong>{" "}
            {Array.isArray(load.entrega) ? load.entrega.join(", ") : ""}
          </div>
          <div>
            <strong>Chofer:</strong> {choferObj?.name || "-"}
          </div>
          <div>
            <strong>Consignatario:</strong> {consignatarioObj?.nombre || "-"}
          </div>
          <div>
            <strong>Terminal entrega:</strong>{" "}
            {terminalEntregaObj
              ? (terminalEntregaObj.puerto
                  ? `${terminalEntregaObj.puerto} · `
                  : "") + (terminalEntregaObj.nombre || "-")
              : "-"}
          </div>
          <div>
            <strong>Palets de carga:</strong> {totalPallets}
          </div>
          <div>
            <strong>Estado viaje:</strong> {load.estado_viaje}
          </div>
          <div>
            <strong>Fecha de carga:</strong>{" "}
            {formatDateLabel(load.fecha_de_carga)}
            {load.hora_de_carga ? `, ${load.hora_de_carga}` : ""}
          </div>
          <div>
            <strong>Fecha de descarga:</strong>{" "}
            {formatDateLabel(load.fecha_de_descarga)}
            {load.hora_de_descarga ? `, ${load.hora_de_descarga}` : ""}
          </div>
          <div>
            <strong>Cash:</strong> {load.cash ? "Sí" : "No"}
          </div>
        </div>

        <div className="card" style={{ marginTop: 12 }}>
          <div className="card-header">
            <h3 className="card-title">Resumen palets</h3>
          </div>
          <div style={{ padding: 12 }}>
            <p>
              <strong>Total palets:</strong> {totalPallets}
            </p>
            {Object.keys(tipoCounts).length > 0 ? (
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  flexWrap: "wrap",
                  marginTop: 6,
                }}
              >
                {Object.entries(tipoCounts).map(([tipo, count]) => (
                  <span
                    key={tipo}
                    style={{
                      background: "#eef2f7",
                      borderRadius: 6,
                      padding: "4px 8px",
                    }}
                  >
                    {tipo}: {count}
                  </span>
                ))}
              </div>
            ) : (
              <p style={{ color: "var(--text-secondary)" }}>Sin tipos</p>
            )}

            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                marginTop: 8,
              }}
            >
              <span
                style={{
                  background: "#eef2f7",
                  borderRadius: 6,
                  padding: "4px 8px",
                }}
              >
                Europeo: {baseCounts.europeo}
              </span>
              <span
                style={{
                  background: "#eef2f7",
                  borderRadius: 6,
                  padding: "4px 8px",
                }}
              >
                Americano: {baseCounts.americano}
              </span>
            </div>

            <div style={{ marginTop: 14 }}>
              {palletsInLoad.length === 0 ? (
                <div style={{ color: "var(--text-secondary)" }}>
                  Sin palets asociados
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 12,
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
                    const isDroppable = isDragging && canDnDFuseTo(p);
                    const isDisabled = isDragging && !isSource && !isDroppable;
                    const isOver =
                      isDroppable &&
                      idStr &&
                      String(idStr) === String(dragOverPalletId);
                    const numero = String(p?.numero_palet || "").trim();
                    const nombre = String(p?.nombre || "").trim();
                    const tipo = String(p?.tipo || "").trim();
                    const base = String(p?.base || "").trim();
                    const isAmericano =
                      base.trim().toLowerCase() === "americano";
                    const colors = getTipoColors(tipo);
                    const accent = isAmericano ? colors.strong : colors.color;
                    const avatarText = (() => {
                      if (nombre && !nombre.includes(" - ")) return nombre;
                      if (numero) return numero;
                      if (nombre) return nombre.split(" - ")[0];
                      return "?";
                    })();
                    const title = (() => {
                      const n = String(p?.nombre || "").trim();
                      if (n) return n;
                      if (numero) return numero;
                      return "Palet";
                    })();
                    const subtitle = [tipo, base].filter(Boolean).join(" · ");
                    return (
                      <div
                        key={pid || `${numero || nombre}`}
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
                          filter: isDisabled ? "grayscale(1)" : "none",
                          background: isOver ? "var(--hover)" : undefined,
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
                          setFuseDnDBaseChoice(String(base || "").trim());
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
                            <div className="card-item-sub">
                              {subtitle || " "}
                            </div>
                          </div>
                        </div>
                        <div className="card-item-meta">
                          {tipo && <span className="chip">{tipo}</span>}
                          {base && <span className="chip">{base}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

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
          const normalizeBase = (value) => {
            const raw = String(value || "").trim();
            if (!raw) return "";
            const lower = raw.toLowerCase();
            if (lower === "europeo") return "Europeo";
            if (lower === "americano") return "Americano";
            return raw;
          };
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
        open={openFuse}
        title="Fusionar palets"
        onClose={() => setOpenFuse(false)}
        onSubmit={submitFuse}
        submitLabel="Fusionar"
        width={720}
        bodyStyle={{
          gridTemplateColumns: "1fr",
          maxHeight: "80vh",
          overflow: "auto",
        }}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => {
              setFuseMode("seleccion");
              setFuseNumbers("");
              setFuseSourceIds([]);
            }}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: fuseMode === "seleccion" ? "var(--hover)" : "#fff",
              cursor: "pointer",
              fontWeight: fuseMode === "seleccion" ? 600 : 500,
            }}
          >
            Selección
          </button>
          <button
            onClick={() => {
              setFuseMode("numeros");
              setFuseSourceIds([]);
            }}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: fuseMode === "numeros" ? "var(--hover)" : "#fff",
              cursor: "pointer",
              fontWeight: fuseMode === "numeros" ? 600 : 500,
            }}
          >
            Números
          </button>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <div className="label">Palet destino</div>
          <select
            className="input"
            value={fuseTargetId}
            onChange={(e) => {
              const nextTarget = e.target.value;
              setFuseTargetId(nextTarget);
              setFuseSourceIds((prev) =>
                prev.filter((pid) => String(pid) !== String(nextTarget))
              );
            }}
          >
            {palletsInLoad.map((p) => (
              <option key={p._id} value={p._id}>
                {p.numero_palet}
                {p.tipo ? ` · ${p.tipo}` : ""}
                {p.base ? ` · ${p.base}` : ""}
              </option>
            ))}
          </select>
          <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>
            {fuseTarget
              ? `Destino: ${fuseTarget.numero_palet}${
                  fuseTarget.tipo ? ` · ${fuseTarget.tipo}` : ""
                }`
              : ""}
          </div>
        </div>

        {(() => {
          const normalizeBase = (value) => {
            const raw = String(value || "").trim();
            if (!raw) return "";
            const lower = raw.toLowerCase();
            if (lower === "europeo") return "Europeo";
            if (lower === "americano") return "Americano";
            return raw;
          };
          const selectedSources =
            fuseMode === "seleccion"
              ? palletsInLoad.filter((p) =>
                  fuseSourceIds.some((sid) => String(sid) === String(p?._id))
                )
              : fuseMatchedByNumbers;
          const baseCandidates = Array.from(
            new Set(
              [
                normalizeBase(fuseTarget?.base),
                ...selectedSources.map((p) => normalizeBase(p?.base)),
              ]
                .map((v) => String(v || "").trim())
                .filter(Boolean)
            )
          );
          if (baseCandidates.length <= 1) return null;
          const value =
            normalizeBase(fuseBaseChoice) ||
            normalizeBase(fuseTarget?.base) ||
            baseCandidates[0] ||
            "";
          return (
            <div style={{ display: "grid", gap: 8 }}>
              <div className="label">Base final</div>
              <select
                className="select"
                value={value}
                onChange={(e) => setFuseBaseChoice(e.target.value)}
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

        {fuseMode === "seleccion" ? (
          <div style={{ display: "grid", gap: 8 }}>
            <div className="label">Palets a fusionar</div>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={
                  fuseOthers.length > 0 &&
                  fuseSourceIds.length === fuseOthers.length
                }
                onChange={(e) => {
                  if (e.target.checked) {
                    setFuseSourceIds(fuseOthers.map((p) => String(p._id)));
                  } else {
                    setFuseSourceIds([]);
                  }
                }}
              />
              Seleccionar todos
            </label>
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: 10,
                maxHeight: "55vh",
                overflowY: "scroll",
                scrollbarGutter: "stable",
                overscrollBehavior: "contain",
                WebkitOverflowScrolling: "touch",
                touchAction: "pan-y",
              }}
            >
              {fuseOthers.map((p) => {
                const checked = fuseSourceIds.some(
                  (pid) => String(pid) === String(p._id)
                );
                return (
                  <label
                    key={p._id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      padding: "6px 0",
                      borderBottom: "1px solid #f1f3f4",
                    }}
                  >
                    <span
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          setFuseSourceIds((prev) => {
                            const next = new Set(prev.map((v) => String(v)));
                            const idStr = String(p._id);
                            if (isChecked) next.add(idStr);
                            else next.delete(idStr);
                            return Array.from(next);
                          });
                        }}
                      />
                      <span>
                        {p.numero_palet}
                        {p.tipo ? ` · ${p.tipo}` : ""}
                        {p.base ? ` · ${p.base}` : ""}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>
              Seleccionados: {fuseSourceIds.length}
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            <div className="label">Números de palet a fusionar</div>
            <textarea
              className="input"
              style={{ height: 110, resize: "vertical" }}
              placeholder="Ej: 12 13 14 o 12,13,14 o 12-20"
              value={fuseNumbers}
              onChange={(e) => setFuseNumbers(e.target.value)}
            />
            <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>
              Encontrados: {fuseMatchedByNumbers.length}
              {fuseMissingNumbers.length > 0
                ? ` · No encontrados: ${fuseMissingNumbers.join(", ")}`
                : ""}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={open}
        title="Modificar carga"
        onClose={() => setOpen(false)}
        onSubmit={submit}
        submitLabel="Guardar"
        width={640}
        bodyStyle={{ gridTemplateColumns: "1fr" }}
      >
        <div style={{ display: "grid", gap: 12 }}>
          {/* Datos básicos */}
          <div style={{ display: "grid", gap: 8 }}>
            <div className="label">Barco</div>
            <select
              className="input"
              value={form.barco}
              onChange={(e) => setForm({ ...form, barco: e.target.value })}
            >
              <option value="">Selecciona barco</option>
              {ships.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.nombre_del_barco}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <div className="label">Fecha y hora de carga</div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              <input
                type="date"
                className="input"
                value={form.fecha_de_carga}
                onChange={(e) =>
                  setForm({ ...form, fecha_de_carga: e.target.value })
                }
              />
              <input
                type="time"
                className="input"
                value={form.hora_de_carga}
                onChange={(e) =>
                  setForm({ ...form, hora_de_carga: e.target.value })
                }
              />
            </div>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <div className="label">Fecha y hora de descarga</div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              <input
                type="date"
                className="input"
                value={form.fecha_de_descarga}
                onChange={(e) =>
                  setForm({ ...form, fecha_de_descarga: e.target.value })
                }
              />
              <input
                type="time"
                className="input"
                value={form.hora_de_descarga}
                onChange={(e) =>
                  setForm({ ...form, hora_de_descarga: e.target.value })
                }
              />
            </div>
          </div>

          {/* Entrega */}
          <div style={{ display: "grid", gap: 8 }}>
            <div className="label">Entrega</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {ENTREGA_OPTIONS.map((opt) => (
                <label
                  key={opt}
                  style={{ display: "flex", alignItems: "center", gap: 4 }}
                >
                  <input
                    type="checkbox"
                    checked={form.entrega.includes(opt)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...form.entrega, opt]
                        : form.entrega.filter((v) => v !== opt);
                      setForm({ ...form, entrega: next });
                    }}
                  />
                  {opt}
                </label>
              ))}
            </div>
          </div>

          {/* Personas */}
          <div style={{ display: "grid", gap: 6 }}>
            <div className="label">Responsable</div>
            <input
              className="input"
              value={responsableQuery}
              onChange={(e) => setResponsableQuery(e.target.value)}
              placeholder="Buscar responsable por nombre"
            />
            <select
              className="input"
              value={form.responsable}
              onChange={(e) =>
                setForm({ ...form, responsable: e.target.value })
              }
            >
              <option value="">Sin responsable</option>
              {responsables
                .filter((r) => {
                  const q = String(responsableQuery || "")
                    .trim()
                    .toLowerCase();
                  if (!q) return true;
                  return String(r.nombre || "")
                    .toLowerCase()
                    .includes(q);
                })
                .sort((a, b) =>
                  String(a.nombre || "").localeCompare(
                    String(b.nombre || ""),
                    "es"
                  )
                )
                .map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.nombre}
                    {r.email ? ` (${r.email})` : ""}
                  </option>
                ))}
            </select>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <div className="label">Chofer</div>
            <select
              className="input"
              value={form.chofer}
              onChange={(e) => setForm({ ...form, chofer: e.target.value })}
            >
              <option value="">Sin chofer</option>
              {users
                .filter((u) => u.role === "driver")
                .map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name} ({u.email})
                  </option>
                ))}
            </select>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <div className="label">Consignatario</div>
            <select
              className="input"
              value={form.consignatario}
              onChange={(e) =>
                setForm({ ...form, consignatario: e.target.value })
              }
            >
              <option value="">Sin consignatario</option>
              {consignees.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.nombre}
                  {c.email ? ` (${c.email})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <div className="label">Terminal de entrega</div>
            <select
              className="input"
              value={form.terminal_entrega}
              onChange={(e) =>
                setForm({ ...form, terminal_entrega: e.target.value })
              }
            >
              <option value="">Sin terminal</option>
              {(() => {
                const groups = {};
                locations.forEach((l) => {
                  const port =
                    String(l.puerto || "Sin puerto").trim() || "Sin puerto";
                  if (!groups[port]) groups[port] = [];
                  groups[port].push(l);
                });
                const sortedPorts = Object.keys(groups).sort((a, b) =>
                  a.localeCompare(b, "es")
                );
                return sortedPorts.map((port) => (
                  <optgroup key={port} label={port}>
                    {groups[port]
                      .slice()
                      .sort((a, b) =>
                        String(a.nombre || "").localeCompare(
                          String(b.nombre || ""),
                          "es"
                        )
                      )
                      .map((l) => (
                        <option key={l._id} value={l._id}>
                          {l.nombre}
                          {l.ciudad ? ` (${l.ciudad})` : ""}
                        </option>
                      ))}
                  </optgroup>
                ));
              })()}
            </select>
          </div>

          {/* Palets */}
          <div style={{ display: "grid", gap: 8 }}>
            <div className="label">Palets</div>
            <select
              multiple
              className="input"
              value={form.palets}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions).map(
                  (o) => o.value
                );
                setForm({ ...form, palets: selected });
              }}
            >
              {pallets.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.numero_palet} ({p.tipo})
                </option>
              ))}
            </select>
          </div>

          {/* Tipo de carga */}
          <div style={{ display: "grid", gap: 8 }}>
            <div className="label">Tipo de carga</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {CARGA_OPTIONS.map((opt) => (
                <label
                  key={opt}
                  style={{ display: "flex", alignItems: "center", gap: 4 }}
                >
                  <input
                    type="checkbox"
                    checked={form.carga.includes(opt)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...form.carga, opt]
                        : form.carga.filter((v) => v !== opt);
                      setForm({ ...form, carga: next });
                    }}
                  />
                  {opt}
                </label>
              ))}
            </div>
          </div>

          {/* Opciones */}
          <div style={{ display: "grid", gap: 8 }}>
            <div className="label">Opciones</div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="checkbox"
                  checked={form.lancha}
                  onChange={(e) =>
                    setForm({ ...form, lancha: e.target.checked })
                  }
                />{" "}
                Es lancha
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="checkbox"
                  checked={form.cash}
                  onChange={(e) => setForm({ ...form, cash: e.target.checked })}
                />{" "}
                Cobro en efectivo
              </label>
            </div>
          </div>

          {/* Estado de carga */}
          <div style={{ display: "grid", gap: 8 }}>
            <div className="label">Estado de Carga</div>
            <select
              className="select"
              value={form.estado_viaje}
              onChange={(e) =>
                setForm({ ...form, estado_viaje: e.target.value })
              }
            >
              {ESTADO_VIAJE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>

      <Snackbar
        open={snack.open}
        message={snack.message}
        type={snack.type}
        onClose={() => setSnack({ ...snack, open: false })}
      />
    </section>
  );
}
