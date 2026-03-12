import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import DataTable from "../components/DataTable.jsx";
import CardGrid from "../components/CardGrid.jsx";
import Modal from "../components/Modal.jsx";
import Snackbar from "../components/Snackbar.jsx";
import Pagination from "../components/Pagination.jsx";
import Calendar from "../components/Calendar.jsx";
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

export default function Loads() {
  const allColumns = useMemo(
    () => [
      { key: "nombre", header: "Nombre" },
      { key: "barco", header: "Barco" },
      { key: "entrega", header: "Entrega" },
      { key: "chofer", header: "Chofer" },
      { key: "consignatario", header: "Consignatario" },
      { key: "terminal_entrega", header: "Terminal entrega" },
      { key: "carga", header: "Tipo de carga" },
      { key: "total_palets", header: "Palets" },
      { key: "estado_viaje", header: "Estado viaje" },
      { key: "cash", header: "Cash" },
      { key: "lancha", header: "Lancha" },
      { key: "fecha_de_carga", header: "Fecha de carga" },
      { key: "hora_de_carga", header: "Hora de carga" },
      { key: "fecha_de_descarga", header: "Fecha de descarga" },
      { key: "hora_de_descarga", header: "Hora de descarga" },
      { key: "estado_carga", header: "Carga completa" },
    ],
    []
  );

  const navigate = useNavigate();
  const [view, setView] = useState("table");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
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
  const [ships, setShips] = useState([]);
  const [pallets, setPallets] = useState([]);
  const [users, setUsers] = useState([]);
  const [consignees, setConsignees] = useState([]);
  const [locations, setLocations] = useState([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [snack, setSnack] = useState({
    open: false,
    message: "",
    type: "success",
  });

  // Filtros y agrupación
  const [estadoFilter, setEstadoFilter] = useState("");
  const [entregaFilter, setEntregaFilter] = useState("");
  const [barcoFilter, setBarcoFilter] = useState("");
  const [groupBy, setGroupBy] = useState("none");
  const columnsMenuRef = useRef(null);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const allColumnKeys = useMemo(
    () => allColumns.map((c) => c.key),
    [allColumns]
  );
  const [visibleColumnKeys, setVisibleColumnKeys] = useState(() => {
    try {
      const raw = localStorage.getItem("loads_table_columns");
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (e) {
      void e;
    }
    return allColumnKeys;
  });
  useEffect(() => {
    try {
      localStorage.setItem(
        "loads_table_columns",
        JSON.stringify(visibleColumnKeys)
      );
    } catch {
      return;
    }
  }, [visibleColumnKeys]);

  useEffect(() => {
    if (!columnsOpen) return undefined;
    const onDown = (e) => {
      const el = columnsMenuRef.current;
      if (!el) return;
      if (el.contains(e.target)) return;
      setColumnsOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [columnsOpen]);

  // mes de calendario
  const [calMonth, setCalMonth] = useState(() => new Date());
  const [calMode, setCalMode] = useState("month");
  const prevPeriod = () =>
    setCalMonth((d) =>
      calMode === "week"
        ? new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7)
        : new Date(d.getFullYear(), d.getMonth() - 1, 1)
    );
  const nextPeriod = () =>
    setCalMonth((d) =>
      calMode === "week"
        ? new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7)
        : new Date(d.getFullYear(), d.getMonth() + 1, 1)
    );

  // nuevos estados base para recomputar filas con palets
  const [loadDocs, setLoadDocs] = useState([]);

  // modales de creación rápida
  const [openCreateShip, setOpenCreateShip] = useState(false);
  const [shipForm, setShipForm] = useState({
    nombre_del_barco: "",
    empresa: "",
  });
  const [openCreateUser, setOpenCreateUser] = useState(false);
  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "consignee",
  });
  const [openCreatePallet, setOpenCreatePallet] = useState(false);
  const [palletForm, setPalletForm] = useState({
    numero_palet: "",
    tipo: "Seco",
    base: "Europeo",
  });

  useEffect(() => {
    setLoading(true);
    fetch("/api/loads")
      .then((r) => r.json())
      .then(setLoadDocs)
      .catch(() => {})
      .finally(() => setLoading(false));
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

  const onCreate = () => {
    if (!canManageLoads) {
      setSnack({
        open: true,
        message: "No tienes permiso para crear cargas",
        type: "error",
      });
      return;
    }
    setOpen(true);
  };

  const submit = async () => {
    try {
      if (!form.barco || !form.fecha_de_carga) {
        setSnack({
          open: true,
          message: "Barco y Fecha de Carga son obligatorios",
          type: "error",
        });
        return;
      }
      const payload = {
        barco: form.barco,
        entrega: form.entrega,
        chofer: form.chofer || undefined,
        consignatario: form.consignatario || undefined,
        terminal_entrega: form.terminal_entrega || undefined,
        palets: form.palets,
        carga: form.carga,
        fecha_de_carga: form.fecha_de_carga || undefined,
        hora_de_carga: form.hora_de_carga || undefined,
        fecha_de_descarga: form.fecha_de_descarga || undefined,
        hora_de_descarga: form.hora_de_descarga || undefined,
        cash: !!form.cash,
        lancha: !!form.lancha,
        estado_viaje: form.estado_viaje,
        creado_por: getCurrentUser()?.name || "Testing",
      };
      const res = await fetch("/api/loads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSnack({
          open: true,
          message: err.error || "Error creando carga",
          type: "error",
        });
        return;
      }
      const created = await res.json();
      setLoadDocs((prev) => [...prev, created]);
      setOpen(false);
      setForm({
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
      setSnack({ open: true, message: "Carga creada", type: "success" });
    } catch (e) {
      setSnack({
        open: true,
        message: "Error de red creando carga",
        type: "error",
      });
    }
  };

  const createShip = async () => {
    try {
      if (!shipForm.nombre_del_barco) {
        setSnack({
          open: true,
          message: "El nombre del barco es obligatorio",
          type: "error",
        });
        return;
      }
      const res = await fetch("/api/ships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...shipForm,
          creado_por: getCurrentUser()?.name || "Testing",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSnack({
          open: true,
          message: err.error || "Error creando barco",
          type: "error",
        });
        return;
      }
      const created = await res.json();
      setShips((prev) => [...prev, created]);
      setOpenCreateShip(false);
      setShipForm({ nombre_del_barco: "", empresa: "" });
      setSnack({ open: true, message: "Barco creado", type: "success" });
    } catch (e) {
      setSnack({
        open: true,
        message: "Error de red creando barco",
        type: "error",
      });
    }
  };

  const createUser = async () => {
    try {
      if (!userForm.name || !userForm.email || !userForm.role) {
        setSnack({
          open: true,
          message: "Nombre, email y rol son obligatorios",
          type: "error",
        });
        return;
      }
      // Si el rol es consignatario, la contraseña es opcional
      if (userForm.role !== "consignee" && !userForm.password) {
        setSnack({
          open: true,
          message: "La contraseña es obligatoria para este rol",
          type: "error",
        });
        return;
      }
      const body = {
        name: userForm.name,
        email: userForm.email,
        role: userForm.role,
        creado_por: getCurrentUser()?.name || "Testing",
      };
      if (userForm.password) body.password = userForm.password;
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSnack({
          open: true,
          message: err.error || "Error creando usuario",
          type: "error",
        });
        return;
      }
      const created = await res.json();
      setUsers((prev) => [...prev, created]);
      setOpenCreateUser(false);
      setUserForm({ name: "", email: "", password: "", role: "consignee" });
      setSnack({ open: true, message: "Usuario creado", type: "success" });
    } catch (e) {
      setSnack({
        open: true,
        message: "Error de red creando usuario",
        type: "error",
      });
    }
  };

  const createPallet = async () => {
    try {
      if (!palletForm.numero_palet) {
        setSnack({
          open: true,
          message: "El número de palet es obligatorio",
          type: "error",
        });
        return;
      }
      const res = await fetch("/api/pallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...palletForm,
          creado_por: getCurrentUser()?.name || "Testing",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setSnack({
          open: true,
          message: err.error || "Error creando palet",
          type: "error",
        });
        return;
      }
      const created = await res.json();
      setPallets((prev) => [...prev, created]);
      setOpenCreatePallet(false);
      setPalletForm({ numero_palet: "", tipo: "Seco", base: "Europeo" });
      setSnack({ open: true, message: "Palet creado", type: "success" });
    } catch (e) {
      setSnack({
        open: true,
        message: "Error de red creando palet",
        type: "error",
      });
    }
  };

  const formatDate = (d) => {
    if (!d) return "";
    const date = new Date(d);
    if (isNaN(date.getTime())) return "";
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const toIsoDateKey = (d) => {
    if (!d) return "";
    const date = new Date(d);
    if (isNaN(date.getTime())) return "";
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear();
    return `${yyyy}-${mm}-${dd}`;
  };

  const parseIsoDateKey = (key) => {
    const m = String(key || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const yyyy = Number(m[1]);
    const mm = Number(m[2]);
    const dd = Number(m[3]);
    const d = new Date(yyyy, mm - 1, dd);
    if (isNaN(d.getTime())) return null;
    return d;
  };

  // Derivar filas con todos los campos y conteo correcto de palets
  const rows = useMemo(() => {
    return loadDocs.map((l) => {
      const paletsArray = Array.isArray(l.palets) ? l.palets : [];
      const byRelation = pallets.filter(
        (p) => String(p.carga?._id || p.carga) === String(l._id)
      );
      const uniqueIds = new Set([
        ...paletsArray.map((p) => String(p._id || p)),
        ...byRelation.map((p) => String(p._id)),
      ]);
      const totalPalets = uniqueIds.size;
      return {
        id: l._id,
        nombre: l.nombre || "",
        barco: l.barco?.nombre_del_barco || "",
        entrega: Array.isArray(l.entrega)
          ? l.entrega.join(", ")
          : l.entrega || "",
        chofer: l.chofer?.name || "",
        consignatario: l.consignatario?.nombre || "",
        terminal_entrega:
          (l.terminal_entrega?.puerto
            ? `${l.terminal_entrega.puerto} · `
            : "") + (l.terminal_entrega?.nombre || ""),
        carga: Array.isArray(l.carga) ? l.carga.join(", ") : l.carga || "",
        total_palets: totalPalets,
        estado_viaje: l.estado_viaje || "Preparando",
        cash: l.cash ? "Sí" : "No",
        lancha: l.lancha ? "Sí" : "No",
        fecha_de_carga: formatDate(l.fecha_de_carga),
        fecha_de_carga_raw: l.fecha_de_carga,
        fecha_de_carga_group: toIsoDateKey(l.fecha_de_carga) || "Sin fecha",
        hora_de_carga: l.hora_de_carga || "",
        fecha_de_descarga: formatDate(l.fecha_de_descarga),
        fecha_de_descarga_raw: l.fecha_de_descarga,
        fecha_de_descarga_group:
          toIsoDateKey(l.fecha_de_descarga) || "Sin fecha",
        hora_de_descarga: l.hora_de_descarga || "",
        estado_carga: l.estado_carga ? "Sí" : "No",
      };
    });
  }, [loadDocs, pallets]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const textOk =
        q === "" ||
        r.barco.toLowerCase().includes(q) ||
        r.entrega.toLowerCase().includes(q) ||
        (r.terminal_entrega || "").toLowerCase().includes(q) ||
        r.estado_viaje.toLowerCase().includes(q);
      const estadoOk = !estadoFilter || r.estado_viaje === estadoFilter;
      const entregaOk =
        !entregaFilter || r.entrega.split(", ").includes(entregaFilter);
      const barcoOk = !barcoFilter || r.barco === barcoFilter;
      return textOk && estadoOk && entregaOk && barcoOk;
    });
  }, [rows, query, estadoFilter, entregaFilter, barcoFilter]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filtered.slice(start, end);
  }, [filtered, page, pageSize]);

  useEffect(() => {
    setVisibleColumnKeys((prev) => {
      const next = prev.filter((k) => allColumnKeys.includes(k));
      const ensured = next.length > 0 ? next : [allColumnKeys[0]];
      if (
        ensured.length === prev.length &&
        ensured.every((k, i) => k === prev[i])
      ) {
        return prev;
      }
      return ensured;
    });
  }, [allColumnKeys]);

  const toggleColumnKey = (key) => {
    setVisibleColumnKeys((prev) => {
      const exists = prev.includes(key);
      if (exists && prev.length === 1) return prev;
      if (exists) return prev.filter((k) => k !== key);
      return [...prev, key];
    });
  };

  const tableColumns = useMemo(() => {
    const keySet = new Set(visibleColumnKeys);
    const cols = allColumns.filter((c) => keySet.has(c.key));
    return cols.length > 0 ? cols : [allColumns[0]];
  }, [allColumns, visibleColumnKeys]);

  const groupLabel = useMemo(() => {
    if (
      groupBy !== "fecha_de_carga_group" &&
      groupBy !== "fecha_de_descarga_group"
    ) {
      return undefined;
    }
    return (key) => {
      const k = String(key || "");
      if (!k || k === "(Sin valor)" || k === "Sin fecha") return "Sin fecha";
      const d = parseIsoDateKey(k);
      if (!d) return k;
      return new Intl.DateTimeFormat("es-ES", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "2-digit",
      }).format(d);
    };
  }, [groupBy]);

  useEffect(() => {
    setPage(1);
  }, [query, estadoFilter, entregaFilter, barcoFilter]);

  const goDetail = (row) => {
    if (row.id) navigate(`/app/logistica/cargas/${row.id}`);
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
          style={{ width: 280 }}
          placeholder="Buscar por barco, terminal, entrega o estado"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            className="select"
            value={estadoFilter}
            onChange={(e) => setEstadoFilter(e.target.value)}
            aria-label="Filtrar por estado"
          >
            <option value="">Todos los estados</option>
            {ESTADO_VIAJE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <select
            className="select"
            value={entregaFilter}
            onChange={(e) => setEntregaFilter(e.target.value)}
            aria-label="Filtrar por entrega"
          >
            <option value="">Todas las entregas</option>
            {ENTREGA_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <select
            className="select"
            value={barcoFilter}
            onChange={(e) => setBarcoFilter(e.target.value)}
            aria-label="Filtrar por barco"
          >
            <option value="">Todos los barcos</option>
            {Array.from(new Set(rows.map((r) => r.barco)))
              .filter(Boolean)
              .map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
          </select>
          <select
            className="select"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
            aria-label="Agrupar"
          >
            <option value="none">Sin agrupación</option>
            <option value="barco">Agrupar por barco</option>
            <option value="estado_viaje">Agrupar por estado</option>
            <option value="fecha_de_carga_group">
              Agrupar por fecha de carga
            </option>
            <option value="fecha_de_descarga_group">
              Agrupar por fecha de descarga
            </option>
          </select>
          {view === "table" && (
            <div ref={columnsMenuRef} style={{ position: "relative" }}>
              <button
                type="button"
                title="Columnas"
                onClick={() => setColumnsOpen((o) => !o)}
                style={{
                  height: 40,
                  padding: "0 12px",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  background: "#fff",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span className="material-symbols-outlined">view_column</span>
                Columnas
              </button>
              {columnsOpen && (
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: 44,
                    width: 260,
                    background: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    boxShadow: "0 10px 30px rgba(0,0,0,0.10)",
                    padding: 10,
                    zIndex: 50,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>Columnas</div>
                    <button
                      type="button"
                      onClick={() => setVisibleColumnKeys(allColumnKeys)}
                      style={{
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        color: "#2563eb",
                        fontWeight: 600,
                      }}
                    >
                      Todas
                    </button>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gap: 6,
                      maxHeight: 320,
                      overflowY: "auto",
                      paddingRight: 4,
                    }}
                  >
                    {allColumns.map((c) => {
                      const checked = visibleColumnKeys.includes(c.key);
                      const disabled =
                        checked && visibleColumnKeys.length === 1;
                      return (
                        <label
                          key={c.key}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "6px 8px",
                            borderRadius: 8,
                            cursor: disabled ? "not-allowed" : "pointer",
                            opacity: disabled ? 0.6 : 1,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => toggleColumnKey(c.key)}
                          />
                          <span>{c.header}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
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
            title="Vista calendario"
            onClick={() => setView("calendar")}
          >
            <span className="material-symbols-outlined">calendar_month</span>
          </button>
          <button
            className="icon-button"
            title="Vista por días"
            onClick={() => setView("day_list")}
          >
            <span className="material-symbols-outlined">event_note</span>
          </button>
          {view === "calendar" && (
            <button
              className="icon-button"
              title={
                calMode === "month"
                  ? "Cambiar a vista semanal"
                  : "Cambiar a vista mensual"
              }
              onClick={() =>
                setCalMode((m) => (m === "month" ? "week" : "month"))
              }
            >
              <span className="material-symbols-outlined">
                calendar_view_week
              </span>
            </button>
          )}
        </div>
      </div>

      {view === "table" ? (
        <DataTable
          title="Cargas"
          columns={tableColumns}
          data={paginated}
          loading={loading}
          groupBy={groupBy !== "none" ? groupBy : undefined}
          groupLabel={groupLabel}
          createLabel={canManageLoads ? "Crear carga" : undefined}
          onCreate={canManageLoads ? onCreate : undefined}
          onRowClick={goDetail}
        />
      ) : view === "cards" ? (
        <CardGrid
          title="Cargas"
          items={paginated.map((i) => ({
            ...i,
            name: i.nombre || i.entrega,
            subtitle: `${i.barco} · ${i.estado_viaje}`,
          }))}
          loading={loading}
          onCreate={canManageLoads ? onCreate : undefined}
          createLabel={canManageLoads ? "Crear carga" : undefined}
          onCardClick={goDetail}
        />
      ) : view === "day_list" ? (
        <div style={{ display: "grid", gap: 24, paddingBottom: 24 }}>
          {(() => {
            const groups = {};
            filtered.forEach((item) => {
              const d = item.fecha_de_carga_raw
                ? new Date(item.fecha_de_carga_raw)
                : null;
              const key =
                d && !isNaN(d.getTime())
                  ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
                      2,
                      "0"
                    )}-${String(d.getDate()).padStart(2, "0")}`
                  : "Sin fecha";
              if (!groups[key]) groups[key] = [];
              groups[key].push(item);
            });
            const sortedKeys = Object.keys(groups).sort();

            return sortedKeys.map((dateKey) => {
              const dateLabel =
                dateKey === "Sin fecha"
                  ? "Sin fecha"
                  : new Intl.DateTimeFormat("es-ES", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    }).format(new Date(dateKey));
              return (
                <div key={dateKey}>
                  <h3
                    style={{
                      fontSize: "1.1rem",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      marginBottom: 12,
                      textTransform: "capitalize",
                      borderBottom: "1px solid var(--border)",
                      paddingBottom: 8,
                    }}
                  >
                    {dateLabel}{" "}
                    <span
                      style={{
                        fontSize: "0.9rem",
                        color: "var(--text-secondary)",
                        fontWeight: 400,
                      }}
                    >
                      ({groups[dateKey].length})
                    </span>
                  </h3>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill, minmax(300px, 1fr))",
                      gap: 16,
                    }}
                  >
                    {groups[dateKey].map((item) => (
                      <div
                        key={item.id}
                        className="card"
                        onClick={() => goDetail(item)}
                        style={{ cursor: "pointer", padding: 16 }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: 8,
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>
                            {item.nombre || item.entrega}
                          </span>
                          <span
                            className={`status-badge status-${String(
                              item.estado_viaje
                            )
                              .toLowerCase()
                              .replace(" ", "-")}`}
                          >
                            {item.estado_viaje}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: "0.9rem",
                            color: "var(--text-secondary)",
                            display: "grid",
                            gap: 4,
                          }}
                        >
                          <div>🚢 {item.barco}</div>
                          {item.hora_de_carga && (
                            <div>🕒 {item.hora_de_carga}</div>
                          )}
                          <div>
                            📦 {item.carga}{" "}
                            {item.total_palets > 0 &&
                              `(${item.total_palets} palets)`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      ) : (
        <Calendar
          title="Cargas"
          items={filtered}
          loading={loading}
          month={calMonth}
          mode={calMode}
          onPrevMonth={prevPeriod}
          onNextMonth={nextPeriod}
          onItemClick={goDetail}
          dateKey="fecha_de_carga_raw"
          secondaryDateKey="fecha_de_descarga_raw"
          statusKey="estado_viaje"
        />
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
        open={open}
        title="Crear carga"
        onClose={() => setOpen(false)}
        onSubmit={submit}
        submitLabel="Crear"
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

      {/* Modal crear barco */}
      <Modal
        open={openCreateShip}
        title="Crear barco"
        onClose={() => setOpenCreateShip(false)}
        onSubmit={createShip}
        submitLabel="Crear"
      >
        <div>
          <div className="label">Nombre del barco</div>
          <input
            className="input"
            value={shipForm.nombre_del_barco}
            onChange={(e) =>
              setShipForm({ ...shipForm, nombre_del_barco: e.target.value })
            }
            placeholder="Nombre del barco"
          />
        </div>
        <div>
          <div className="label">Empresa (opcional)</div>
          <select
            className="input"
            value={shipForm.empresa}
            onChange={(e) =>
              setShipForm({ ...shipForm, empresa: e.target.value })
            }
          >
            <option value="">Sin empresa</option>
            {ships.map((s) =>
              s.empresa ? (
                <option key={s.empresa._id} value={s.empresa._id}>
                  {s.empresa.nombre}
                </option>
              ) : null
            )}
          </select>
        </div>
      </Modal>

      {/* Modal crear usuario (consignatario sin contraseña) */}
      <Modal
        open={openCreateUser}
        title="Crear usuario"
        onClose={() => setOpenCreateUser(false)}
        onSubmit={createUser}
        submitLabel="Crear"
      >
        <div>
          <div className="label">Nombre</div>
          <input
            className="input"
            value={userForm.name}
            onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
            placeholder="Nombre"
          />
        </div>
        <div>
          <div className="label">Email</div>
          <input
            className="input"
            value={userForm.email}
            onChange={(e) =>
              setUserForm({ ...userForm, email: e.target.value })
            }
            placeholder="email@dominio.com"
          />
        </div>
        <div>
          <div className="label">Rol</div>
          <select
            className="input"
            value={userForm.role}
            onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
          >
            <option value="consignee">Consignatario</option>
            <option value="driver">Chofer</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="dispatcher">Dispatcher</option>
          </select>
        </div>
        {userForm.role !== "consignee" && (
          <div>
            <div className="label">Contraseña</div>
            <input
              className="input"
              type="password"
              value={userForm.password}
              onChange={(e) =>
                setUserForm({ ...userForm, password: e.target.value })
              }
              placeholder="Contraseña"
            />
          </div>
        )}
      </Modal>

      {/* Modal crear palet */}
      <Modal
        open={openCreatePallet}
        title="Crear palet"
        onClose={() => setOpenCreatePallet(false)}
        onSubmit={createPallet}
        submitLabel="Crear"
      >
        <div>
          <div className="label">Número de palet</div>
          <input
            className="input"
            value={palletForm.numero_palet}
            onChange={(e) =>
              setPalletForm({ ...palletForm, numero_palet: e.target.value })
            }
            placeholder="Nº de palet"
          />
        </div>
        <div>
          <div className="label">Tipo</div>
          <select
            className="select"
            value={palletForm.tipo}
            onChange={(e) =>
              setPalletForm({ ...palletForm, tipo: e.target.value })
            }
          >
            {CARGA_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="label">Base</div>
          <select
            className="select"
            value={palletForm.base || "Europeo"}
            onChange={(e) =>
              setPalletForm({ ...palletForm, base: e.target.value })
            }
          >
            <option value="Europeo">Europeo</option>
            <option value="Americano">Americano</option>
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
