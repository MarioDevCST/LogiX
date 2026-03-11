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
        <p>
          <strong>Barco:</strong> {load.barco?.nombre_del_barco || "-"}
        </p>
        <p>
          <strong>Entrega:</strong>{" "}
          {Array.isArray(load.entrega) ? load.entrega.join(", ") : ""}
        </p>
        <p>
          <strong>Chofer:</strong> {load.chofer?.name || "-"}
        </p>
        <p>
          <strong>Consignatario:</strong> {load.consignatario?.nombre || "-"}
        </p>
        <p>
          <strong>Terminal entrega:</strong>{" "}
          {(load.terminal_entrega?.puerto
            ? `${load.terminal_entrega.puerto} · `
            : "") + (load.terminal_entrega?.nombre || "-")}
        </p>
        <p>
          <strong>Palets de carga:</strong> {totalPallets}
        </p>
        <p>
          <strong>Estado viaje:</strong> {load.estado_viaje}
        </p>
        <p>
          <strong>Fecha de carga:</strong>{" "}
          {formatDateLabel(load.fecha_de_carga)}
          {load.hora_de_carga ? `, ${load.hora_de_carga}` : ""}
        </p>
        <p>
          <strong>Fecha de descarga:</strong>{" "}
          {formatDateLabel(load.fecha_de_descarga)}
          {load.hora_de_descarga ? `, ${load.hora_de_descarga}` : ""}
        </p>
        <p>
          <strong>Cash:</strong> {load.cash ? "Sí" : "No"}
        </p>

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
                palletsInLoad.map((p) => (
                  <div
                    key={p._id}
                    className="calendar-item"
                    style={{
                      padding: "10px 12px",
                      minHeight: 56,
                      marginBottom: 8,
                      cursor: "pointer",
                      background: "#f8fafc",
                      borderLeft: "4px solid #9ca3af",
                      display: "flex",
                      alignItems: "center",
                    }}
                    onClick={() => navigate(`/app/palets/${p._id}`)}
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
                ))
              )}
            </div>
          </div>
        </div>
      </div>

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
