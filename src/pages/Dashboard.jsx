import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Calendar from "../components/Calendar.jsx";
import DataTable from "../components/DataTable.jsx";
import Snackbar from "../components/Snackbar.jsx";
import {
  fetchAllShips,
  fetchLoadsByFechaCargaRange,
  fetchPalletsByFechaCreacionSince,
} from "../firebase/auth.js";
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

function isoKeyFromDate(d) {
  if (!(d instanceof Date)) return "";
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function lastNDaysKeys(n) {
  const count = Math.max(1, Number(n) || 1);
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const keys = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    keys.push(isoKeyFromDate(d));
  }
  return keys.filter(Boolean);
}

function normalizeTipo(value) {
  const t = String(value || "")
    .trim()
    .toLowerCase();
  if (t === "tecnico" || t === "técnico") return "Técnico";
  if (t === "seco") return "Seco";
  if (t === "refrigerado") return "Refrigerado";
  if (t === "congelado") return "Congelado";
  return "Otros";
}

function buildConicGradient({ entries, colors }) {
  const total = entries.reduce((acc, e) => acc + (Number(e.value) || 0), 0);
  if (!total) return "conic-gradient(#e5e7eb 0deg, #e5e7eb 360deg)";
  let at = 0;
  const parts = entries
    .filter((e) => (Number(e.value) || 0) > 0)
    .map((e) => {
      const value = Number(e.value) || 0;
      const deg = (value / total) * 360;
      const from = at;
      const to = at + deg;
      at = to;
      const color = colors[e.key] || "#9ca3af";
      return `${color} ${from}deg ${to}deg`;
    });
  const full = parts.length ? parts : ["#e5e7eb 0deg 360deg"];
  return `conic-gradient(${full.join(", ")})`;
}

function Donut({ title, entries, colors, subtitle } = {}) {
  const gradient = useMemo(
    () => buildConicGradient({ entries: entries || [], colors: colors || {} }),
    [entries, colors],
  );
  const total = useMemo(
    () => (entries || []).reduce((acc, e) => acc + (Number(e.value) || 0), 0),
    [entries],
  );
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 12,
        background: "#fff",
        padding: 12,
        display: "grid",
        gap: 10,
      }}
    >
      <div
        style={{ display: "flex", justifyContent: "space-between", gap: 10 }}
      >
        <div style={{ fontWeight: 800 }}>{title}</div>
        <div style={{ color: "var(--text-secondary)", fontWeight: 800 }}>
          {total}
        </div>
      </div>
      {subtitle ? (
        <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
          {subtitle}
        </div>
      ) : null}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: "999px",
            background: gradient,
            position: "relative",
            flex: "0 0 auto",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 16,
              borderRadius: "999px",
              background: "#fff",
              border: "1px solid var(--border)",
            }}
          />
        </div>
        <div style={{ display: "grid", gap: 6, minWidth: 0, flex: 1 }}>
          {(entries || []).map((e) => (
            <div
              key={e.key}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 3,
                    background: colors?.[e.key] || "#9ca3af",
                    display: "inline-block",
                  }}
                />
                <span style={{ fontWeight: 700 }}>{e.key}</span>
              </div>
              <span style={{ fontWeight: 800 }}>{Number(e.value) || 0}</span>
            </div>
          ))}
          {total === 0 ? (
            <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
              Sin datos
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MiniBars({ title, rows, aLabel, bLabel } = {}) {
  const max = useMemo(() => {
    const values = (rows || []).flatMap((r) => [r.a || 0, r.b || 0]);
    return Math.max(1, ...values.map((v) => Number(v) || 0));
  }, [rows]);
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 12,
        background: "#fff",
        padding: 12,
        display: "grid",
        gap: 12,
      }}
    >
      <div style={{ fontWeight: 800 }}>{title}</div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              background: "#22c55e",
              display: "inline-block",
            }}
          />
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            {aLabel}
          </span>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              background: "#ef4444",
              display: "inline-block",
            }}
          />
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            {bLabel}
          </span>
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${Math.max(
            1,
            (rows || []).length,
          )}, 1fr)`,
          gap: 8,
          alignItems: "end",
          height: 160,
        }}
      >
        {(rows || []).map((r) => (
          <div key={r.key} style={{ display: "grid", gap: 6 }}>
            <div style={{ display: "flex", gap: 4, alignItems: "flex-end" }}>
              <div
                style={{
                  width: "50%",
                  height: `${((Number(r.a) || 0) / max) * 130}px`,
                  minHeight: 2,
                  borderRadius: 6,
                  background: "#22c55e",
                }}
                title={`${aLabel}: ${Number(r.a) || 0}`}
              />
              <div
                style={{
                  width: "50%",
                  height: `${((Number(r.b) || 0) / max) * 130}px`,
                  minHeight: 2,
                  borderRadius: 6,
                  background: "#ef4444",
                }}
                title={`${bLabel}: ${Number(r.b) || 0}`}
              />
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-secondary)",
                textAlign: "center",
              }}
            >
              {String(r.key || "").slice(5)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const role = getCurrentRole();
  const isWarehouse = role === ROLES.ALMACEN;
  const isOffice = role === ROLES.OFICINA;
  const canViewAnalytics = role === ROLES.ADMIN || role === ROLES.LOGISTICA;
  const [range, setRange] = useState("today");
  const [month, setMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [loads, setLoads] = useState([]);
  const [ships, setShips] = useState([]);
  const [pallets, setPallets] = useState([]);
  const [analyticsError, setAnalyticsError] = useState("");
  const [snack, setSnack] = useState({
    open: false,
    message: "",
    type: "success",
  });

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    const days30 = 30;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start30 = new Date(today);
    start30.setDate(today.getDate() - (days30 - 1));
    const start30Key = isoKeyFromDate(start30);
    const endKey = isoKeyFromDate(today);

    Promise.all([
      fetchLoadsByFechaCargaRange({ startKey: start30Key, endKey, max: 2000 }),
      fetchAllShips(),
      fetchPalletsByFechaCreacionSince({
        sinceMs: start30.getTime(),
        max: 5000,
      }),
    ])
      .then(([loadsList, shipsList, palletsList]) => {
        if (!mounted) return;
        const normalize = (x) => ({
          ...x,
          _id: x?._id || x?.id,
          id: x?.id || x?._id,
        });
        setLoads(Array.isArray(loadsList) ? loadsList.map(normalize) : []);
        setShips(Array.isArray(shipsList) ? shipsList.map(normalize) : []);
        setPallets(
          Array.isArray(palletsList) ? palletsList.map(normalize) : [],
        );
        setAnalyticsError("");
      })
      .catch(() => {
        if (!mounted) return;
        setLoads([]);
        setShips([]);
        setPallets([]);
        setAnalyticsError("No se pudieron cargar los datos para analítica");
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

  const tipoColors = useMemo(
    () => ({
      Seco: "#f59e0b",
      Refrigerado: "#22c55e",
      Congelado: "#3b82f6",
      Técnico: "#a78bfa",
      Otros: "#9ca3af",
    }),
    [],
  );

  const last7Keys = useMemo(() => lastNDaysKeys(7), []);

  const loadCounts7d = useMemo(() => {
    const byKey = new Map(
      last7Keys.map((k) => [k, { delivered: 0, cancelled: 0 }]),
    );
    loads.forEach((l) => {
      const k = toIsoDateKey(l?.fecha_de_carga);
      if (!k || !byKey.has(k)) return;
      const estado = String(l?.estado_viaje || "")
        .trim()
        .toLowerCase();
      if (
        estado === "entregado" ||
        estado === "finalizada" ||
        estado === "finalizado"
      ) {
        byKey.get(k).delivered += 1;
      } else if (estado === "cancelado") {
        byKey.get(k).cancelled += 1;
      }
    });
    return last7Keys.map((k) => ({
      key: k,
      a: byKey.get(k)?.delivered || 0,
      b: byKey.get(k)?.cancelled || 0,
    }));
  }, [last7Keys, loads]);

  const donutCargados = useMemo(() => {
    const base = { Seco: 0, Refrigerado: 0, Congelado: 0, Técnico: 0 };
    for (const p of pallets) {
      if (!p?.estado) continue;
      const key = normalizeTipo(p?.tipo);
      if (Object.prototype.hasOwnProperty.call(base, key)) base[key] += 1;
    }
    return Object.entries(base).map(([key, value]) => ({ key, value }));
  }, [pallets]);

  const donutPendientes = useMemo(() => {
    const base = { Seco: 0, Refrigerado: 0, Congelado: 0, Técnico: 0 };
    for (const p of pallets) {
      if (p?.estado) continue;
      const key = normalizeTipo(p?.tipo);
      if (Object.prototype.hasOwnProperty.call(base, key)) base[key] += 1;
    }
    return Object.entries(base).map(([key, value]) => ({ key, value }));
  }, [pallets]);

  const topShips = useMemo(() => {
    const map = new Map();
    for (const l of loads) {
      const estado = String(l?.estado_viaje || "")
        .trim()
        .toLowerCase();
      if (
        estado !== "entregado" &&
        estado !== "finalizada" &&
        estado !== "finalizado"
      )
        continue;
      const shipId = String(l?.barco?._id || l?.barco || "").trim();
      const ship = shipById.get(shipId);
      const name = String(ship?.nombre_del_barco || "").trim() || "Sin barco";
      map.set(name, (map.get(name) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"))
      .slice(0, 10);
  }, [loads, shipById]);

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

  if (!canViewAnalytics) {
    return (
      <>
        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Dashboard</h2>
          </div>
          <div style={{ padding: 16, color: "var(--text-secondary)" }}>
            No tienes permisos para ver el Dashboard.
          </div>
        </section>
        <Snackbar
          open={snack.open}
          message={snack.message}
          type={snack.type}
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
        />
      </>
    );
  }

  return (
    <>
      <section className="card" style={{ marginBottom: 12 }}>
        <div className="card-header">
          <h2 className="card-title">Analítica rápida (últimos 30 días)</h2>
        </div>
        <div style={{ padding: 12 }}>
          {analyticsError ? (
            <div style={{ color: "#b91c1c", fontWeight: 800 }}>
              {analyticsError}
            </div>
          ) : null}
          {loading ? (
            <div style={{ color: "var(--text-secondary)" }}>Cargando...</div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 12,
                alignItems: "start",
              }}
            >
              <MiniBars
                title="Cargas por día (últimos 7 días)"
                rows={loadCounts7d}
                aLabel="Entregadas"
                bLabel="Canceladas"
              />
              <Donut
                title="Palets cargados por tipo"
                entries={donutCargados}
                colors={tipoColors}
                subtitle="Estado = cargado"
              />
              <Donut
                title="Palets por cargar por tipo"
                entries={donutPendientes}
                colors={tipoColors}
                subtitle="Estado = pendiente"
              />
              <div
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  background: "#fff",
                  padding: 12,
                  display: "grid",
                  gap: 10,
                }}
              >
                <div style={{ fontWeight: 800 }}>
                  Top 10 barcos (entregadas)
                </div>
                {topShips.length ? (
                  <div style={{ display: "grid", gap: 6 }}>
                    {topShips.map((s, idx) => (
                      <div
                        key={s.name}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                        }}
                      >
                        <span style={{ fontWeight: 700 }}>
                          {idx + 1}. {s.name}
                        </span>
                        <span style={{ fontWeight: 800 }}>{s.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                    Sin datos
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

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
