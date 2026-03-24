import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DataTable from "../components/DataTable.jsx";
import CardGrid from "../components/CardGrid.jsx";
import Modal from "../components/Modal.jsx";
import Snackbar from "../components/Snackbar.jsx";
import Pagination from "../components/Pagination.jsx";
import { getCurrentUser } from "../utils/roles.js";
import {
  createCargoType,
  createCompany,
  createConsignee,
  createLocation,
  createResponsable,
  deleteCargoTypeById,
  deleteCompanyById,
  deleteConsigneeById,
  deleteResponsableById,
  fetchAllCargoTypes,
  fetchAllCompanies,
  fetchAllConsignees,
  fetchAllLocations,
  fetchAllResponsables,
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
        r.puerto.toLowerCase().includes(q)
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
        address
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
        <div>
          <div className="label">Puerto</div>
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
        </div>
        <div>
          <div className="label">Terminal</div>
          <input
            className="input"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            placeholder="Nombre del terminal"
          />
        </div>
        <div>
          <div className="label">Ciudad</div>
          <input
            className="input"
            value={form.ciudad}
            onChange={(e) => setForm({ ...form, ciudad: e.target.value })}
            placeholder="Ciudad"
          />
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
          r.id === editingId ? { ...r, nombre: updated.nombre } : r
        )
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
            placeholder="Buscar por nombre"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            className="icon-button"
            onClick={onCreate}
            title="Crear consignatario"
          >
            <span className="material-symbols-outlined">add_box</span>
          </button>
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
        <div>
          <div className="label">Nombre</div>
          <input
            className="input"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            placeholder="Nombre"
          />
        </div>
      </Modal>

      <Modal
        open={openEdit}
        title="Editar consignatario"
        onClose={() => setOpenEdit(false)}
        onSubmit={submitEdit}
        submitLabel="Guardar"
      >
        <div>
          <div className="label">Nombre</div>
          <input
            className="input"
            value={editForm.nombre}
            onChange={(e) =>
              setEditForm({ ...editForm, nombre: e.target.value })
            }
            placeholder="Nombre"
          />
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

function CompaniesTab() {
  const navigate = useNavigate();
  const columns = [
    { key: "nombre", header: "Nombre" },
    { key: "telefono", header: "Teléfono" },
    { key: "email", header: "Contacto" },
    { key: "fecha", header: "Creación" },
    { key: "acciones", header: "Acciones" },
  ];

  const [view, setView] = useState("table");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nombre: "", telefono: "", email: "" });

  const [openEdit, setOpenEdit] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    nombre: "",
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
          return {
            id,
            nombre: c.nombre || "",
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
        String(r.telefono || "")
          .toLowerCase()
          .includes(q) ||
        String(r.email || "")
          .toLowerCase()
          .includes(q)
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
      setForm({ nombre: "", telefono: "", email: "" });
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
                telefono: String(updated.telefono || ""),
                email: String(updated.email || ""),
              }
            : r
        )
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
          <button
            className="icon-button"
            onClick={onCreate}
            title="Crear empresa"
          >
            <span className="material-symbols-outlined">add_box</span>
          </button>
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
        <div>
          <div className="label">Nombre</div>
          <input
            className="input"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            placeholder="Nombre"
          />
        </div>
        <div>
          <div className="label">Teléfono (opcional)</div>
          <input
            className="input"
            value={form.telefono}
            onChange={(e) => setForm({ ...form, telefono: e.target.value })}
            placeholder="+34..."
          />
        </div>
        <div>
          <div className="label">Contacto (opcional)</div>
          <input
            className="input"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="correo@ejemplo.com"
          />
        </div>
      </Modal>

      <Modal
        open={openEdit}
        title="Editar empresa"
        onClose={() => setOpenEdit(false)}
        onSubmit={submitEdit}
        submitLabel="Guardar"
      >
        <div>
          <div className="label">Nombre</div>
          <input
            className="input"
            value={editForm.nombre}
            onChange={(e) =>
              setEditForm({ ...editForm, nombre: e.target.value })
            }
            placeholder="Nombre"
          />
        </div>
        <div>
          <div className="label">Teléfono (opcional)</div>
          <input
            className="input"
            value={editForm.telefono}
            onChange={(e) =>
              setEditForm({ ...editForm, telefono: e.target.value })
            }
            placeholder="+34..."
          />
        </div>
        <div>
          <div className="label">Contacto (opcional)</div>
          <input
            className="input"
            value={editForm.email}
            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
            placeholder="correo@ejemplo.com"
          />
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
            : r
        )
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
          <button
            className="icon-button"
            onClick={onCreate}
            title="Crear tipo de carga"
          >
            <span className="material-symbols-outlined">add_box</span>
          </button>
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
        <div>
          <div className="label">Nombre</div>
          <input
            className="input"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            placeholder="Nombre"
          />
        </div>
      </Modal>

      <Modal
        open={openEdit}
        title="Editar tipo de carga"
        onClose={() => setOpenEdit(false)}
        onSubmit={submitEdit}
        submitLabel="Guardar"
      >
        <div>
          <div className="label">Nombre</div>
          <input
            className="input"
            value={editForm.nombre}
            onChange={(e) =>
              setEditForm({ ...editForm, nombre: e.target.value })
            }
            placeholder="Nombre"
          />
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
            : r
        )
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
          <button
            className="icon-button"
            onClick={onCreate}
            title="Crear responsable"
          >
            <span className="material-symbols-outlined">add_box</span>
          </button>
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
          <div>
            <div className="label">Nombre</div>
            <input
              className="input"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Nombre"
            />
          </div>
          <div>
            <div className="label">E-mail</div>
            <input
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="email@..."
            />
          </div>
          <div>
            <div className="label">Teléfono</div>
            <input
              className="input"
              value={form.telefono}
              onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              placeholder="Teléfono"
            />
          </div>
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
          <div>
            <div className="label">Nombre</div>
            <input
              className="input"
              value={editForm.nombre}
              onChange={(e) =>
                setEditForm({ ...editForm, nombre: e.target.value })
              }
              placeholder="Nombre"
            />
          </div>
          <div>
            <div className="label">E-mail</div>
            <input
              className="input"
              value={editForm.email}
              onChange={(e) =>
                setEditForm({ ...editForm, email: e.target.value })
              }
              placeholder="email@..."
            />
          </div>
          <div>
            <div className="label">Teléfono</div>
            <input
              className="input"
              value={editForm.telefono}
              onChange={(e) =>
                setEditForm({ ...editForm, telefono: e.target.value })
              }
              placeholder="Teléfono"
            />
          </div>
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
  const [tab, setTab] = useState(initialTab);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

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
      <div style={{ display: tab === "cargo_types" ? "block" : "none" }}>
        <CargoTypesTab />
      </div>
      <div style={{ display: tab === "responsables" ? "block" : "none" }}>
        <ResponsablesTab />
      </div>
    </>
  );
}
