import { useEffect, useMemo, useState } from "react";
import DataTable from "../components/DataTable.jsx";
import Snackbar from "../components/Snackbar.jsx";
import Pagination from "../components/Pagination.jsx";
import { fetchInteractions } from "../firebase/auth.js";

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
  return null;
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
  message_created: "Mensaje creado",
  message_updated: "Mensaje modificado",
  message_deleted: "Mensaje borrado",
};

export default function Interactions() {
  const columns = [
    { key: "at", header: "Fecha y hora" },
    { key: "typeLabel", header: "Acción" },
    { key: "actor", header: "Usuario (actor)" },
    { key: "target", header: "Elemento afectado" },
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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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
          return {
            id: i.id,
            at: formatDateTime(i.createdAt),
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
          };
        });
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
      const matchesQuery =
        q === "" ||
        r.rawActor.includes(q) ||
        r.rawTarget.includes(q) ||
        (r.typeLabel || "").toLowerCase().includes(q);
      return matchesType && matchesQuery;
    });
  }, [rows, query, typeFilter]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filtered.slice(start, end);
  }, [filtered, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [query, typeFilter]);

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
            <option value="message_created">Mensaje creado</option>
            <option value="message_updated">Mensaje modificado</option>
            <option value="message_deleted">Mensaje borrado</option>
          </select>
        </div>
      </div>

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

      <Snackbar
        open={snack.open}
        message={snack.message}
        type={snack.type}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
      />
    </>
  );
}
