import { useEffect, useMemo, useState } from "react";
import DataTable from "../components/DataTable.jsx";
import Snackbar from "../components/Snackbar.jsx";
import Pagination from "../components/Pagination.jsx";
import ToggleSwitch from "../components/ToggleSwitch.jsx";
import { useFeatureOptions } from "../contexts/useFeatureOptions.js";
import { fetchInteractions, setPeticionesEnabled } from "../firebase/auth.js";
import { getCurrentRole, ROLES } from "../utils/roles.js";

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
  return null;
}

function toMs(value) {
  const d = toDate(value);
  return d ? d.getTime() : 0;
}

function formatDateTime(value) {
  const d = toDate(value);
  if (!d) return "";
  return new Intl.DateTimeFormat("es-ES", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(d);
}

const TYPE_LABELS = {
  user_created: "Usuario creado",
  user_logged_in: "Login",
  user_logged_out: "Logout",
  user_updated: "Usuario modificado",
  load_created: "Carga creada",
  load_updated: "Carga modificada",
  load_deleted: "Carga borrada",
  pallet_created: "Palet creado",
  pallet_updated: "Palet modificado",
  pallet_deleted: "Palet borrado",
  pallets_fused: "Palets fusionados",
  location_created: "Localización creada",
  location_updated: "Localización modificada",
  location_deleted: "Localización borrada",
  consignee_created: "Consignatario creado",
  consignee_updated: "Consignatario modificado",
  consignee_deleted: "Consignatario borrado",
  company_created: "Empresa creada",
  company_updated: "Empresa modificada",
  company_deleted: "Empresa borrada",
  cargo_type_created: "Tipo de carga creado",
  cargo_type_updated: "Tipo de carga modificado",
  cargo_type_deleted: "Tipo de carga borrado",
  ship_created: "Barco creado",
  ship_updated: "Barco modificado",
  ship_deleted: "Barco borrado",
  petition_created: "Petición creada",
  petition_updated: "Petición modificada",
  message_created: "Mensaje creado",
  message_updated: "Mensaje modificado",
  message_deleted: "Mensaje borrado",
};

export default function Interactions() {
  const role = getCurrentRole();
  const canEditOptions = role === ROLES.ADMIN;
  const { featureOptions, loading: featureOptionsLoading } =
    useFeatureOptions();
  const remotePeticionesEnabled = featureOptions?.peticiones_enabled !== false;
  const columns = [
    { key: "at", header: "Fecha y hora" },
    { key: "typeLabel", header: "Acción" },
    { key: "actor", header: "Usuario (actor)" },
    { key: "target", header: "Elemento afectado" },
    { key: "info", header: "Info" },
  ];

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [snack, setSnack] = useState({
    open: false,
    message: "",
    type: "success",
  });

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [hideAutoLogouts, setHideAutoLogouts] = useState(true);
  const [tab, setTab] = useState("stats");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [optionsSaving, setOptionsSaving] = useState(false);
  const [pendingPeticionesEnabled, setPendingPeticionesEnabled] =
    useState(null);

  const peticionesEnabled = pendingPeticionesEnabled ?? remotePeticionesEnabled;
  const optionsLoading = featureOptionsLoading || optionsSaving;

  useEffect(() => {
    if (pendingPeticionesEnabled === null) return;
    if (remotePeticionesEnabled === pendingPeticionesEnabled)
      setPendingPeticionesEnabled(null);
  }, [remotePeticionesEnabled, pendingPeticionesEnabled]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        setLoading(true);
        const list = await fetchInteractions({ limitCount: 500 });
        if (!mounted) return;
        const mapped = list.map((i) => {
          const actorEmail = i.actor?.email || "";
          const actorName = i.actor?.name || "";
          const targetEmail = i.target?.email || "";
          const targetName = i.target?.name || "";
          const createdMs =
            toMs(i.createdAt) || Number(i.clientCreatedAtMs) || 0;
          const details = i.details || null;
          const isAutoLogout = i.type === "user_logged_out" && !!details?.auto;
          return {
            id: i.id,
            at: formatDateTime(i.createdAt),
            createdMs,
            type: i.type || "",
            typeLabel: TYPE_LABELS[i.type] || i.type || "",
            actor:
              actorName && actorEmail
                ? `${actorName} (${actorEmail})`
                : actorName || actorEmail || "",
            target:
              targetName && targetEmail
                ? `${targetName} (${targetEmail})`
                : targetName || targetEmail || "",
            rawActor: `${actorName} ${actorEmail}`.trim().toLowerCase(),
            rawTarget: `${targetName} ${targetEmail}`.trim().toLowerCase(),
            isAutoLogout,
            info: isAutoLogout ? "Auto" : "",
          };
        });
        mapped.sort((a, b) => (b.createdMs || 0) - (a.createdMs || 0));
        setRows(mapped);
      } catch (e) {
        if (!mounted) return;
        setSnack({
          open: true,
          message: "No se pudieron cargar las interacciones",
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesType = typeFilter === "all" || r.type === typeFilter;
      const matchesAuto =
        !hideAutoLogouts || !(r.type === "user_logged_out" && r.isAutoLogout);
      const matchesQuery =
        q === "" ||
        r.rawActor.includes(q) ||
        r.rawTarget.includes(q) ||
        (r.typeLabel || "").toLowerCase().includes(q);
      return matchesType && matchesAuto && matchesQuery;
    });
  }, [rows, query, typeFilter, hideAutoLogouts]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const byType = new Map();
    const byHour = new Array(24).fill(0);
    const byActor = new Map();
    filtered.forEach((r) => {
      const t = String(r.type || "unknown");
      byType.set(t, (byType.get(t) || 0) + 1);
      const d = r.createdMs ? new Date(r.createdMs) : null;
      if (d) byHour[d.getHours()] = (byHour[d.getHours()] || 0) + 1;
      const a = String(r.actor || "").trim() || "—";
      byActor.set(a, (byActor.get(a) || 0) + 1);
    });
    const typeEntries = Array.from(byType.entries()).sort(
      (a, b) => b[1] - a[1],
    );
    const actorEntries = Array.from(byActor.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
    const topTypes = typeEntries.slice(0, 7);
    const othersCount = typeEntries.slice(7).reduce((acc, [, n]) => acc + n, 0);
    const donutParts = [
      ...topTypes,
      ...(othersCount ? [["others", othersCount]] : []),
    ];
    const colors = [
      "#2563eb",
      "#16a34a",
      "#d97706",
      "#7c3aed",
      "#0f766e",
      "#dc2626",
      "#334155",
      "#64748b",
    ];
    let accPct = 0;
    const donutSegments = donutParts
      .map(([, count], idx) => {
        const start = accPct;
        const end = start + (count / Math.max(total, 1)) * 100;
        accPct = end;
        return `${colors[idx % colors.length]} ${start}% ${end}%`;
      })
      .join(", ");
    const maxHour = Math.max(1, ...byHour);
    const maxActor = Math.max(1, ...actorEntries.map(([, n]) => n));
    return {
      total,
      typeEntries,
      actorEntries,
      byHour,
      maxHour,
      maxActor,
      donutSegments,
      donutParts,
      colors,
    };
  }, [filtered]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filtered.slice(start, end);
  }, [filtered, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [query, typeFilter, hideAutoLogouts]);

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
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            className="input"
            style={{ width: 320 }}
            placeholder="Buscar por usuario o acción"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            className="select"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">Todas</option>
            <option value="user_created">Usuario creado</option>
            <option value="user_logged_in">Login</option>
            <option value="user_logged_out">Logout</option>
            <option value="user_updated">Usuario modificado</option>
            <option value="load_created">Carga creada</option>
            <option value="load_updated">Carga modificada</option>
            <option value="load_deleted">Carga borrada</option>
            <option value="pallet_created">Palet creado</option>
            <option value="pallet_updated">Palet modificado</option>
            <option value="pallet_deleted">Palet borrado</option>
            <option value="pallets_fused">Palets fusionados</option>
            <option value="location_created">Localización creada</option>
            <option value="location_updated">Localización modificada</option>
            <option value="location_deleted">Localización borrada</option>
            <option value="consignee_created">Consignatario creado</option>
            <option value="consignee_updated">Consignatario modificado</option>
            <option value="consignee_deleted">Consignatario borrado</option>
            <option value="company_created">Empresa creada</option>
            <option value="company_updated">Empresa modificada</option>
            <option value="company_deleted">Empresa borrada</option>
            <option value="cargo_type_created">Tipo de carga creado</option>
            <option value="cargo_type_updated">Tipo de carga modificado</option>
            <option value="cargo_type_deleted">Tipo de carga borrado</option>
            <option value="ship_created">Barco creado</option>
            <option value="ship_updated">Barco modificado</option>
            <option value="ship_deleted">Barco borrado</option>
            <option value="petition_created">Petición creada</option>
            <option value="petition_updated">Petición modificada</option>
            <option value="message_created">Mensaje creado</option>
            <option value="message_updated">Mensaje modificado</option>
            <option value="message_deleted">Mensaje borrado</option>
          </select>
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: "var(--text-secondary)",
              fontSize: 13,
            }}
          >
            <input
              type="checkbox"
              checked={hideAutoLogouts}
              onChange={(e) => setHideAutoLogouts(e.target.checked)}
            />
            Ocultar logouts auto
          </label>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-start",
          marginBottom: 12,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            border: "1px solid var(--border)",
            borderRadius: 999,
            overflow: "hidden",
            background: "#fff",
          }}
        >
          <button
            type="button"
            onClick={() => setTab("stats")}
            style={{
              border: "none",
              padding: "8px 12px",
              cursor: "pointer",
              background: tab === "stats" ? "var(--hover)" : "transparent",
              fontWeight: tab === "stats" ? 800 : 700,
              color: tab === "stats" ? "var(--text)" : "var(--text-secondary)",
            }}
          >
            Estadísticas
          </button>
          <button
            type="button"
            onClick={() => setTab("table")}
            style={{
              border: "none",
              padding: "8px 12px",
              cursor: "pointer",
              background: tab === "table" ? "var(--hover)" : "transparent",
              fontWeight: tab === "table" ? 800 : 700,
              color: tab === "table" ? "var(--text)" : "var(--text-secondary)",
            }}
          >
            Interacciones
          </button>
          <button
            type="button"
            onClick={() => setTab("options")}
            style={{
              border: "none",
              padding: "8px 12px",
              cursor: "pointer",
              background: tab === "options" ? "var(--hover)" : "transparent",
              fontWeight: tab === "options" ? 800 : 700,
              color:
                tab === "options" ? "var(--text)" : "var(--text-secondary)",
            }}
          >
            Opciones
          </button>
        </div>
      </div>

      {tab === "stats" ? (
        <section className="card" style={{ marginBottom: 12 }}>
          <div className="card-header">
            <h2 className="card-title">Estadísticas</h2>
          </div>
          <div style={{ padding: 16, display: "grid", gap: 14 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.1fr 1fr",
                gap: 14,
              }}
            >
              <div
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: 12,
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    width: 84,
                    height: 84,
                    borderRadius: "50%",
                    background:
                      stats.total > 0 && stats.donutSegments
                        ? `conic-gradient(${stats.donutSegments})`
                        : "#e5e7eb",
                    display: "grid",
                    placeItems: "center",
                    flex: "0 0 auto",
                  }}
                  title="Distribución por tipo"
                >
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: "50%",
                      background: "#fff",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 13,
                      fontWeight: 800,
                    }}
                  >
                    {stats.total}
                  </div>
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "var(--text-secondary)",
                      marginBottom: 8,
                    }}
                  >
                    Top tipos (según filtros)
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {stats.donutParts.map(([t, n], idx) => (
                      <div
                        key={t}
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
                            background: stats.colors[idx % stats.colors.length],
                          }}
                        />
                        {TYPE_LABELS[t] || (t === "others" ? "Otros" : t)}: {n}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: 12,
                  display: "grid",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--text-secondary)",
                  }}
                >
                  Actividad por hora
                </div>
                <div style={{ display: "grid", gap: 6 }}>
                  {stats.byHour.map((n, h) => (
                    <div
                      key={h}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "36px 1fr 36px",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{ fontSize: 12, color: "var(--text-secondary)" }}
                      >
                        {String(h).padStart(2, "0")}
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
                            width: `${Math.round((n / stats.maxHour) * 100)}%`,
                            height: "100%",
                            background: "#2563eb",
                          }}
                        />
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--text-secondary)",
                          textAlign: "right",
                        }}
                      >
                        {n}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: 12,
                display: "grid",
                gap: 10,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--text-secondary)",
                }}
              >
                Top actores
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {stats.actorEntries.length === 0 ? (
                  <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                    No hay datos para los filtros actuales
                  </div>
                ) : (
                  stats.actorEntries.map(([name, n], idx) => (
                    <div key={name} style={{ display: "grid", gap: 4 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          fontSize: 13,
                        }}
                      >
                        <div
                          style={{
                            minWidth: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={name}
                        >
                          {name}
                        </div>
                        <div style={{ color: "var(--text-secondary)" }}>
                          {n}
                        </div>
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
                            width: `${Math.round((n / stats.maxActor) * 100)}%`,
                            height: "100%",
                            background: stats.colors[idx % stats.colors.length],
                          }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      ) : tab === "table" ? (
        <>
          <DataTable
            title="Interacciones"
            columns={columns}
            data={paginated}
            loading={loading}
          />
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
        </>
      ) : (
        <section className="card" style={{ marginBottom: 12 }}>
          <div className="card-header">
            <h2 className="card-title">Opciones</h2>
          </div>
          <div style={{ padding: 16, display: "grid", gap: 12 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "10px 12px",
                border: "1px solid var(--border)",
                borderRadius: 12,
                background: "#fff",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800 }}>
                  Mostrar Peticiones para Logística/Oficina
                </div>
                <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                  Si está desactivado, solo Admin podrá ver y usar Peticiones
                </div>
              </div>
              <ToggleSwitch
                checked={peticionesEnabled}
                disabled={optionsLoading || !canEditOptions}
                onChange={async (next) => {
                  try {
                    setPendingPeticionesEnabled(next);
                    setOptionsSaving(true);
                    await setPeticionesEnabled(next);
                    setSnack({
                      open: true,
                      message: next
                        ? "Peticiones activadas"
                        : "Peticiones desactivadas",
                      type: "success",
                    });
                  } catch (err) {
                    setPendingPeticionesEnabled(null);
                    setSnack({
                      open: true,
                      message: String(
                        err?.message || "No se pudo guardar la opción",
                      ),
                      type: "error",
                    });
                  } finally {
                    setOptionsSaving(false);
                  }
                }}
              />
            </div>
            {!canEditOptions && (
              <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                Solo el rol Admin puede modificar estas opciones.
              </div>
            )}
          </div>
        </section>
      )}

      <Snackbar
        open={snack.open}
        message={snack.message}
        type={snack.type}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
      />
    </>
  );
}
