import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import DataTable from "../components/DataTable.jsx";
import CardGrid from "../components/CardGrid.jsx";
import Snackbar from "../components/Snackbar.jsx";
import Pagination from "../components/Pagination.jsx";
import { getCurrentRole, ROLES, getCurrentUser } from "../utils/roles.js";
import { fetchAllUsers } from "../firebase/auth.js";

const ROLE_OPTIONS = [
  { label: "Administrador", value: "admin" },
  { label: "Oficina", value: "dispatcher" },
  { label: "Conductor", value: "driver" },
  { label: "Almacén", value: "warehouse" },
  { label: "Mozo", value: "mozo" },
  { label: "Logistica", value: "logistic" },
];

export default function Users() {
  const columns = [
    { key: "name", header: "Nombre" },
    { key: "email", header: "Email" },
    { key: "role", header: "Rol" },
    { key: "active", header: "Activo" },
  ];

  const navigate = useNavigate();
  const role = getCurrentRole();
  const meId = getCurrentUser()?._id || getCurrentUser()?.id;
  const [view, setView] = useState("table"); // 'table' | 'cards'
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (role === ROLES.ALMACEN && meId) {
      navigate(`/app/admin/usuarios/${meId}`);
    }
  }, [role, meId, navigate]);

  // búsqueda y filtros
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all"); // 'all' | ROLE value
  const [activeFilter, setActiveFilter] = useState("all"); // 'all' | 'true' | 'false'

  // paginación
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // snackbar
  const [snack, setSnack] = useState({
    open: false,
    message: "",
    type: "success",
  });

  // cargar usuarios desde Firestore
  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        setLoading(true);
        const list = await fetchAllUsers();
        const mapped = list
          .map((u) => ({
            id: u.id,
            name: u.name || "",
            email: u.email || "",
            role:
              ROLE_OPTIONS.find((ro) => ro.value === u.role)?.label || u.role,
            active: u.active ? "Sí" : "No",
            rawRole: u.role,
            rawActive: !!u.active,
          }))
          .sort((a, b) => (a.name || "").localeCompare(b.name || "", "es"));
        if (!mounted) return;
        setRows(mapped);
      } catch (e) {
        if (!mounted) return;
        setSnack({
          open: true,
          message: "No se pudieron cargar los usuarios",
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

  const goDetail = (row) => {
    if (row.id) navigate(`/app/admin/usuarios/${row.id}`);
  };

  // filtrar por query, rol y activo
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesQuery =
        q === "" ||
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q);
      const matchesRole = roleFilter === "all" || r.rawRole === roleFilter;
      const matchesActive =
        activeFilter === "all" || String(r.rawActive) === activeFilter;
      return matchesQuery && matchesRole && matchesActive;
    });
  }, [rows, query, roleFilter, activeFilter]);

  // paginar
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filtered.slice(start, end);
  }, [filtered, page, pageSize]);

  // reset page al cambiar filtros
  useEffect(() => {
    setPage(1);
  }, [query, roleFilter, activeFilter]);

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
            placeholder="Buscar por nombre o email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            className="select"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="all">Todos los roles</option>
            {ROLE_OPTIONS.map((ro) => (
              <option key={ro.value} value={ro.value}>
                {ro.label}
              </option>
            ))}
          </select>
          <select
            className="select"
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
          >
            <option value="all">Todos</option>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
          </select>
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
          title="Usuarios"
          columns={columns}
          data={paginated}
          loading={loading}
          onRowClick={goDetail}
        />
      ) : (
        <CardGrid
          title="Usuarios"
          items={paginated.map((i) => ({
            ...i,
            name: i.name,
            subtitle: i.email,
            role: i.role,
            active: i.active,
          }))}
          loading={loading}
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

      <Snackbar
        open={snack.open}
        message={snack.message}
        type={snack.type}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
      />
    </>
  );
}
