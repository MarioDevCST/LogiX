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

const ESTADO_VIAJE_OPTIONS = [
  "Preparando",
  "En Proceso",
  "Cancelado",
  "Entregado",
];
const CARGA_OPTIONS = ["Seco", "Refrigerado", "Congelado", "Técnico"];
const ENTREGA_OPTIONS = ["Provisión", "Alimentación", "Repuesto", "Técnico"];

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
  const [ships, setShips] = useState([]);
  const [pallets, setPallets] = useState([]);
  const [users, setUsers] = useState([]);
  const [consignees, setConsignees] = useState([]);
  const [locations, setLocations] = useState([]);
  const [form, setForm] = useState({
    barco: "",
    entrega: [],
    chofer: "",
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
  const [dragPalletId, setDragPalletId] = useState("");
  const [dragPalletTipo, setDragPalletTipo] = useState("");
  const [dragOverPalletId, setDragOverPalletId] = useState("");
  const [openFuseDnD, setOpenFuseDnD] = useState(false);
  const [fuseDnDSourceId, setFuseDnDSourceId] = useState("");
  const [fuseDnDTargetId, setFuseDnDTargetId] = useState("");

  // Carga detalle y precarga formulario
  useEffect(() => {
    fetch(`/api/loads/${id}`)
      .then((r) => r.json())
      .then((l) => {
        setLoad(l);
        setForm({
          barco: l.barco?._id || "",
          entrega: Array.isArray(l.entrega) ? l.entrega : [],
          chofer: l.chofer?._id || "",
          consignatario: l.consignatario?._id || "",
          terminal_entrega: l.terminal_entrega?._id || "",
          palets: Array.isArray(l.palets) ? l.palets.map((p) => p._id) : [],
          carga: Array.isArray(l.carga) ? l.carga : [],
          fecha_de_carga: toDateInput(l.fecha_de_carga),
          hora_de_carga: l.hora_de_carga || "",
          fecha_de_descarga: toDateInput(l.fecha_de_descarga),
          hora_de_descarga: l.hora_de_descarga || "",
          cash: !!l.cash,
          lancha: !!l.lancha,
          estado_viaje: l.estado_viaje || "Preparando",
        });
      })
      .catch(() => {});
  }, [id]);

  // Datos auxiliares para selects
  useEffect(() => {
    fetch("/api/ships")
      .then((r) => r.json())
      .then(setShips)
      .catch(() => {});
    fetch("/api/pallets")
      .then((r) => r.json())
      .then(setPallets)
      .catch(() => {});
    fetch("/api/users")
      .then((r) => r.json())
      .then(setUsers)
      .catch(() => {});
    fetch("/api/consignees")
      .then((r) => r.json())
      .then(setConsignees)
      .catch(() => {});
    fetch("/api/locations")
      .then((r) => r.json())
      .then(setLocations)
      .catch(() => {});
  }, []);

  const role = getCurrentRole();
  const canManageLoads = hasPermission(role, PERMISSIONS.MANAGE_LOADS);
  const canManagePallets = hasPermission(role, PERMISSIONS.MANAGE_PALLETS);

  const submit = async () => {
    try {
      const payload = {
        barco: form.barco || undefined,
        entrega: form.entrega,
        chofer: form.chofer || undefined,
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

      const res = await fetch(`/api/loads/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSnack({
          open: true,
          message: err.error || "Error actualizando carga",
          type: "error",
        });
        return;
      }
      const updated = await res.json();
      setLoad(updated);
      setOpen(false);
      setSnack({ open: true, message: "Carga actualizada", type: "success" });
    } catch (e) {
      setSnack({
        open: true,
        message: "Error de red actualizando carga",
        type: "error",
      });
    }
  };

  if (!load) return <p>Cargando...</p>;

  // Resumen de palets de esta carga
  const palletsInLoad = Array.isArray(load.palets) ? load.palets : [];
  const totalPallets = palletsInLoad.length;
  const tipoCounts = palletsInLoad.reduce((acc, p) => {
    const t = p.tipo || "Sin tipo";
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});

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
    if (!window.confirm("¿Seguro que quieres fusionar estos palets?")) return;

    try {
      setFuseSubmitting(true);
      const res = await fetch("/api/pallets/fuse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: isSelectMode ? "ids" : "numbers",
          targetPalletId: targetId,
          sourcePalletIds: isSelectMode ? sourceIds : undefined,
          sourcePalletNumbers: !isSelectMode ? sourceNumbers : undefined,
          modificado_por: getCurrentUser()?.name || "Testing",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSnack({
          open: true,
          message: err.error || "Error fusionando palets",
          type: "error",
        });
        return;
      }

      const loadRes = await fetch(`/api/loads/${id}`);
      if (loadRes.ok) {
        const l = await loadRes.json();
        setLoad(l);
        setForm({
          barco: l.barco?._id || "",
          entrega: Array.isArray(l.entrega) ? l.entrega : [],
          chofer: l.chofer?._id || "",
          consignatario: l.consignatario?._id || "",
          terminal_entrega: l.terminal_entrega?._id || "",
          palets: Array.isArray(l.palets) ? l.palets.map((p) => p._id) : [],
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
      setSnack({
        open: true,
        message: "Error de red fusionando palets",
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

    try {
      setFuseSubmitting(true);
      const res = await fetch("/api/pallets/fuse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "ids",
          targetPalletId: targetId,
          sourcePalletIds: [sourceId],
          modificado_por: getCurrentUser()?.name || "Testing",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSnack({
          open: true,
          message: err.error || "Error fusionando palets",
          type: "error",
        });
        return;
      }

      const loadRes = await fetch(`/api/loads/${id}`);
      if (loadRes.ok) {
        const l = await loadRes.json();
        setLoad(l);
        setForm({
          barco: l.barco?._id || "",
          entrega: Array.isArray(l.entrega) ? l.entrega : [],
          chofer: l.chofer?._id || "",
          consignatario: l.consignatario?._id || "",
          terminal_entrega: l.terminal_entrega?._id || "",
          palets: Array.isArray(l.palets) ? l.palets.map((p) => p._id) : [],
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
      setSnack({
        open: true,
        message: "Error de red fusionando palets",
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

  return (
    <section className="card">
      <div className="card-header">
        <h2 className="card-title">Detalle carga</h2>
        <div style={{ display: "flex", gap: 8 }}>
          {canManageLoads && (
            <button
              className="icon-button"
              onClick={() => setOpen(true)}
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
            <strong>Barco:</strong> {load.barco?.nombre_del_barco || "-"}
          </div>
          <div>
            <strong>Entrega:</strong>{" "}
            {Array.isArray(load.entrega) ? load.entrega.join(", ") : ""}
          </div>
          <div>
            <strong>Chofer:</strong> {load.chofer?.name || "-"}
          </div>
          <div>
            <strong>Consignatario:</strong> {load.consignatario?.nombre || "-"}
          </div>
          <div>
            <strong>Terminal entrega:</strong>{" "}
            {(load.terminal_entrega?.puerto
              ? `${load.terminal_entrega.puerto} · `
              : "") + (load.terminal_entrega?.nombre || "-")}
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

        {/* Resumen por tipo y listado de palets */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            marginTop: 12,
          }}
        >
          <div className="card">
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
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Palets de la carga</h3>
            </div>
            <div style={{ padding: 12 }}>
              {palletsInLoad.length === 0 ? (
                <div style={{ color: "var(--text-secondary)" }}>
                  Sin palets asociados
                </div>
              ) : (
                palletsInLoad.map((p) => {
                  const idStr = String(p._id);
                  const isDragging = !!dragPalletId;
                  const isSource = isDragging && idStr === String(dragPalletId);
                  const isDroppable = isDragging && canDnDFuseTo(p);
                  const isDisabled = isDragging && !isSource && !isDroppable;
                  const isOver =
                    isDroppable && idStr === String(dragOverPalletId);

                  return (
                    <div
                      key={p._id}
                      className="calendar-item"
                      draggable={canManagePallets}
                      style={{
                        padding: "10px 12px",
                        minHeight: 56,
                        marginBottom: 8,
                        cursor: isDragging
                          ? isSource
                            ? "grabbing"
                            : isDroppable
                            ? "copy"
                            : "not-allowed"
                          : "pointer",
                        background: isOver ? "var(--hover)" : "#f8fafc",
                        borderLeft: `4px solid ${
                          isOver ? "var(--brand-blue)" : "#9ca3af"
                        }`,
                        display: "flex",
                        alignItems: "center",
                        opacity: isDisabled ? 0.45 : 1,
                        filter: isDisabled ? "grayscale(1)" : "none",
                      }}
                      onDragStart={(e) => {
                        if (!canManagePallets) return;
                        e.dataTransfer.effectAllowed = "copy";
                        setDragPalletId(idStr);
                        setDragPalletTipo(String(p.tipo || ""));
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
                        setFuseDnDTargetId(idStr);
                        setOpenFuseDnD(true);
                        setDragPalletId("");
                        setDragPalletTipo("");
                        setDragOverPalletId("");
                      }}
                      onClick={() => {
                        if (dragPalletId) return;
                        navigate(`/app/palets/${p._id}`);
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "center",
                        }}
                      >
                        <div style={{ fontSize: 18, lineHeight: "22px" }}>
                          <strong>{p.nombre || p.numero_palet}</strong>
                        </div>
                        <div style={{ color: "var(--text-secondary)" }}>
                          {p.tipo}
                          {p.createdAt || p.fecha_creacion
                            ? ` · ${formatDateLabel(
                                p.createdAt || p.fecha_creacion
                              )}`
                            : ""}
                        </div>
                        {p.contenedor && (
                          <div
                            style={{
                              marginTop: 4,
                              color: "var(--text-secondary)",
                            }}
                          >
                            Contenedor: {p.contenedor}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
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

          {/* Estado del viaje */}
          <div style={{ display: "grid", gap: 8 }}>
            <div className="label">Estado del viaje</div>
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
