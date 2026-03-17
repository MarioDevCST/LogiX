import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import DataTable from "../components/DataTable.jsx";
import CardGrid from "../components/CardGrid.jsx";
import Modal from "../components/Modal.jsx";
import Snackbar from "../components/Snackbar.jsx";
import Pagination from "../components/Pagination.jsx";
import { getCurrentUser } from "../utils/roles.js";
import {
  createCompany,
  createShip,
  fetchAllCompanies,
  fetchAllShips,
  fetchAllUsers,
} from "../firebase/auth.js";

export default function Ships() {
  const columns = [
    { key: "nombre", header: "Nombre del barco" },
    { key: "empresa", header: "Empresa" },
    { key: "responsable", header: "Responsable" },
    { key: "tipo", header: "Tipo" },
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
  });
  const [companies, setCompanies] = useState([]);
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [snack, setSnack] = useState({
    open: false,
    message: "",
    type: "success",
  });

  // modales de creación rápida
  const [openCreateCompany, setOpenCreateCompany] = useState(false);
  const [companyForm, setCompanyForm] = useState({ nombre: "" });

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        setLoading(true);
        const [shipsList, companiesList, usersList] = await Promise.all([
          fetchAllShips(),
          fetchAllCompanies(),
          fetchAllUsers(),
        ]);
        if (!mounted) return;
        const companyNameById = new Map(
          companiesList.map((c) => [String(c.id || c._id), c.nombre || ""])
        );
        const userById = new Map(
          usersList.map((u) => [String(u.id || u._id), u])
        );

        const mapped = shipsList.map((s) => {
          const companyName =
            s.empresa_nombre ||
            companyNameById.get(String(s.empresa || "")) ||
            "";
          const u = userById.get(String(s.responsable || ""));
          const responsableName = s.responsable_nombre || u?.name || "";
          return {
            id: s.id || s._id,
            nombre: s.nombre_del_barco,
            empresa: companyName,
            responsable: responsableName,
            tipo: s.tipo || "",
          };
        });
        setRows(mapped);
        setCompanies(
          companiesList.map((c) => ({
            ...c,
            _id: c._id || c.id,
            id: c.id || c._id,
          }))
        );
        setUsers(
          usersList.map((u) => ({
            ...u,
            _id: u._id || u.id,
            id: u.id || u._id,
          }))
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
        (c) => String(c._id || c.id) === String(form.empresa)
      );
      const user = users.find(
        (u) => String(u._id || u.id) === String(form.responsable)
      );
      const payload = {
        ...form,
        empresa: form.empresa || "",
        empresa_nombre: company?.nombre || "",
        responsable: form.responsable || "",
        responsable_nombre: user?.name || "",
        responsable_email: user?.email || "",
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
          responsable: created.responsable_nombre || user?.name || "",
          tipo: created.tipo || "",
        },
      ]);
      setOpen(false);
      setForm({
        nombre_del_barco: "",
        empresa: "",
        responsable: "",
        tipo: "Mercante",
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
        r.responsable.toLowerCase().includes(q) ||
        r.tipo.toLowerCase().includes(q)
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
          data={paginated}
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
            subtitle: `${i.empresa} · ${i.responsable} · ${i.tipo}`,
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
        <div>
          <div className="label">Nombre del barco</div>
          <input
            className="input"
            value={form.nombre_del_barco}
            onChange={(e) =>
              setForm({ ...form, nombre_del_barco: e.target.value })
            }
            placeholder="Nombre del barco"
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
            {users.map((u) => (
              <option key={u._id || u.id} value={u._id || u.id}>
                {u.name} ({u.email})
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="label">Tipo</div>
          <select
            className="select"
            value={form.tipo}
            onChange={(e) => setForm({ ...form, tipo: e.target.value })}
          >
            <option value="Mercante">Mercante</option>
            <option value="Ferry">Ferry</option>
            <option value="Crucero">Crucero</option>
          </select>
        </div>
      </Modal>

      {/* Modal crear empresa */}
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
            setCompanyForm({ nombre: "" });
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
        <div>
          <div className="label">Nombre</div>
          <input
            className="input"
            value={companyForm.nombre}
            onChange={(e) =>
              setCompanyForm({ ...companyForm, nombre: e.target.value })
            }
            placeholder="Nombre de la empresa"
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
