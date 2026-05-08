import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import DataTable from "../components/DataTable.jsx";
import CardGrid from "../components/CardGrid.jsx";
import Modal from "../components/Modal.jsx";
import Snackbar from "../components/Snackbar.jsx";
import Pagination from "../components/Pagination.jsx";
import FormField from "../components/FormField.jsx";
import { getCurrentUser } from "../utils/roles.js";
import {
  createCargoType,
  createCompany,
  createConsignee,
  createLocation,
  createResponsable,
  createShip,
  deleteCargoTypeById,
  deleteCompanyById,
  deleteConsigneeById,
  deleteResponsableById,
  fetchAllCargoTypes,
  fetchAllCompanies,
  fetchAllConsignees,
  fetchAllLocations,
  fetchAllResponsables,
  fetchAllShips,
  fetchCargoTypeById,
  fetchCompanyById,
  fetchConsigneeById,
  fetchResponsableById,
  updateCargoTypeById,
  updateCompanyById,
  updateConsigneeById,
  updateResponsableById,
} from "../firebase/auth.js";

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
  return null;
}

function formatDateOnly(value) {
  const d = toDate(value);
  if (!d) return "";
  return d.toLocaleDateString("es-ES");
}

function normalizeExternalUrl(raw) {
  const input = String(raw || "").trim();
  if (!input) return "";
  const withProto = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(input)
    ? input
    : `https://${input}`;
  try {
    const url = new URL(withProto);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.toString();
  } catch {
    return "";
  }
}

function truncateText(raw, maxChars = 20) {
  const text = String(raw || "");
  const max = Math.max(1, Number(maxChars) || 1);
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(1, max - 1))}…`;
}

function LocationsTab() {
  const columns = [
    { key: "puerto", header: "Puerto" },
    { key: "nombre", header: "Terminal" },
    { key: "ciudad", header: "Ciudad" },
  ];

  const navigate = useNavigate();
  const [view, setView] = useState("table");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [portMode, setPortMode] = useState("existing");
  const [selectedPort, setSelectedPort] = useState("");
  const [newPortName, setNewPortName] = useState("");
  const [form, setForm] = useState({
    nombre: "",
    ciudad: "",
    coordenadas: "",
  });
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [snack, setSnack] = useState({
    open: false,
    message: "",
    type: "success",
  });
  const mapsEnabled = import.meta.env.VITE_FEATURE_MAPS === "enabled";

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        setLoading(true);
        const list = await fetchAllLocations();
        if (!mounted) return;
        const mapped = list.map((l) => ({
          id: l._id || l.id,
          nombre: l.nombre || "",
          ciudad: l.ciudad || "",
          puerto: l.puerto || "",
          coordenadas: l.coordenadas || "",
        }));
        setRows(mapped);
      } catch {
        if (!mounted) return;
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, []);

  const ports = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => {
      const p = String(r.puerto || "").trim();
      if (p) set.add(p);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [rows]);

  const getPortName = () => {
    const name = portMode === "new" ? newPortName : selectedPort;
    return String(name || "").trim();
  };

  const onCreate = () => {
    if (ports.length > 0) {
      setPortMode("existing");
      setSelectedPort(ports[0]);
      setNewPortName("");
    } else {
      setPortMode("new");
      setSelectedPort("");
      setNewPortName("");
    }
    setForm({ nombre: "", ciudad: "", coordenadas: "" });
    setOpen(true);
  };

  const submit = async () => {
    try {
      const puerto = getPortName();
      if (!puerto) {
        setSnack({
          open: true,
          message: "Selecciona o escribe el nombre del puerto",
          type: "error",
        });
        return;
      }
      if (!String(form.nombre || "").trim()) {
        setSnack({
          open: true,
          message: "El nombre del terminal es obligatorio",
          type: "error",
        });
        return;
      }
      const created = await createLocation({
        ...form,
        puerto,
        creado_por: getCurrentUser()?.name || "Testing",
      });
      setRows((rows) => [
        {
          id: created._id || created.id,
          nombre: created.nombre || "",
          ciudad: created.ciudad || "",
          puerto: created.puerto || "",
          coordenadas: created.coordenadas || "",
        },
        ...rows,
      ]);
      setOpen(false);
      setForm({ nombre: "", ciudad: "", coordenadas: "" });
      setSnack({
        open: true,
        message: "Terminal creado",
        type: "success",
      });
    } catch (e) {
      setSnack({ open: true, message: e.message || "Error", type: "error" });
    }
  };

  const goDetail = (row) => {
    if (row.id) navigate(`/app/admin/localizaciones/${row.id}`);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        q === "" ||
        r.nombre.toLowerCase().includes(q) ||
        r.ciudad.toLowerCase().includes(q) ||
        r.puerto.toLowerCase().includes(q),
    );
  }, [rows, query]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filtered.slice(start, end);
  }, [filtered, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  const geocodeWithGoogle = async () => {
    if (!mapsEnabled) {
      setSnack({
        open: true,
        message:
          "La geolocalización por Google Maps estará disponible próximamente.",
        type: "warning",
      });
      return;
    }
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setSnack({
        open: true,
        message: "Configura la API key para Google Maps en .env",
        type: "warning",
      });
      return;
    }
    const address = (
      form.coordenadas ||
      `${form.nombre} ${form.ciudad} ${getPortName()}`.trim()
    ).trim();
    if (!address) {
      setSnack({
        open: true,
        message: "Introduce texto para buscar en Maps",
        type: "warning",
      });
      return;
    }
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        address,
      )}&key=${apiKey}&language=es`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.status !== "OK" || !json.results?.length) {
        const msg =
          json.status === "ZERO_RESULTS"
            ? "Sin resultados para la dirección"
            : `Error de Google Maps: ${json.status || "desconocido"}`;
        setSnack({ open: true, message: msg, type: "warning" });
        return;
      }
      const loc = json.results[0].geometry.location;
      setForm({ ...form, coordenadas: `${loc.lat},${loc.lng}` });
      setSnack({
        open: true,
        message: "Coordenadas obtenidas desde Google Maps",
        type: "success",
      });
    } catch (e) {
      setSnack({
        open: true,
        message: "No se pudo geolocalizar (red/API)",
        type: "error",
      });
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
          placeholder="Buscar por puerto, terminal o ciudad"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div style={{ display: "flex", gap: 8 }}>
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
            title="Crear Puerto/Terminal"
            onClick={onCreate}
          >
            <span className="material-symbols-outlined">add_box</span>
          </button>
        </div>
      </div>

      {view === "table" ? (
        <DataTable
          title="Puerto/Terminal"
          columns={columns}
          data={paginated}
          loading={loading}
          createLabel="Crear terminal"
          onCreate={onCreate}
          onRowClick={goDetail}
        />
      ) : (
        <CardGrid
          title="Puerto/Terminal"
          items={paginated.map((i) => ({
            ...i,
            name: `${i.puerto}${i.nombre ? " · " + i.nombre : ""}`,
            subtitle: i.ciudad,
          }))}
          loading={loading}
          onCreate={onCreate}
          createLabel="Crear terminal"
          onCardClick={goDetail}
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
        title="Crear terminal"
        onClose={() => setOpen(false)}
        onSubmit={submit}
        submitLabel="Crear"
      >
        <FormField label="Puerto">
          <select
            className="select"
            value={portMode === "new" ? "__new__" : selectedPort}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "__new__") {
                setPortMode("new");
                setNewPortName("");
                return;
              }
              setPortMode("existing");
              setSelectedPort(v);
            }}
          >
            {ports.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
            <option value="__new__">Nuevo puerto...</option>
          </select>
          {portMode === "new" && (
            <input
              className="input"
              style={{ marginTop: 8 }}
              value={newPortName}
              onChange={(e) => setNewPortName(e.target.value)}
              placeholder="Nombre del puerto"
            />
          )}
        </FormField>
        <FormField label="Terminal">
          <input
            className="input"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            placeholder="Nombre del terminal"
          />
        </FormField>
        <FormField label="Ciudad">
          <input
            className="input"
            value={form.ciudad}
            onChange={(e) => setForm({ ...form, ciudad: e.target.value })}
            placeholder="Ciudad"
          />
        </FormField>
        <div>
          <div
            className="label"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>Coordenadas (opcional)</span>
            <button
              className="icon-button"
              title={
                mapsEnabled
                  ? "Obtener coordenadas en Google Maps"
                  : "Geolocalización próximamente"
              }
              onClick={geocodeWithGoogle}
              type="button"
            >
              <span className="material-symbols-outlined">pin_drop</span>
            </button>
          </div>
          <input
            className="input"
            value={form.coordenadas}
            onChange={(e) => setForm({ ...form, coordenadas: e.target.value })}
            placeholder="Lat,Lng o texto"
          />
          {!mapsEnabled && (
            <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>
              Función de geolocalización en desarrollo. Próximamente.
            </div>
          )}
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

function ConsigneesTab() {
  const navigate = useNavigate();
  const columns = [
    { key: "nombre", header: "Nombre" },
    { key: "acciones", header: "Acciones" },
  ];

  const [view, setView] = useState("table");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nombre: "" });

  const [openEdit, setOpenEdit] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ nombre: "" });

  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [snack, setSnack] = useState({
    open: false,
    message: "",
    type: "success",
  });

  const startEdit = async (id) => {
    try {
      const c = await fetchConsigneeById(id);
      if (!c) return;
      setEditingId(id);
      setEditForm({ nombre: c.nombre || "" });
      setOpenEdit(true);
    } catch (e) {
      setSnack({
        open: true,
        message: "Error de red cargando consignatario",
        type: "error",
      });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Seguro que deseas borrar este consignatario?"))
      return;
    try {
      await deleteConsigneeById(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      setSnack({
        open: true,
        message: "Consignatario borrado",
        type: "success",
      });
    } catch (e) {
      setSnack({
        open: true,
        message: "Error de red borrando consignatario",
        type: "error",
      });
    }
  };

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        setLoading(true);
        const list = await fetchAllConsignees();
        if (!mounted) return;
        const mapped = list.map((c) => {
          const id = c._id || c.id;
          return {
            id,
            nombre: c.nombre,
            acciones: (
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  className="icon-button"
                  title="Editar"
                  onClick={(e) => {
                    e.stopPropagation();
                    startEdit(id);
                  }}
                >
                  <span className="material-symbols-outlined">edit</span>
                </button>
                <button
                  className="icon-button"
                  title="Borrar"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(id);
                  }}
                >
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </div>
            ),
          };
        });
        setRows(mapped);
      } catch {
        if (!mounted) return;
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
    return rows.filter((r) => q === "" || r.nombre.toLowerCase().includes(q));
  }, [rows, query]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filtered.slice(start, end);
  }, [filtered, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  const onCreate = () => setOpen(true);

  const submit = async () => {
    try {
      if (!form.nombre) {
        setSnack({
          open: true,
          message: "El nombre es obligatorio",
          type: "error",
        });
        return;
      }
      const payload = {
        nombre: form.nombre,
        creado_por: getCurrentUser()?.name || "Testing",
      };
      const created = await createConsignee(payload);
      const id = created?._id || created?.id;
      setRows((prev) => [
        ...prev,
        {
          id,
          nombre: created.nombre,
          acciones: (
            <div style={{ display: "flex", gap: 6 }}>
              <button
                className="icon-button"
                title="Editar"
                onClick={(e) => {
                  e.stopPropagation();
                  startEdit(id);
                }}
              >
                <span className="material-symbols-outlined">edit</span>
              </button>
              <button
                className="icon-button"
                title="Borrar"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(id);
                }}
              >
                <span className="material-symbols-outlined">delete</span>
              </button>
            </div>
          ),
        },
      ]);
      setOpen(false);
      setForm({ nombre: "" });
      setSnack({
        open: true,
        message: "Consignatario creado",
        type: "success",
      });
    } catch (e) {
      setSnack({
        open: true,
        message: "Error de red creando consignatario",
        type: "error",
      });
    }
  };

  const submitEdit = async () => {
    try {
      if (!editingId) return;
      if (!editForm.nombre) {
        setSnack({
          open: true,
          message: "El nombre es obligatorio",
          type: "error",
        });
        return;
      }
      const payload = {
        nombre: editForm.nombre,
        modificado_por: getCurrentUser()?.name || "Testing",
      };
      const updated = await updateConsigneeById(editingId, payload);
      if (!updated) {
        setSnack({
          open: true,
          message: "Consignatario no encontrado",
          type: "error",
        });
        return;
      }
      setRows((prev) =>
        prev.map((r) =>
          r.id === editingId ? { ...r, nombre: updated.nombre } : r,
        ),
      );
      setOpenEdit(false);
      setEditingId(null);
      setSnack({
        open: true,
        message: "Consignatario actualizado",
        type: "success",
      });
    } catch (e) {
      setSnack({
        open: true,
        message: "Error de red actualizando consignatario",
        type: "error",
      });
    }
  };

  const goDetail = (row) => {
    if (row.id) navigate(`/app/admin/consignatarios/${row.id}`);
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
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            className="input"
            style={{ width: 280 }}
            placeholder="Buscar por nombre, dirección, teléfono o email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
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
        </div>
      </div>

      {view === "table" ? (
        <DataTable
          title="Consignatarios"
          columns={columns}
          data={paginated}
          loading={loading}
          createLabel={"Crear consignatario"}
          onCreate={onCreate}
          onRowClick={goDetail}
        />
      ) : (
        <CardGrid
          title="Consignatarios"
          items={paginated.map((i) => ({ ...i, name: i.nombre }))}
          loading={loading}
          createLabel={"Crear consignatario"}
          onCreate={onCreate}
          onCardClick={goDetail}
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
        title="Crear consignatario"
        onClose={() => setOpen(false)}
        onSubmit={submit}
        submitLabel="Crear"
      >
        <FormField label="Nombre">
          <input
            className="input"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            placeholder="Nombre"
          />
        </FormField>
      </Modal>

      <Modal
        open={openEdit}
        title="Editar consignatario"
        onClose={() => setOpenEdit(false)}
        onSubmit={submitEdit}
        submitLabel="Guardar"
      >
        <FormField label="Nombre">
          <input
            className="input"
            value={editForm.nombre}
            onChange={(e) =>
              setEditForm({ ...editForm, nombre: e.target.value })
            }
            placeholder="Nombre"
          />
        </FormField>
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

function CompaniesTab() {
  const navigate = useNavigate();
  const renderDireccionCell = (value) => {
    const text = String(value || "").trim();
    if (!text) return "—";
    return (
      <div
        title={text}
        style={{
          display: "block",
          maxWidth: 320,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {text}
      </div>
    );
  };
  const columns = [
    { key: "nombre", header: "Nombre" },
    { key: "direccion", header: "Dirección" },
    { key: "telefono", header: "Teléfono" },
    { key: "email", header: "Contacto" },
    { key: "fecha", header: "Creación" },
    { key: "acciones", header: "Acciones" },
  ];

  const [view, setView] = useState("table");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    nombre: "",
    direccion: "",
    telefono: "",
    email: "",
  });

  const [openEdit, setOpenEdit] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    nombre: "",
    direccion: "",
    telefono: "",
    email: "",
  });

  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [snack, setSnack] = useState({
    open: false,
    message: "",
    type: "success",
  });

  const startEdit = async (id) => {
    try {
      const c = await fetchCompanyById(id);
      if (!c) return;
      setEditingId(id);
      setEditForm({
        nombre: c.nombre || "",
        direccion: String(c.direccion || ""),
        telefono: String(c.telefono || ""),
        email: String(c.email || ""),
      });
      setOpenEdit(true);
    } catch {
      setSnack({
        open: true,
        message: "Error de red cargando empresa",
        type: "error",
      });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Seguro que deseas borrar esta empresa?")) return;
    try {
      await deleteCompanyById(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      setSnack({ open: true, message: "Empresa borrada", type: "success" });
    } catch {
      setSnack({
        open: true,
        message: "Error de red borrando empresa",
        type: "error",
      });
    }
  };

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        setLoading(true);
        const list = await fetchAllCompanies();
        if (!mounted) return;
        const mapped = list.map((c) => {
          const id = c._id || c.id;
          const direccionText = String(c.direccion || "");
          return {
            id,
            nombre: c.nombre || "",
            direccion: renderDireccionCell(direccionText),
            direccion_text: direccionText,
            telefono: String(c.telefono || ""),
            email: String(c.email || ""),
            fecha: formatDateOnly(c.createdAt || c.fecha_creacion),
            acciones: (
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  className="icon-button"
                  title="Editar"
                  onClick={(e) => {
                    e.stopPropagation();
                    startEdit(id);
                  }}
                >
                  <span className="material-symbols-outlined">edit</span>
                </button>
                <button
                  className="icon-button"
                  title="Borrar"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(id);
                  }}
                >
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </div>
            ),
          };
        });
        setRows(mapped);
      } catch {
        if (!mounted) return;
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
    return rows.filter(
      (r) =>
        q === "" ||
        r.nombre.toLowerCase().includes(q) ||
        String(r.direccion_text || "")
          .toLowerCase()
          .includes(q) ||
        String(r.telefono || "")
          .toLowerCase()
          .includes(q) ||
        String(r.email || "")
          .toLowerCase()
          .includes(q),
    );
  }, [rows, query]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filtered.slice(start, end);
  }, [filtered, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  const onCreate = () => setOpen(true);

  const submit = async () => {
    try {
      if (!form.nombre) {
        setSnack({
          open: true,
          message: "El nombre es obligatorio",
          type: "error",
        });
        return;
      }
      const created = await createCompany({
        nombre: form.nombre,
        direccion: form.direccion,
        telefono: form.telefono,
        email: form.email,
        creado_por: getCurrentUser()?.name || "Testing",
      });
      const id = created?._id || created?.id;
      setRows((prev) => [
        ...prev,
        {
          id,
          nombre: created.nombre || "",
          direccion: renderDireccionCell(created.direccion),
          direccion_text: String(created.direccion || ""),
          telefono: String(created.telefono || ""),
          email: String(created.email || ""),
          fecha: formatDateOnly(created.createdAt || created.fecha_creacion),
          acciones: (
            <div style={{ display: "flex", gap: 6 }}>
              <button
                className="icon-button"
                title="Editar"
                onClick={(e) => {
                  e.stopPropagation();
                  startEdit(id);
                }}
              >
                <span className="material-symbols-outlined">edit</span>
              </button>
              <button
                className="icon-button"
                title="Borrar"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(id);
                }}
              >
                <span className="material-symbols-outlined">delete</span>
              </button>
            </div>
          ),
        },
      ]);
      setOpen(false);
      setForm({ nombre: "", direccion: "", telefono: "", email: "" });
      setSnack({ open: true, message: "Empresa creada", type: "success" });
    } catch (e) {
      const message =
        e?.message === "nombre es obligatorio"
          ? "El nombre es obligatorio"
          : "Error creando empresa";
      setSnack({ open: true, message, type: "error" });
    }
  };

  const submitEdit = async () => {
    try {
      if (!editingId) return;
      if (!editForm.nombre) {
        setSnack({
          open: true,
          message: "El nombre es obligatorio",
          type: "error",
        });
        return;
      }
      const updated = await updateCompanyById(editingId, {
        nombre: editForm.nombre,
        direccion: editForm.direccion,
        telefono: editForm.telefono,
        email: editForm.email,
        modificado_por: getCurrentUser()?.name || "Testing",
      });
      if (!updated) {
        setSnack({
          open: true,
          message: "Empresa no encontrada",
          type: "error",
        });
        return;
      }
      setRows((prev) =>
        prev.map((r) =>
          r.id === editingId
            ? {
                ...r,
                nombre: updated.nombre,
                direccion: renderDireccionCell(updated.direccion),
                direccion_text: String(updated.direccion || ""),
                telefono: String(updated.telefono || ""),
                email: String(updated.email || ""),
              }
            : r,
        ),
      );
      setOpenEdit(false);
      setEditingId(null);
      setSnack({ open: true, message: "Empresa actualizada", type: "success" });
    } catch {
      setSnack({
        open: true,
        message: "Error actualizando empresa",
        type: "error",
      });
    }
  };

  const goDetail = (row) => {
    if (row.id) navigate(`/app/admin/empresas/${row.id}`);
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
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            className="input"
            style={{ width: 280 }}
            placeholder="Buscar por nombre"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
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
        </div>
      </div>

      {view === "table" ? (
        <DataTable
          title="Empresas"
          columns={columns}
          data={paginated}
          loading={loading}
          createLabel={"Crear empresa"}
          onCreate={onCreate}
          onRowClick={goDetail}
        />
      ) : (
        <CardGrid
          title="Empresas"
          items={paginated.map((i) => ({
            ...i,
            name: i.nombre,
            subtitle: i.fecha,
          }))}
          loading={loading}
          createLabel={"Crear empresa"}
          onCreate={onCreate}
          onCardClick={goDetail}
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
        title="Crear empresa"
        onClose={() => setOpen(false)}
        onSubmit={submit}
        submitLabel="Crear"
      >
        <FormField label="Nombre">
          <input
            className="input"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            placeholder="Nombre"
          />
        </FormField>
        <FormField label="Dirección (opcional)">
          <textarea
            className="input"
            value={form.direccion}
            onChange={(e) => setForm({ ...form, direccion: e.target.value })}
            placeholder="Dirección"
            rows={2}
            style={{ resize: "vertical" }}
          />
        </FormField>
        <FormField label="Teléfono (opcional)">
          <input
            className="input"
            value={form.telefono}
            onChange={(e) => setForm({ ...form, telefono: e.target.value })}
            placeholder="+34..."
          />
        </FormField>
        <FormField label="Contacto (opcional)">
          <input
            className="input"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="correo@ejemplo.com"
          />
        </FormField>
      </Modal>

      <Modal
        open={openEdit}
        title="Editar empresa"
        onClose={() => setOpenEdit(false)}
        onSubmit={submitEdit}
        submitLabel="Guardar"
      >
        <FormField label="Nombre">
          <input
            className="input"
            value={editForm.nombre}
            onChange={(e) =>
              setEditForm({ ...editForm, nombre: e.target.value })
            }
            placeholder="Nombre"
          />
        </FormField>
        <FormField label="Dirección (opcional)">
          <textarea
            className="input"
            value={editForm.direccion}
            onChange={(e) =>
              setEditForm({ ...editForm, direccion: e.target.value })
            }
            placeholder="Dirección"
            rows={2}
            style={{ resize: "vertical" }}
          />
        </FormField>
        <FormField label="Teléfono (opcional)">
          <input
            className="input"
            value={editForm.telefono}
            onChange={(e) =>
              setEditForm({ ...editForm, telefono: e.target.value })
            }
            placeholder="+34..."
          />
        </FormField>
        <FormField label="Contacto (opcional)">
          <input
            className="input"
            value={editForm.email}
            onChange={(e) =>
              setEditForm({ ...editForm, email: e.target.value })
            }
            placeholder="correo@ejemplo.com"
          />
        </FormField>
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

function ShipsTab() {
  const columns = [
    { key: "nombre", header: "Nombre del barco" },
    { key: "empresa", header: "Empresa" },
    { key: "telefono", header: "Teléfono" },
    { key: "email", header: "Contacto" },
    { key: "responsable", header: "Responsable" },
    { key: "tipo", header: "Tipo" },
    { key: "cargo_type", header: "Tipo de carga" },
    { key: "enlace", header: "Enlace" },
  ];

  const navigate = useNavigate();
  const [view, setView] = useState("table");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    nombre_del_barco: "",
    empresa: "",
    responsable: "",
    tipo: "Mercante",
    cargo_type: "",
    enlace: "",
  });
  const [companies, setCompanies] = useState([]);
  const [responsables, setResponsables] = useState([]);
  const [cargoTypes, setCargoTypes] = useState([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [snack, setSnack] = useState({
    open: false,
    message: "",
    type: "success",
  });

  const [openCreateCompany, setOpenCreateCompany] = useState(false);
  const [companyForm, setCompanyForm] = useState({
    nombre: "",
    telefono: "",
    email: "",
  });

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        setLoading(true);
        const results = await Promise.allSettled([
          fetchAllShips(),
          fetchAllCompanies(),
          fetchAllResponsables(),
          fetchAllCargoTypes(),
        ]);
        const values = results.map((r) =>
          r.status === "fulfilled" && Array.isArray(r.value) ? r.value : [],
        );
        const [shipsList, companiesList, responsablesList, cargoTypesList] =
          values;
        if (!mounted) return;
        const companyNameById = new Map(
          companiesList.map((c) => [String(c.id || c._id), c.nombre || ""]),
        );
        const companyById = new Map(
          companiesList.map((c) => [String(c.id || c._id), c]),
        );
        const companyNameByName = new Map(
          companiesList
            .map((c) => [String(c.nombre || "").toLowerCase(), c.nombre || ""])
            .filter((p) => p[0] && p[1]),
        );
        const companyByName = new Map(
          companiesList
            .map((c) => [String(c.nombre || "").toLowerCase(), c])
            .filter((p) => p[0] && p[1]),
        );
        const responsableById = new Map(
          responsablesList.map((r) => [String(r.id || r._id), r]),
        );
        const responsableByEmail = new Map(
          responsablesList
            .map((r) => [String(r.email || "").toLowerCase(), r])
            .filter((p) => p[0]),
        );
        const cargoTypeNameById = new Map(
          cargoTypesList.map((t) => [String(t.id || t._id), t.nombre || ""]),
        );
        const cargoTypeNameByName = new Map(
          cargoTypesList
            .map((t) => [String(t.nombre || "").toLowerCase(), t.nombre || ""])
            .filter((p) => p[0] && p[1]),
        );

        const mapped = shipsList.map((s) => {
          const rawEmpresa = String(s.empresa || "");
          const companyName =
            s.empresa_nombre ||
            companyNameById.get(rawEmpresa) ||
            companyNameByName.get(rawEmpresa.toLowerCase()) ||
            rawEmpresa ||
            "";
          const company =
            companyById.get(rawEmpresa) ||
            companyByName.get(String(companyName || "").toLowerCase()) ||
            null;
          const rawResponsable = String(s.responsable || "");
          const r =
            responsableById.get(rawResponsable) ||
            responsableByEmail.get(rawResponsable.toLowerCase());
          const responsableName =
            s.responsable_nombre || r?.nombre || rawResponsable || "";

          const rawCargoType = String(s.cargo_type || "");
          const cargoTypeName =
            s.cargo_type_nombre ||
            cargoTypeNameById.get(rawCargoType) ||
            cargoTypeNameByName.get(rawCargoType.toLowerCase()) ||
            rawCargoType ||
            "";
          return {
            id: s.id || s._id,
            nombre: s.nombre_del_barco,
            empresa: companyName,
            telefono: String(company?.telefono || ""),
            email: String(company?.email || ""),
            responsable: responsableName,
            tipo: s.tipo || "",
            cargo_type: cargoTypeName,
            enlace: s.enlace || "",
          };
        });
        setRows(mapped);
        setCompanies(
          companiesList.map((c) => ({
            ...c,
            _id: c._id || c.id,
            id: c.id || c._id,
          })),
        );
        setResponsables(
          responsablesList.map((r) => ({
            ...r,
            _id: r._id || r.id,
            id: r.id || r._id,
          })),
        );
        setCargoTypes(
          cargoTypesList.map((t) => ({
            ...t,
            _id: t._id || t.id,
            id: t.id || t._id,
          })),
        );
      } catch {
        if (!mounted) return;
        setRows([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, []);

  const onCreate = () => setOpen(true);

  const submit = async () => {
    try {
      if (!form.nombre_del_barco) {
        setSnack({
          open: true,
          message: "El nombre del barco es obligatorio",
          type: "error",
        });
        return;
      }
      const company = companies.find(
        (c) => String(c._id || c.id) === String(form.empresa),
      );
      const responsable = responsables.find(
        (r) => String(r._id || r.id) === String(form.responsable),
      );
      const cargoType = cargoTypes.find(
        (t) => String(t._id || t.id) === String(form.cargo_type),
      );
      const payload = {
        ...form,
        empresa: form.empresa || "",
        empresa_nombre: company?.nombre || "",
        responsable: form.responsable || "",
        responsable_nombre: responsable?.nombre || "",
        responsable_email: responsable?.email || "",
        cargo_type: form.cargo_type || "",
        cargo_type_nombre: cargoType?.nombre || "",
        creado_por: getCurrentUser()?.name || "Testing",
      };
      const created = await createShip(payload);
      if (!created) {
        setSnack({ open: true, message: "Error creando barco", type: "error" });
        return;
      }
      setRows((prev) => [
        ...prev,
        {
          id: created._id || created.id,
          nombre: created.nombre_del_barco,
          empresa: created.empresa_nombre || company?.nombre || "",
          telefono: String(company?.telefono || ""),
          email: String(company?.email || ""),
          responsable: created.responsable_nombre || responsable?.nombre || "",
          tipo: created.tipo || "",
          cargo_type: created.cargo_type_nombre || cargoType?.nombre || "",
          enlace: created.enlace || form.enlace || "",
        },
      ]);
      setOpen(false);
      setForm({
        nombre_del_barco: "",
        empresa: "",
        responsable: "",
        tipo: "Mercante",
        cargo_type: "",
        enlace: "",
      });
      setSnack({ open: true, message: "Barco creado", type: "success" });
    } catch (e) {
      const message =
        e?.message === "nombre_del_barco es obligatorio"
          ? "El nombre del barco es obligatorio"
          : "Error creando barco";
      setSnack({ open: true, message, type: "error" });
    }
  };

  const goDetail = (row) => {
    if (row.id) navigate(`/app/admin/barcos/${row.id}`);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        q === "" ||
        r.nombre.toLowerCase().includes(q) ||
        r.empresa.toLowerCase().includes(q) ||
        String(r.telefono || "")
          .toLowerCase()
          .includes(q) ||
        String(r.email || "")
          .toLowerCase()
          .includes(q) ||
        r.responsable.toLowerCase().includes(q) ||
        r.tipo.toLowerCase().includes(q) ||
        String(r.cargo_type || "")
          .toLowerCase()
          .includes(q) ||
        String(r.enlace || "")
          .toLowerCase()
          .includes(q),
    );
  }, [rows, query]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filtered.slice(start, end);
  }, [filtered, page, pageSize]);

  const paginatedForTable = useMemo(() => {
    return paginated.map((r) => {
      const href = normalizeExternalUrl(r.enlace);
      if (!href) return { ...r, enlace: "" };
      const rawLabel = String(r.enlace || "").trim();
      const label = truncateText(rawLabel || href, 20);
      return {
        ...r,
        enlace: (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            title={rawLabel || href}
            onClick={(e) => e.stopPropagation()}
          >
            {label}
          </a>
        ),
      };
    });
  }, [paginated]);

  useEffect(() => {
    setPage(1);
  }, [query]);

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
          placeholder="Buscar por nombre, empresa, responsable o tipo"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div style={{ display: "flex", gap: 8 }}>
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
        </div>
      </div>

      {view === "table" ? (
        <DataTable
          title="Barcos"
          columns={columns}
          data={paginatedForTable}
          loading={loading}
          createLabel="Crear barco"
          onCreate={onCreate}
          onRowClick={goDetail}
        />
      ) : (
        <CardGrid
          title="Barcos"
          items={paginated.map((i) => ({
            ...i,
            name: i.nombre,
            subtitle: `${i.empresa} · ${i.responsable} · ${i.tipo}${
              i.cargo_type ? ` · ${i.cargo_type}` : ""
            }`,
          }))}
          loading={loading}
          onCreate={onCreate}
          createLabel="Crear barco"
          onCardClick={goDetail}
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
        title="Crear barco"
        onClose={() => setOpen(false)}
        onSubmit={submit}
        submitLabel="Crear"
      >
        <FormField label="Nombre del barco">
          <input
            className="input"
            value={form.nombre_del_barco}
            onChange={(e) =>
              setForm({ ...form, nombre_del_barco: e.target.value })
            }
            placeholder="Nombre del barco"
          />
        </FormField>
        <div>
          <div
            className="label"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>Empresa</span>
            <button
              className="icon-button"
              title="Crear empresa"
              onClick={() => setOpenCreateCompany(true)}
            >
              <span className="material-symbols-outlined">add_business</span>
            </button>
          </div>
          <select
            className="input"
            value={form.empresa}
            onChange={(e) => setForm({ ...form, empresa: e.target.value })}
          >
            <option value="">Sin empresa</option>
            {companies.map((c) => (
              <option key={c._id} value={c._id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div
            className="label"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>Responsable</span>
          </div>
          <select
            className="input"
            value={form.responsable}
            onChange={(e) => setForm({ ...form, responsable: e.target.value })}
          >
            <option value="">Sin responsable</option>
            {responsables.map((r) => (
              <option key={r._id || r.id} value={r._id || r.id}>
                {r.nombre}
                {r.email ? ` (${r.email})` : ""}
              </option>
            ))}
          </select>
        </div>
        <FormField label="Tipo">
          <select
            className="select"
            value={form.tipo}
            onChange={(e) => setForm({ ...form, tipo: e.target.value })}
          >
            <option value="Mercante">Mercante</option>
            <option value="Ferry">Ferry</option>
            <option value="Crucero">Crucero</option>
          </select>
        </FormField>
        <FormField label="Tipo de carga">
          <select
            className="input"
            value={form.cargo_type}
            onChange={(e) => setForm({ ...form, cargo_type: e.target.value })}
          >
            <option value="">Sin tipo</option>
            {cargoTypes
              .slice()
              .sort((a, b) =>
                String(a?.nombre || "").localeCompare(
                  String(b?.nombre || ""),
                  "es",
                ),
              )
              .map((t) => (
                <option key={t._id || t.id} value={t._id || t.id}>
                  {t.nombre}
                </option>
              ))}
          </select>
        </FormField>
        <FormField label="Enlace (opcional)">
          <input
            className="input"
            value={form.enlace}
            onChange={(e) => setForm({ ...form, enlace: e.target.value })}
            placeholder="https://..."
          />
        </FormField>
      </Modal>

      <Modal
        open={openCreateCompany}
        title="Crear empresa"
        onClose={() => setOpenCreateCompany(false)}
        onSubmit={async () => {
          try {
            if (!companyForm.nombre) {
              setSnack({
                open: true,
                message: "El nombre es obligatorio",
                type: "error",
              });
              return;
            }
            const created = await createCompany({
              ...companyForm,
              creado_por: getCurrentUser()?.name || "Testing",
            });
            if (!created) {
              setSnack({
                open: true,
                message: "Error creando empresa",
                type: "error",
              });
              return;
            }
            const next = {
              ...created,
              _id: created._id || created.id,
              id: created.id || created._id,
            };
            setCompanies((prev) => [...prev, next]);
            setOpenCreateCompany(false);
            setCompanyForm({ nombre: "", telefono: "", email: "" });
            setSnack({
              open: true,
              message: "Empresa creada",
              type: "success",
            });
          } catch (e) {
            const message =
              e?.message === "nombre es obligatorio"
                ? "El nombre es obligatorio"
                : "Error creando empresa";
            setSnack({ open: true, message, type: "error" });
          }
        }}
        submitLabel="Crear"
      >
        <FormField label="Nombre">
          <input
            className="input"
            value={companyForm.nombre}
            onChange={(e) =>
              setCompanyForm({ ...companyForm, nombre: e.target.value })
            }
            placeholder="Nombre de la empresa"
          />
        </FormField>
        <FormField label="Teléfono (opcional)">
          <input
            className="input"
            value={companyForm.telefono}
            onChange={(e) =>
              setCompanyForm({ ...companyForm, telefono: e.target.value })
            }
            placeholder="+34..."
          />
        </FormField>
        <FormField label="Contacto (opcional)">
          <input
            className="input"
            value={companyForm.email}
            onChange={(e) =>
              setCompanyForm({ ...companyForm, email: e.target.value })
            }
            placeholder="correo@ejemplo.com"
          />
        </FormField>
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

function CargoTypesTab() {
  const columns = [
    { key: "nombre", header: "Nombre" },
    { key: "acciones", header: "Acciones" },
  ];

  const [view, setView] = useState("table");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nombre: "" });

  const [openEdit, setOpenEdit] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ nombre: "" });

  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [snack, setSnack] = useState({
    open: false,
    message: "",
    type: "success",
  });

  const getFirestoreMessage = (e) => {
    const code = String(e?.code || "").trim();
    if (code === "permission-denied") {
      return "Permiso denegado en Firestore. Revisa las reglas";
    }
    if (code === "unauthenticated") {
      return "Sesión no válida. Vuelve a iniciar sesión";
    }
    if (code === "unavailable") {
      return "Firestore no disponible. Revisa la conexión";
    }
    if (code === "failed-precondition") {
      return "Firestore no está listo o la API no está habilitada";
    }
    if (code === "firestore/timeout") {
      return "Firestore no responde (timeout)";
    }
    if (code) return `Error en Firestore (${code})`;
    const msg = String(e?.message || "").trim();
    if (msg) return msg;
    return "";
  };

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        setLoading(true);
        const list = await fetchAllCargoTypes();
        if (!mounted) return;
        const mapped = (Array.isArray(list) ? list : []).map((t) => {
          const id = t._id || t.id;
          return {
            id,
            nombre: t.nombre || "",
          };
        });
        setRows(mapped);
      } catch (e) {
        if (!mounted) return;
        setRows([]);
        setSnack({
          open: true,
          message: getFirestoreMessage(e) || "Error cargando tipos de carga",
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

  const startEdit = async (id) => {
    try {
      const t = await fetchCargoTypeById(id);
      if (!t) return;
      setEditingId(id);
      setEditForm({ nombre: t.nombre || "" });
      setOpenEdit(true);
    } catch (e) {
      setSnack({
        open: true,
        message: getFirestoreMessage(e) || "Error cargando tipo de carga",
        type: "error",
      });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Seguro que deseas borrar este tipo de carga?"))
      return;
    try {
      await deleteCargoTypeById(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      setSnack({
        open: true,
        message: "Tipo de carga borrado",
        type: "success",
      });
    } catch (e) {
      setSnack({
        open: true,
        message: getFirestoreMessage(e) || "Error borrando tipo de carga",
        type: "error",
      });
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => q === "" || r.nombre.toLowerCase().includes(q));
  }, [rows, query]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filtered.slice(start, end);
  }, [filtered, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  const onCreate = () => setOpen(true);

  const submit = async () => {
    try {
      if (!form.nombre) {
        setSnack({
          open: true,
          message: "El nombre es obligatorio",
          type: "error",
        });
        return;
      }
      const created = await createCargoType({
        nombre: form.nombre,
        creado_por: getCurrentUser()?.name || "Testing",
      });
      const id = created?._id || created?.id;
      setRows((prev) => [
        ...prev,
        {
          id,
          nombre: created?.nombre || "",
        },
      ]);
      setOpen(false);
      setForm({ nombre: "" });
      setSnack({
        open: true,
        message: "Tipo de carga creado",
        type: "success",
      });
    } catch (e) {
      setSnack({
        open: true,
        message: getFirestoreMessage(e) || "Error creando tipo de carga",
        type: "error",
      });
    }
  };

  const submitEdit = async () => {
    try {
      if (!editingId) return;
      if (!editForm.nombre) {
        setSnack({
          open: true,
          message: "El nombre es obligatorio",
          type: "error",
        });
        return;
      }
      const updated = await updateCargoTypeById(editingId, {
        nombre: editForm.nombre,
        modificado_por: getCurrentUser()?.name || "Testing",
      });
      if (!updated) return;
      setRows((prev) =>
        prev.map((r) =>
          r.id === editingId
            ? {
                ...r,
                nombre: updated.nombre || "",
              }
            : r,
        ),
      );
      setOpenEdit(false);
      setEditingId(null);
      setSnack({
        open: true,
        message: "Tipo de carga actualizado",
        type: "success",
      });
    } catch (e) {
      setSnack({
        open: true,
        message: getFirestoreMessage(e) || "Error actualizando tipo de carga",
        type: "error",
      });
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
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            className="input"
            style={{ width: 280 }}
            placeholder="Buscar por nombre"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
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
        </div>
      </div>

      {view === "table" ? (
        <DataTable
          title="Tipo de Carga"
          columns={columns}
          data={paginated.map((r) => ({
            ...r,
            acciones: (
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  className="icon-button"
                  title="Editar"
                  onClick={(e) => {
                    e.stopPropagation();
                    startEdit(r.id);
                  }}
                >
                  <span className="material-symbols-outlined">edit</span>
                </button>
                <button
                  className="icon-button"
                  title="Borrar"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(r.id);
                  }}
                >
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </div>
            ),
          }))}
          loading={loading}
          createLabel={"Crear tipo de carga"}
          onCreate={onCreate}
        />
      ) : (
        <CardGrid
          title="Tipo de Carga"
          items={paginated.map((i) => ({
            ...i,
            name: i.nombre,
            acciones: (
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  className="icon-button"
                  title="Editar"
                  onClick={(e) => {
                    e.stopPropagation();
                    startEdit(i.id);
                  }}
                >
                  <span className="material-symbols-outlined">edit</span>
                </button>
                <button
                  className="icon-button"
                  title="Borrar"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(i.id);
                  }}
                >
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </div>
            ),
          }))}
          loading={loading}
          createLabel={"Crear tipo de carga"}
          onCreate={onCreate}
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
        title="Crear tipo de carga"
        onClose={() => setOpen(false)}
        onSubmit={submit}
        submitLabel="Crear"
      >
        <FormField label="Nombre">
          <input
            className="input"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            placeholder="Nombre"
          />
        </FormField>
      </Modal>

      <Modal
        open={openEdit}
        title="Editar tipo de carga"
        onClose={() => setOpenEdit(false)}
        onSubmit={submitEdit}
        submitLabel="Guardar"
      >
        <FormField label="Nombre">
          <input
            className="input"
            value={editForm.nombre}
            onChange={(e) =>
              setEditForm({ ...editForm, nombre: e.target.value })
            }
            placeholder="Nombre"
          />
        </FormField>
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

function ResponsablesTab() {
  const columns = [
    { key: "nombre", header: "Nombre" },
    { key: "email", header: "E-mail" },
    { key: "telefono", header: "Teléfono" },
    { key: "acciones", header: "Acciones" },
  ];

  const [view, setView] = useState("table");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nombre: "", email: "", telefono: "" });

  const [openEdit, setOpenEdit] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    nombre: "",
    email: "",
    telefono: "",
  });

  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [snack, setSnack] = useState({
    open: false,
    message: "",
    type: "success",
  });

  const startEdit = async (id) => {
    try {
      const r = await fetchResponsableById(id);
      if (!r) return;
      setEditingId(id);
      setEditForm({
        nombre: r.nombre || "",
        email: r.email || "",
        telefono: r.telefono || "",
      });
      setOpenEdit(true);
    } catch {
      setSnack({
        open: true,
        message: "Error de red cargando responsable",
        type: "error",
      });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Seguro que deseas borrar este responsable?")) return;
    try {
      await deleteResponsableById(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      setSnack({ open: true, message: "Responsable borrado", type: "success" });
    } catch {
      setSnack({
        open: true,
        message: "Error de red borrando responsable",
        type: "error",
      });
    }
  };

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        setLoading(true);
        const list = await fetchAllResponsables();
        if (!mounted) return;
        const mapped = list.map((r) => {
          const id = r._id || r.id;
          return {
            id,
            nombre: r.nombre || "",
            email: r.email || "",
            telefono: r.telefono || "",
            acciones: (
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  className="icon-button"
                  title="Editar"
                  onClick={(e) => {
                    e.stopPropagation();
                    startEdit(id);
                  }}
                >
                  <span className="material-symbols-outlined">edit</span>
                </button>
                <button
                  className="icon-button"
                  title="Borrar"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(id);
                  }}
                >
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </div>
            ),
          };
        });
        setRows(mapped);
      } catch {
        if (!mounted) return;
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
      if (q === "") return true;
      return (
        String(r.nombre || "")
          .toLowerCase()
          .includes(q) ||
        String(r.email || "")
          .toLowerCase()
          .includes(q) ||
        String(r.telefono || "")
          .toLowerCase()
          .includes(q)
      );
    });
  }, [rows, query]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filtered.slice(start, end);
  }, [filtered, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  const getFirestoreMessage = (e) => {
    const code = String(e?.code || "").trim();
    if (code === "permission-denied") {
      return "Permiso denegado en Firestore. Revisa las reglas";
    }
    if (code === "unauthenticated") {
      return "Sesión no válida. Vuelve a iniciar sesión";
    }
    if (code === "unavailable") {
      return "Firestore no disponible. Revisa la conexión";
    }
    if (code === "failed-precondition") {
      return "Firestore no está listo o la API no está habilitada";
    }
    if (code === "firestore/timeout") {
      return "Firestore no responde (timeout)";
    }
    if (code) return `Error en Firestore (${code})`;
    const msg = String(e?.message || "").trim();
    if (msg) return msg;
    return "";
  };

  const onCreate = () => setOpen(true);

  const submit = async () => {
    try {
      if (!String(form.nombre || "").trim()) {
        setSnack({
          open: true,
          message: "El nombre es obligatorio",
          type: "error",
        });
        return;
      }
      const created = await createResponsable({
        nombre: form.nombre,
        email: form.email,
        telefono: form.telefono,
        creado_por: getCurrentUser()?.name || "Testing",
      });
      const id = created?._id || created?.id;
      setRows((prev) => [
        ...prev,
        {
          id,
          nombre: created?.nombre || "",
          email: created?.email || "",
          telefono: created?.telefono || "",
          acciones: (
            <div style={{ display: "flex", gap: 6 }}>
              <button
                className="icon-button"
                title="Editar"
                onClick={(e) => {
                  e.stopPropagation();
                  startEdit(id);
                }}
              >
                <span className="material-symbols-outlined">edit</span>
              </button>
              <button
                className="icon-button"
                title="Borrar"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(id);
                }}
              >
                <span className="material-symbols-outlined">delete</span>
              </button>
            </div>
          ),
        },
      ]);
      setOpen(false);
      setForm({ nombre: "", email: "", telefono: "" });
      setSnack({ open: true, message: "Responsable creado", type: "success" });
    } catch (e) {
      const firestoreMessage = getFirestoreMessage(e);
      const message =
        e?.message === "nombre es obligatorio"
          ? "El nombre es obligatorio"
          : firestoreMessage || "Error creando responsable";
      setSnack({ open: true, message, type: "error" });
    }
  };

  const submitEdit = async () => {
    try {
      if (!editingId) return;
      if (!String(editForm.nombre || "").trim()) {
        setSnack({
          open: true,
          message: "El nombre es obligatorio",
          type: "error",
        });
        return;
      }
      const updated = await updateResponsableById(editingId, {
        nombre: editForm.nombre,
        email: editForm.email,
        telefono: editForm.telefono,
        modificado_por: getCurrentUser()?.name || "Testing",
      });
      if (!updated) {
        setSnack({
          open: true,
          message: "Responsable no encontrado",
          type: "error",
        });
        return;
      }
      setRows((prev) =>
        prev.map((r) =>
          r.id === editingId
            ? {
                ...r,
                nombre: updated.nombre || "",
                email: updated.email || "",
                telefono: updated.telefono || "",
              }
            : r,
        ),
      );
      setOpenEdit(false);
      setEditingId(null);
      setSnack({
        open: true,
        message: "Responsable actualizado",
        type: "success",
      });
    } catch (e) {
      const firestoreMessage = getFirestoreMessage(e);
      setSnack({
        open: true,
        message: firestoreMessage || "Error actualizando responsable",
        type: "error",
      });
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
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            className="input"
            style={{ width: 280 }}
            placeholder="Buscar por nombre, e-mail o teléfono"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
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
        </div>
      </div>

      {view === "table" ? (
        <DataTable
          title="Responsables"
          columns={columns}
          data={paginated}
          loading={loading}
          createLabel={"Crear responsable"}
          onCreate={onCreate}
        />
      ) : (
        <CardGrid
          title="Responsables"
          items={paginated.map((i) => ({
            ...i,
            name: i.nombre,
            email: i.email,
            subtitle: i.telefono,
          }))}
          loading={loading}
          createLabel={"Crear responsable"}
          onCreate={onCreate}
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
        title="Crear responsable"
        onClose={() => setOpen(false)}
        onSubmit={submit}
        submitLabel="Crear"
      >
        <div style={{ display: "grid", gap: 10 }}>
          <FormField label="Nombre">
            <input
              className="input"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Nombre"
            />
          </FormField>
          <FormField label="E-mail">
            <input
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="email@..."
            />
          </FormField>
          <FormField label="Teléfono">
            <input
              className="input"
              value={form.telefono}
              onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              placeholder="Teléfono"
            />
          </FormField>
        </div>
      </Modal>

      <Modal
        open={openEdit}
        title="Editar responsable"
        onClose={() => setOpenEdit(false)}
        onSubmit={submitEdit}
        submitLabel="Guardar"
      >
        <div style={{ display: "grid", gap: 10 }}>
          <FormField label="Nombre">
            <input
              className="input"
              value={editForm.nombre}
              onChange={(e) =>
                setEditForm({ ...editForm, nombre: e.target.value })
              }
              placeholder="Nombre"
            />
          </FormField>
          <FormField label="E-mail">
            <input
              className="input"
              value={editForm.email}
              onChange={(e) =>
                setEditForm({ ...editForm, email: e.target.value })
              }
              placeholder="email@..."
            />
          </FormField>
          <FormField label="Teléfono">
            <input
              className="input"
              value={editForm.telefono}
              onChange={(e) =>
                setEditForm({ ...editForm, telefono: e.target.value })
              }
              placeholder="Teléfono"
            />
          </FormField>
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

export default function Collections({ initialTab = "locations" }) {
  const VALID_TABS = useMemo(
    () =>
      new Set([
        "locations",
        "consignees",
        "companies",
        "ships",
        "cargo_types",
        "responsables",
      ]),
    [],
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = String(searchParams.get("tab") || "").trim();
  const tabFromUrlValid = VALID_TABS.has(tabFromUrl);
  const resolvedInitialTab = tabFromUrlValid ? tabFromUrl : initialTab;

  const [tab, setTab] = useState(resolvedInitialTab);

  useEffect(() => {
    setTab(resolvedInitialTab);
  }, [resolvedInitialTab]);

  useEffect(() => {
    if (!VALID_TABS.has(tab)) return;
    if (tabFromUrl === tab) return;
    setSearchParams({ tab }, { replace: true });
  }, [VALID_TABS, setSearchParams, tab, tabFromUrl]);

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 12,
          alignItems: "center",
        }}
      >
        <h2 style={{ margin: 0 }}>Colecciones</h2>
        <div className="tabs">
          <button
            type="button"
            className={`tab-button ${tab === "locations" ? "active" : ""}`}
            onClick={() => setTab("locations")}
          >
            Puerto/Terminal
          </button>
          <button
            type="button"
            className={`tab-button ${tab === "consignees" ? "active" : ""}`}
            onClick={() => setTab("consignees")}
          >
            Consignatarios
          </button>
          <button
            type="button"
            className={`tab-button ${tab === "companies" ? "active" : ""}`}
            onClick={() => setTab("companies")}
          >
            Empresas
          </button>
          <button
            type="button"
            className={`tab-button ${tab === "ships" ? "active" : ""}`}
            onClick={() => setTab("ships")}
          >
            Barcos
          </button>
          <button
            type="button"
            className={`tab-button ${tab === "cargo_types" ? "active" : ""}`}
            onClick={() => setTab("cargo_types")}
          >
            Tipo de Carga
          </button>
          <button
            type="button"
            className={`tab-button ${tab === "responsables" ? "active" : ""}`}
            onClick={() => setTab("responsables")}
          >
            Responsables
          </button>
        </div>
      </div>

      <div style={{ display: tab === "locations" ? "block" : "none" }}>
        <LocationsTab />
      </div>
      <div style={{ display: tab === "consignees" ? "block" : "none" }}>
        <ConsigneesTab />
      </div>
      <div style={{ display: tab === "companies" ? "block" : "none" }}>
        <CompaniesTab />
      </div>
      <div style={{ display: tab === "ships" ? "block" : "none" }}>
        <ShipsTab />
      </div>
      <div style={{ display: tab === "cargo_types" ? "block" : "none" }}>
        <CargoTypesTab />
      </div>
      <div style={{ display: tab === "responsables" ? "block" : "none" }}>
        <ResponsablesTab />
      </div>
    </>
  );
}
