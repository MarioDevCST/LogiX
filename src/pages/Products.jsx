import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DataTable from "../components/DataTable.jsx";
import Modal from "../components/Modal.jsx";
import Pagination from "../components/Pagination.jsx";
import Snackbar from "../components/Snackbar.jsx";
import { createProducto, fetchAllProductos } from "../firebase/auth.js";
import { ROLES, getCurrentRole, getCurrentUser } from "../utils/roles.js";

function statusChip(estadoValue) {
  const raw = String(estadoValue || "").trim();
  const lower = raw.toLowerCase();
  const label = lower
    ? `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`
    : "-";

  const palette =
    lower === "disponible"
      ? { bg: "#dcfce7", fg: "#166534" }
      : lower === "no disponible"
        ? { bg: "#fee2e2", fg: "#991b1b" }
        : { bg: "#e5e7eb", fg: "#111827" };

  return (
    <span
      className="chip"
      style={{
        background: palette.bg,
        color: palette.fg,
        fontWeight: 600,
      }}
    >
      {label}
    </span>
  );
}

export default function Products() {
  const navigate = useNavigate();
  const role = getCurrentRole();
  const isWarehouse = role === ROLES.ALMACEN;
  const isOffice = role === ROLES.OFICINA;
  const isReadOnly = isWarehouse || isOffice;

  const columns = [
    { key: "codigo", header: "Código" },
    { key: "nombre_producto", header: "Nombre del producto" },
    { key: "familia", header: "Familia" },
    { key: "composicion", header: "Composición" },
    { key: "alergenos", header: "Alérgenos" },
    { key: "estado", header: "Estado" },
  ];

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    codigo: "",
    nombre_producto: "",
    familia: "",
    composicion: "",
    alergenos: "",
    estado: "disponible",
  });
  const [snack, setSnack] = useState({
    open: false,
    message: "",
    type: "success",
  });

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        setLoading(true);
        const list = await fetchAllProductos();
        if (!mounted) return;
        setRows(Array.isArray(list) ? list : []);
      } catch (e) {
        if (!mounted) return;
        setRows([]);
        const code = String(e?.code || "").trim();
        const msg = String(e?.message || "").trim();
        const isPerm =
          code === "permission-denied" ||
          code === "PERMISSION_DENIED" ||
          msg.toLowerCase().includes("insufficient permissions");
        setSnack({
          open: true,
          message: isPerm
            ? "No tienes permisos para leer Productos en Firestore (revisa firestore.rules desplegadas)"
            : `Error cargando productos${code ? ` (${code})` : ""}`,
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
      if (q === "") return true;
      return (
        String(r?.codigo || "")
          .toLowerCase()
          .includes(q) ||
        String(r?.nombre_producto || "")
          .toLowerCase()
          .includes(q) ||
        String(r?.familia || "")
          .toLowerCase()
          .includes(q) ||
        String(r?.composicion || "")
          .toLowerCase()
          .includes(q) ||
        String(r?.alergenos || "")
          .toLowerCase()
          .includes(q) ||
        String(r?.estado || "")
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

  const tableRows = useMemo(() => {
    return paginated.map((p) => ({
      ...p,
      codigo: p?.codigo || "-",
      estado: statusChip(p?.estado),
    }));
  }, [paginated]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  const onCreate = () => setOpen(true);

  const submit = async () => {
    try {
      if (isReadOnly) {
        setSnack({
          open: true,
          message: "No tienes permisos para crear productos",
          type: "error",
        });
        return;
      }
      const payload = {
        codigo: form.codigo,
        nombre_producto: form.nombre_producto,
        familia: form.familia,
        composicion: form.composicion,
        alergenos: form.alergenos,
        estado: form.estado,
        creado_por: getCurrentUser()?.name || "Testing",
      };
      if (!payload.nombre_producto) {
        setSnack({
          open: true,
          message: "El nombre del producto es obligatorio",
          type: "error",
        });
        return;
      }
      const created = await createProducto(payload);
      if (!created) {
        setSnack({
          open: true,
          message: "Error creando producto",
          type: "error",
        });
        return;
      }
      setRows((prev) => [created, ...(Array.isArray(prev) ? prev : [])]);
      setOpen(false);
      setForm({
        codigo: "",
        nombre_producto: "",
        familia: "",
        composicion: "",
        alergenos: "",
        estado: "disponible",
      });
      setSnack({ open: true, message: "Producto creado", type: "success" });
    } catch (e) {
      const code = String(e?.code || "").trim();
      const msg = String(e?.message || "").trim();
      const isPerm =
        code === "permission-denied" ||
        code === "PERMISSION_DENIED" ||
        msg.toLowerCase().includes("insufficient permissions");
      setSnack({
        open: true,
        message: isPerm
          ? "No tienes permisos para crear Productos en Firestore (revisa firestore.rules desplegadas)"
          : msg || `Error creando producto${code ? ` (${code})` : ""}`,
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
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <input
          className="input"
          placeholder="Buscar por código, nombre, familia, composición, alérgenos o estado"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <DataTable
        title="Productos"
        columns={columns}
        data={tableRows}
        loading={loading}
        createLabel={isReadOnly ? undefined : "Crear producto"}
        onCreate={isReadOnly ? undefined : onCreate}
        onRowClick={(row) => {
          const id = String(row?.id || "").trim();
          if (!id) return;
          navigate(`/app/productos/${id}`);
        }}
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

      {!isReadOnly && (
        <Modal
          open={open}
          title="Crear producto"
          onClose={() => setOpen(false)}
          onSubmit={submit}
          submitLabel="Crear"
        >
          <div>
            <div className="label">Código</div>
            <input
              className="input"
              value={form.codigo}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, codigo: e.target.value }))
              }
              placeholder="Código"
            />
          </div>
          <div>
            <div className="label">Nombre del producto</div>
            <input
              className="input"
              value={form.nombre_producto}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  nombre_producto: e.target.value,
                }))
              }
              placeholder="Nombre del producto"
            />
          </div>
          <div>
            <div className="label">Familia</div>
            <input
              className="input"
              value={form.familia}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, familia: e.target.value }))
              }
              placeholder="Familia"
            />
          </div>
          <div>
            <div className="label">Composición</div>
            <input
              className="input"
              value={form.composicion}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, composicion: e.target.value }))
              }
              placeholder="Composición"
            />
          </div>
          <div>
            <div className="label">Alérgenos</div>
            <input
              className="input"
              value={form.alergenos}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, alergenos: e.target.value }))
              }
              placeholder="Alérgenos"
            />
          </div>
          <div>
            <div className="label">Estado</div>
            <select
              className="input"
              value={form.estado}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  estado: String(e.target.value || "")
                    .trim()
                    .toLowerCase(),
                }))
              }
            >
              <option value="disponible">Disponible</option>
              <option value="no disponible">No disponible</option>
            </select>
          </div>
        </Modal>
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
