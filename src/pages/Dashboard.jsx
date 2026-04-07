import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Calendar from "../components/Calendar.jsx";
import DataTable from "../components/DataTable.jsx";
import Snackbar from "../components/Snackbar.jsx";
import { fetchAllLoads, fetchAllShips } from "../firebase/auth.js";
import { ROLES, getCurrentRole } from "../utils/roles.js";

const ESTADO_CARGA_OPTIONS = [
  "Preparando",
  "Cargando",
  "Viajando",
  "Entregado",
  "Cancelado",
];

const RANGE_OPTIONS = [
  { value: "today", label: "Hoy" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
  { value: "all", label: "Todo" },
];

function toIsoDateKey(raw) {
  const v = String(raw || "").trim();
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toMsDateOnly(key) {
  const k = toIsoDateKey(key);
  if (!k) return null;
  const d = new Date(`${k}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.getTime();
}

function startEndForRange(rangeValue) {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  if (rangeValue === "today")
    return { startMs: start.getTime(), endMs: end.getTime() };
  if (rangeValue === "week") {
    const day = start.getDay();
    const diffToMonday = (day + 6) % 7;
    start.setDate(start.getDate() - diffToMonday);
    end.setTime(start.getTime());
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { startMs: start.getTime(), endMs: end.getTime() };
  }
  if (rangeValue === "month") {
    start.setDate(1);
    end.setMonth(start.getMonth() + 1);
    end.setDate(0);
    end.setHours(23, 59, 59, 999);
    return { startMs: start.getTime(), endMs: end.getTime() };
  }
  return { startMs: null, endMs: null };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const role = getCurrentRole();
  const isWarehouse = role === ROLES.ALMACEN;
  const isOffice = role === ROLES.OFICINA;
  const [range, setRange] = useState("today");
  const [month, setMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [loads, setLoads] = useState([]);
  const [ships, setShips] = useState([]);
  const [snack, setSnack] = useState({
    open: false,
    message: "",
    type: "success",
  });

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([fetchAllLoads(), fetchAllShips()])
      .then(([loadsList, shipsList]) => {
        if (!mounted) return;
        const normalize = (x) => ({
          ...x,
          _id: x?._id || x?.id,
          id: x?.id || x?._id,
        });
        setLoads(Array.isArray(loadsList) ? loadsList.map(normalize) : []);
        setShips(Array.isArray(shipsList) ? shipsList.map(normalize) : []);
      })
      .catch(() => {
        if (!mounted) return;
        setLoads([]);
        setShips([]);
        setSnack({
          open: true,
          message: "Error cargando datos",
          type: "error",
        });
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const shipById = useMemo(() => {
    return new Map(
      ships.map((s) => [String(s?._id || s?.id || ""), s]).filter((p) => p[0]),
    );
  }, [ships]);

  const rangeBounds = useMemo(() => startEndForRange(range), [range]);

  const loadsInRange = useMemo(() => {
    const { startMs, endMs } = rangeBounds;
    if (startMs == null || endMs == null) return loads;
    return loads.filter((l) => {
      const ms = toMsDateOnly(l?.fecha_de_carga);
      if (ms == null) return false;
      return ms >= startMs && ms <= endMs;
    });
  }, [loads, rangeBounds]);

  const calendarItems = useMemo(() => {
    return loadsInRange.map((l) => {
      const ship =
        shipById.get(String(l?.barco?._id || l?.barco || "")) || null;
      const fechaCargaKey = toIsoDateKey(l?.fecha_de_carga);
      const fechaDescargaKey = toIsoDateKey(l?.fecha_de_descarga);
      return {
        id: String(l?._id || l?.id || ""),
        fecha_de_carga: fechaCargaKey ? `${fechaCargaKey}T00:00:00` : "",
        fecha_de_descarga: fechaDescargaKey
          ? `${fechaDescargaKey}T00:00:00`
          : "",
        barco: ship?.nombre_del_barco || "",
        entrega: Array.isArray(l?.entrega)
          ? l.entrega.filter(Boolean).join(", ")
          : "",
        estado_viaje: String(l?.estado_viaje || "Preparando"),
      };
    });
  }, [loadsInRange, shipById]);

  const stats = useMemo(() => {
    const base = Object.fromEntries(ESTADO_CARGA_OPTIONS.map((k) => [k, 0]));
    for (const l of loadsInRange) {
      const k = String(l?.estado_viaje || "Preparando");
      if (typeof base[k] === "number") base[k] += 1;
    }
    const preparando = base.Preparando || 0;
    const cargando = base.Cargando || 0;
    return {
      total: loadsInRange.length,
      enPreparacion: preparando + cargando,
      porEstado: base,
    };
  }, [loadsInRange]);

  const tableRows = useMemo(() => {
    const sorted = loadsInRange.slice().sort((a, b) => {
      const aKey = toIsoDateKey(a?.fecha_de_carga) || "9999-99-99";
      const bKey = toIsoDateKey(b?.fecha_de_carga) || "9999-99-99";
      if (aKey !== bKey) return aKey.localeCompare(bKey);
      return String(a?.hora_de_carga || "").localeCompare(
        String(b?.hora_de_carga || ""),
      );
    });
    return sorted.slice(0, 25).map((l) => {
      const ship =
        shipById.get(String(l?.barco?._id || l?.barco || "")) || null;
      return {
        id: String(l?._id || l?.id || ""),
        barco: ship?.nombre_del_barco || "",
        entrega: Array.isArray(l?.entrega)
          ? l.entrega.filter(Boolean).join(", ")
          : "",
        estado_viaje: String(l?.estado_viaje || "Preparando"),
        fecha_de_carga: toIsoDateKey(l?.fecha_de_carga) || "",
        hora_de_carga: String(l?.hora_de_carga || ""),
      };
    });
  }, [loadsInRange, shipById]);

  const columns = useMemo(
    () => [
      { key: "barco", header: "Barco" },
      { key: "entrega", header: "Entrega" },
      { key: "estado_viaje", header: "Estado de Carga" },
      { key: "fecha_de_carga", header: "Fecha carga" },
      { key: "hora_de_carga", header: "Hora" },
    ],
    [],
  );

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 8,
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>Dashboard</h2>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            className="select"
            value={range}
            onChange={(e) => setRange(e.target.value)}
            style={{ width: 160 }}
            aria-label="Rango"
          >
            {RANGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {!isWarehouse && !isOffice && (
            <button
              className="primary-button"
              onClick={() => navigate("/app/logistica/cargas")}
            >
              Ir a Cargas
            </button>
          )}
        </div>
      </div>

      <section className="card">
        <div className="card-header">
          <h2 className="card-title">
            Resumen ·{" "}
            {RANGE_OPTIONS.find((o) => o.value === range)?.label || "Hoy"}
          </h2>
        </div>
        <div className="card-grid">
          <div className="card-item">
            <div className="card-item-header">
              <div className="avatar">Σ</div>
              <div>
                <div className="card-item-title" style={{ fontSize: 18 }}>
                  Total
                </div>
                <div
                  className="card-item-sub"
                  style={{ fontSize: 26, color: "var(--text-primary)" }}
                >
                  {stats.total}
                </div>
              </div>
            </div>
          </div>
          <div className="card-item">
            <div className="card-item-header">
              <div className="avatar">P</div>
              <div>
                <div className="card-item-title" style={{ fontSize: 18 }}>
                  En preparación
                </div>
                <div
                  className="card-item-sub"
                  style={{ fontSize: 26, color: "var(--text-primary)" }}
                >
                  {stats.enPreparacion}
                </div>
              </div>
            </div>
          </div>
          {ESTADO_CARGA_OPTIONS.map((k) => (
            <div key={k} className="card-item">
              <div className="card-item-header">
                <div className="avatar">
                  {String(k || "?")
                    .slice(0, 1)
                    .toUpperCase()}
                </div>
                <div>
                  <div className="card-item-title" style={{ fontSize: 18 }}>
                    {k}
                  </div>
                  <div
                    className="card-item-sub"
                    style={{ fontSize: 26, color: "var(--text-primary)" }}
                  >
                    {stats.porEstado[k] || 0}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Calendar
        title="Cargas"
        items={calendarItems}
        month={month}
        mode="week"
        loading={loading}
        onPrevMonth={() =>
          setMonth((d) => {
            const next = new Date(d);
            next.setDate(next.getDate() - 7);
            return next;
          })
        }
        onNextMonth={() =>
          setMonth((d) => {
            const next = new Date(d);
            next.setDate(next.getDate() + 7);
            return next;
          })
        }
        onItemClick={(it) => {
          const id = String(it?.id || "");
          if (!id) return;
          navigate(`/app/logistica/cargas/${id}`);
        }}
      />

      <DataTable
        title="Cargas (lista)"
        columns={columns}
        data={tableRows}
        loading={loading}
        onRowClick={(row) => navigate(`/app/logistica/cargas/${row.id}`)}
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
