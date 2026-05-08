import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DataTable from "../components/DataTable.jsx";
import Modal from "../components/Modal.jsx";
import Pagination from "../components/Pagination.jsx";
import Snackbar from "../components/Snackbar.jsx";
import SearchableSelect from "../components/SearchableSelect.jsx";
import FormField from "../components/FormField.jsx";
import { useFeatureOptions } from "../contexts/useFeatureOptions.js";
import {
  createPeticion,
  fetchAllConsignees,
  fetchAllLocations,
  fetchAllPeticiones,
  fetchAllResponsables,
  fetchAllShips,
  fetchAllUsers,
} from "../firebase/auth.js";
import { getCurrentRole, getCurrentUser, ROLES } from "../utils/roles.js";

const ENTREGA_OPTIONS = ["Provisión", "Repuesto", "Técnico"];

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDate(value) {
  const d = toDate(value);
  if (!d) return "";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export default function Peticiones() {
  const navigate = useNavigate();
  const role = getCurrentRole();
  const canView =
    role === ROLES.LOGISTICA || role === ROLES.ADMIN || role === ROLES.OFICINA;
  const canFilterEstado = role === ROLES.LOGISTICA || role === ROLES.ADMIN;
  const canCreate = role === ROLES.OFICINA;
  const { featureOptions, loading: featureOptionsLoading } =
    useFeatureOptions();
  const peticionesEnabled = featureOptions?.peticiones_enabled !== false;

  const [loading, setLoading] = useState(true);
  const [peticiones, setPeticiones] = useState([]);
  const [ships, setShips] = useState([]);
  const [users, setUsers] = useState([]);
  const [responsables, setResponsables] = useState([]);
  const [consignees, setConsignees] = useState([]);
  const [locations, setLocations] = useState([]);
  const [query, setQuery] = useState("");
  const [estadoView, setEstadoView] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [openCreate, setOpenCreate] = useState(false);
  const [form, setForm] = useState({
    barco: "",
    barco_nombre: "",
    entrega: [],
    chofer: "",
    responsable: "",
    consignatario: "",
    terminal_entrega: "",
    fecha_de_carga: "",
    hora_de_carga: "",
    fecha_de_descarga: "",
    hora_de_descarga: "",
    cash: false,
    lancha: false,
    estado_viaje: "Pendiente",
    notas: "",
  });
  const [snack, setSnack] = useState({
    open: false,
    message: "",
    type: "success",
  });

  useEffect(() => {
    if (!canView) return;
    if (featureOptionsLoading) return;
    if (!peticionesEnabled && role !== ROLES.ADMIN) {
      setLoading(false);
      setPeticiones([]);
      return;
    }
    let mounted = true;
    const run = async () => {
      try {
        setLoading(true);
        const [
          petList,
          shipList,
          usersList,
          responsablesList,
          consigneesList,
          locList,
        ] = await Promise.all([
          fetchAllPeticiones(),
          fetchAllShips(),
          fetchAllUsers(),
          fetchAllResponsables(),
          fetchAllConsignees(),
          fetchAllLocations(),
        ]);
        if (!mounted) return;
        setPeticiones(Array.isArray(petList) ? petList : []);
        setShips(Array.isArray(shipList) ? shipList : []);
        setUsers(Array.isArray(usersList) ? usersList : []);
        setResponsables(
          Array.isArray(responsablesList) ? responsablesList : [],
        );
        setConsignees(Array.isArray(consigneesList) ? consigneesList : []);
        setLocations(Array.isArray(locList) ? locList : []);
      } catch (e) {
        if (!mounted) return;
        setPeticiones([]);
        setShips([]);
        setUsers([]);
        setResponsables([]);
        setConsignees([]);
        setLocations([]);
        setSnack({
          open: true,
          message: String(e?.message || "No se pudieron cargar las peticiones"),
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
  }, [canView, featureOptionsLoading, peticionesEnabled, role]);

  const shipNameById = useMemo(() => {
    const map = new Map();
    (ships || []).forEach((s) => {
      const id = String(s?._id || s?.id || "").trim();
      if (!id) return;
      const name = String(s?.nombre_del_barco || "").trim();
      if (name) map.set(id, name);
    });
    return map;
  }, [ships]);

  const userNameById = useMemo(() => {
    const map = new Map();
    (users || []).forEach((u) => {
      const id = String(u?._id || u?.id || "").trim();
      if (!id) return;
      const name = String(u?.name || u?.nombre || "").trim();
      if (name) map.set(id, name);
    });
    return map;
  }, [users]);

  const responsableNameById = useMemo(() => {
    const map = new Map();
    (responsables || []).forEach((r) => {
      const id = String(r?._id || r?.id || "").trim();
      if (!id) return;
      const name = String(r?.nombre || r?.name || "").trim();
      if (name) map.set(id, name);
    });
    return map;
  }, [responsables]);

  const consigneeNameById = useMemo(() => {
    const map = new Map();
    (consignees || []).forEach((c) => {
      const id = String(c?._id || c?.id || "").trim();
      if (!id) return;
      const name = String(c?.nombre || c?.name || "").trim();
      if (name) map.set(id, name);
    });
    return map;
  }, [consignees]);

  const locationNameById = useMemo(() => {
    const map = new Map();
    (locations || []).forEach((l) => {
      const id = String(l?._id || l?.id || "").trim();
      if (!id) return;
      const name = String(l?.nombre || l?.name || "").trim();
      if (name) map.set(id, name);
    });
    return map;
  }, [locations]);

  const filtered = useMemo(() => {
    const q = String(query || "")
      .trim()
      .toLowerCase();
    return (peticiones || [])
      .filter((p) => String(p?.creado_por_role || "").trim() === "dispatcher")
      .filter((p) => {
        if (!canFilterEstado || estadoView === "all") return true;
        const estado = String(p?.estado || "")
          .trim()
          .toLowerCase();
        if (estadoView === "pendiente")
          return estado === "pendiente" || estado === "";
        if (estadoView === "realizado")
          return estado === "realizado" || estado === "convertida";
        return true;
      })
      .filter((p) => {
        if (!q) return true;
        const barcoName =
          String(p?.barco_nombre || "").trim() ||
          shipNameById.get(String(p?.barco || "").trim()) ||
          "";
        return (
          barcoName.toLowerCase().includes(q) ||
          String(p?.fecha_de_descarga || "")
            .toLowerCase()
            .includes(q) ||
          String(p?.estado || "")
            .toLowerCase()
            .includes(q) ||
          String(p?.creado_por_name || "")
            .toLowerCase()
            .includes(q)
        );
      })
      .slice()
      .sort((a, b) => {
        const aMs = toDate(a?.createdAt || a?.fecha_creacion)?.getTime?.() || 0;
        const bMs = toDate(b?.createdAt || b?.fecha_creacion)?.getTime?.() || 0;
        return bMs - aMs;
      });
  }, [peticiones, query, shipNameById, canFilterEstado, estadoView]);

  useEffect(() => {
    setPage(1);
  }, [query, estadoView]);

  const rows = useMemo(() => {
    return filtered.map((p) => {
      const barcoId = String(p?.barco || "").trim();
      const choferId = String(p?.chofer || "").trim();
      const responsableId = String(p?.responsable || "").trim();
      const consignatarioId = String(p?.consignatario || "").trim();
      const terminalId = String(p?.terminal_entrega || "").trim();
      return {
        id: String(p?._id || p?.id || ""),
        barco:
          String(p?.barco_nombre || "").trim() ||
          shipNameById.get(barcoId) ||
          barcoId,
        fecha_de_carga: String(p?.fecha_de_carga || ""),
        hora_de_carga: String(p?.hora_de_carga || ""),
        fecha_de_descarga: String(p?.fecha_de_descarga || ""),
        hora_de_descarga: String(p?.hora_de_descarga || ""),
        entrega: Array.isArray(p?.entrega) ? p.entrega.join(", ") : "",
        responsable: responsableNameById.get(responsableId) || responsableId,
        chofer: userNameById.get(choferId) || choferId,
        consignatario:
          consigneeNameById.get(consignatarioId) || consignatarioId,
        terminal: locationNameById.get(terminalId) || terminalId,
        cash: p?.cash ? "Sí" : "",
        lancha: p?.lancha ? "Sí" : "",
        estado_viaje: String(p?.estado_viaje || ""),
        notas: String(p?.notas || ""),
        estado: String(p?.estado || "Pendiente"),
        creado_por: String(p?.creado_por_name || ""),
        creado_el: formatDate(p?.createdAt || p?.fecha_creacion),
      };
    });
  }, [
    filtered,
    shipNameById,
    responsableNameById,
    userNameById,
    consigneeNameById,
    locationNameById,
  ]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return rows.slice(start, end);
  }, [rows, page, pageSize]);

  const columns = useMemo(
    () => [
      { key: "barco", header: "Barco" },
      { key: "fecha_de_carga", header: "Fecha carga" },
      { key: "hora_de_carga", header: "Hora carga" },
      { key: "fecha_de_descarga", header: "Fecha descarga" },
      { key: "hora_de_descarga", header: "Hora descarga" },
      { key: "entrega", header: "Entrega" },
      { key: "responsable", header: "Responsable" },
      { key: "chofer", header: "Chofer" },
      { key: "consignatario", header: "Consignatario" },
      { key: "terminal", header: "Terminal" },
      { key: "cash", header: "Cash" },
      { key: "lancha", header: "Lancha" },
      { key: "estado_viaje", header: "Estado viaje" },
      { key: "notas", header: "Notas" },
      { key: "estado", header: "Estado" },
      { key: "creado_por", header: "Creado por" },
      { key: "creado_el", header: "Creado el" },
    ],
    [],
  );

  const openCreateModal = () => {
    const today = (() => {
      const d = new Date();
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      return `${yyyy}-${mm}-${dd}`;
    })();
    setForm({
      barco: "",
      barco_nombre: "",
      entrega: [],
      chofer: "",
      responsable: "",
      consignatario: "",
      terminal_entrega: "",
      fecha_de_carga: "",
      hora_de_carga: "",
      fecha_de_descarga: today,
      hora_de_descarga: "",
      cash: false,
      lancha: false,
      estado_viaje: "Pendiente",
      notas: "",
    });
    setOpenCreate(true);
  };

  const submitCreate = async () => {
    try {
      const fechaDescarga = String(form.fecha_de_descarga || "").trim();
      if (!fechaDescarga) {
        setSnack({
          open: true,
          message: "La fecha de descarga es obligatoria",
          type: "error",
        });
        return;
      }
      const barcoKey = String(form.barco || "").trim();
      const barcoNombreManual = String(form.barco_nombre || "").trim();
      let barcoId = "";
      let barcoNombre = "";
      if (barcoKey && barcoKey !== "__manual__") {
        barcoId = barcoKey;
        const ship = ships.find(
          (s) => String(s?._id || s?.id || "") === barcoId,
        );
        barcoNombre = String(ship?.nombre_del_barco || "").trim();
      } else {
        barcoNombre = barcoNombreManual;
      }
      if (!barcoNombre) {
        setSnack({
          open: true,
          message: "Indica el nombre del barco",
          type: "error",
        });
        return;
      }
      const actor = getCurrentUser();
      const created = await createPeticion({
        barco: barcoId,
        barco_nombre: barcoNombre,
        entrega: Array.isArray(form.entrega) ? form.entrega : [],
        chofer: String(form.chofer || "").trim(),
        responsable: String(form.responsable || "").trim(),
        consignatario: String(form.consignatario || "").trim(),
        terminal_entrega: String(form.terminal_entrega || "").trim(),
        fecha_de_carga: String(form.fecha_de_carga || "").trim(),
        hora_de_carga: String(form.hora_de_carga || "").trim(),
        fecha_de_descarga: fechaDescarga,
        hora_de_descarga: String(form.hora_de_descarga || "").trim(),
        cash: !!form.cash,
        lancha: !!form.lancha,
        estado_viaje: String(form.estado_viaje || "").trim(),
        notas: String(form.notas || "").trim(),
        creado_por_uid: String(actor?._id || actor?.id || "").trim(),
        creado_por_name: String(actor?.name || "").trim() || "Testing",
        creado_por_role: String(role || "").trim(),
      });
      if (!created) throw new Error("Error creando petición");
      setPeticiones((prev) => [created, ...(Array.isArray(prev) ? prev : [])]);
      setOpenCreate(false);
      setSnack({ open: true, message: "Petición creada", type: "success" });
    } catch (e) {
      setSnack({
        open: true,
        message: String(e?.message || "No se pudo crear la petición"),
        type: "error",
      });
    }
  };

  if (!canView) {
    return (
      <>
        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Peticiones</h2>
          </div>
          <div style={{ padding: 16, color: "var(--text-secondary)" }}>
            No tienes permisos para ver Peticiones.
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
  if (!featureOptionsLoading && !peticionesEnabled && role !== ROLES.ADMIN) {
    return (
      <>
        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Peticiones</h2>
          </div>
          <div style={{ padding: 16, color: "var(--text-secondary)" }}>
            La funcionalidad de Peticiones no está activa.
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
          <input
            className="input"
            style={{ width: 320 }}
            placeholder="Buscar por barco, fecha, estado o creador"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {canFilterEstado && (
            <select
              className="select"
              value={estadoView}
              onChange={(e) => setEstadoView(String(e.target.value || "all"))}
              style={{ width: 190 }}
            >
              <option value="all">Todos</option>
              <option value="pendiente">Pendientes</option>
              <option value="realizado">Realizados</option>
            </select>
          )}
        </div>
        {canCreate && (
          <button
            type="button"
            className="primary-button"
            onClick={openCreateModal}
            aria-label="Crear petición"
          >
            <span
              className="material-symbols-outlined"
              style={{ marginRight: 6 }}
            >
              add
            </span>
            Crear petición
          </button>
        )}
      </div>

      <DataTable
        title="Peticiones"
        columns={columns}
        data={paginated}
        loading={loading}
        onRowClick={(row) => {
          const id = String(row?.id || "").trim();
          if (!id) return;
          navigate(`/app/logistica/peticiones/${id}`);
        }}
      />

      <Modal
        open={openCreate}
        title="Crear petición"
        onClose={() => setOpenCreate(false)}
        onSubmit={submitCreate}
        submitLabel="Crear"
        width={720}
      >
        <div style={{ display: "grid", gap: 12 }}>
          <FormField label="Barco">
            <SearchableSelect
              value={form.barco}
              onChange={(val) =>
                setForm((p) => ({
                  ...p,
                  barco: val,
                  barco_nombre:
                    val && val !== "__manual__" ? "" : p.barco_nombre,
                }))
              }
              placeholder="Selecciona barco"
              searchPlaceholder="Buscar barco..."
              maxHeight={420}
              options={[
                { value: "", label: "Selecciona barco" },
                { value: "__manual__", label: "Otro (escribir nombre)" },
                ...ships
                  .slice()
                  .sort((a, b) =>
                    String(a?.nombre_del_barco || "").localeCompare(
                      String(b?.nombre_del_barco || ""),
                      "es",
                    ),
                  )
                  .map((s) => ({
                    value: String(s?._id || s?.id || ""),
                    label: String(s?.nombre_del_barco || "").trim() || "-",
                  })),
              ]}
            />
          </FormField>

          {form.barco === "__manual__" && (
            <FormField label="Nombre del barco">
              <input
                className="input"
                value={form.barco_nombre}
                onChange={(e) =>
                  setForm((p) => ({ ...p, barco_nombre: e.target.value }))
                }
                placeholder="Nombre del barco"
              />
            </FormField>
          )}

          <div className="form-row">
            <FormField label="Fecha y hora de descarga">
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
                    setForm((p) => ({
                      ...p,
                      fecha_de_descarga: e.target.value,
                    }))
                  }
                />
                <input
                  type="time"
                  className="input"
                  value={form.hora_de_descarga}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, hora_de_descarga: e.target.value }))
                  }
                />
              </div>
            </FormField>

            <FormField label="Fecha y hora de carga (opcional)">
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
                    setForm((p) => ({ ...p, fecha_de_carga: e.target.value }))
                  }
                />
                <input
                  type="time"
                  className="input"
                  value={form.hora_de_carga}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, hora_de_carga: e.target.value }))
                  }
                />
              </div>
            </FormField>
          </div>

          <FormField label="Entrega (opcional)">
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {ENTREGA_OPTIONS.map((opt) => (
                <label
                  key={opt}
                  style={{ display: "flex", alignItems: "center", gap: 4 }}
                >
                  <input
                    type="checkbox"
                    checked={form.entrega.includes(opt)}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        entrega: e.target.checked
                          ? [...p.entrega, opt]
                          : p.entrega.filter((v) => v !== opt),
                      }))
                    }
                  />
                  {opt}
                </label>
              ))}
            </div>
          </FormField>

          <div className="form-row">
            <FormField label="Responsable (opcional)">
              <SearchableSelect
                value={form.responsable}
                onChange={(val) => setForm((p) => ({ ...p, responsable: val }))}
                placeholder="Sin responsable"
                searchPlaceholder="Buscar responsable..."
                options={[
                  { value: "", label: "Sin responsable" },
                  ...responsables
                    .slice()
                    .sort((a, b) =>
                      String(a?.nombre || "").localeCompare(
                        String(b?.nombre || ""),
                        "es",
                      ),
                    )
                    .map((r) => ({
                      value: String(r?._id || r?.id || ""),
                      label: String(r?.nombre || "").trim() || "-",
                    })),
                ]}
              />
            </FormField>

            <FormField label="Chofer (opcional)">
              <SearchableSelect
                value={form.chofer}
                onChange={(val) => setForm((p) => ({ ...p, chofer: val }))}
                placeholder="Sin chofer"
                searchPlaceholder="Buscar chofer..."
                options={[
                  { value: "", label: "Sin chofer" },
                  ...users
                    .filter((u) => String(u?.role || "") === "driver")
                    .slice()
                    .sort((a, b) =>
                      String(a?.name || "").localeCompare(
                        String(b?.name || ""),
                        "es",
                      ),
                    )
                    .map((u) => ({
                      value: String(u?._id || u?.id || ""),
                      label: String(u?.name || "").trim() || "-",
                    })),
                ]}
              />
            </FormField>
          </div>

          <div className="form-row">
            <FormField label="Consignatario (opcional)">
              <SearchableSelect
                value={form.consignatario}
                onChange={(val) =>
                  setForm((p) => ({ ...p, consignatario: val }))
                }
                placeholder="Sin consignatario"
                searchPlaceholder="Buscar consignatario..."
                options={[
                  { value: "", label: "Sin consignatario" },
                  ...consignees
                    .slice()
                    .sort((a, b) =>
                      String(a?.nombre || "").localeCompare(
                        String(b?.nombre || ""),
                        "es",
                      ),
                    )
                    .map((c) => ({
                      value: String(c?._id || c?.id || ""),
                      label: String(c?.nombre || "").trim() || "-",
                    })),
                ]}
              />
            </FormField>

            <FormField label="Terminal (opcional)">
              <SearchableSelect
                value={form.terminal_entrega}
                onChange={(val) =>
                  setForm((p) => ({ ...p, terminal_entrega: val }))
                }
                placeholder="Sin terminal"
                searchPlaceholder="Buscar terminal..."
                options={[
                  { value: "", label: "Sin terminal" },
                  ...locations
                    .slice()
                    .sort((a, b) =>
                      String(a?.nombre || "").localeCompare(
                        String(b?.nombre || ""),
                        "es",
                      ),
                    )
                    .map((l) => ({
                      value: String(l?._id || l?.id || ""),
                      label: String(l?.nombre || "").trim() || "-",
                    })),
                ]}
              />
            </FormField>
          </div>

          <FormField label="Extras (opcional)">
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <label
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <input
                  type="checkbox"
                  checked={!!form.cash}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, cash: e.target.checked }))
                  }
                />
                Cobro en efectivo
              </label>
              <label
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <input
                  type="checkbox"
                  checked={!!form.lancha}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, lancha: e.target.checked }))
                  }
                />
                Es lancha
              </label>
            </div>
          </FormField>

          <FormField label="Notas (opcional)">
            <textarea
              className="input"
              rows="3"
              value={form.notas}
              onChange={(e) =>
                setForm((p) => ({ ...p, notas: e.target.value }))
              }
              placeholder="Comentarios adicionales"
              style={{ height: "auto", minHeight: 76, resize: "vertical" }}
            />
          </FormField>
        </div>
      </Modal>

      <Pagination
        page={page}
        pageSize={pageSize}
        total={rows.length}
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
