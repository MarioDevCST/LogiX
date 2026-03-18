import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DataTable from "../components/DataTable.jsx";
import CardGrid from "../components/CardGrid.jsx";
import Modal from "../components/Modal.jsx";
import Snackbar from "../components/Snackbar.jsx";
import Pagination from "../components/Pagination.jsx";
import { ROLES, ROLE_LABELS, getCurrentUser } from "../utils/roles.js";
import {
  createMessage,
  deleteMessageById,
  fetchAllMessages,
  fetchMessageById,
  updateMessageById,
} from "../firebase/auth.js";

export default function Messages() {
  const navigate = useNavigate();
  const buildCuerpoPreview = (value) => {
    const normalized = String(value || "")
      .replace(/\s+/g, " ")
      .trim();
    if (!normalized) return "-";
    const max = 120;
    return normalized.length > max ? `${normalized.slice(0, max)}…` : normalized;
  };

  const columns = [
    { key: "titulo", header: "Título" },
    { key: "cuerpo_preview", header: "Cuerpo" },
    { key: "roles", header: "Roles" },
    { key: "acciones", header: "Acciones" },
  ];

  const [view, setView] = useState("table");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ titulo: "", cuerpo: "", roles: [] });

  const [openEdit, setOpenEdit] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    titulo: "",
    cuerpo: "",
    roles: [],
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
      const m = await fetchMessageById(id);
      if (!m) return;
      setEditingId(m._id || m.id || id);
      setEditForm({
        titulo: m.titulo || "",
        cuerpo: m.cuerpo || "",
        roles: Array.isArray(m.roles) ? m.roles : [],
      });
      setOpenEdit(true);
    } catch (e) {
      setSnack({
        open: true,
        message: "Error cargando mensaje",
        type: "error",
      });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Seguro que deseas borrar este mensaje?")) return;
    try {
      await deleteMessageById(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      setSnack({ open: true, message: "Mensaje borrado", type: "success" });
    } catch (e) {
      setSnack({
        open: true,
        message: "Error borrando mensaje",
        type: "error",
      });
    }
  };

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        setLoading(true);
        const list = await fetchAllMessages();
        if (!mounted) return;
        const rowFromMessage = (m) => {
          const rowId = m?._id || m?.id;
          const cuerpoPreviewText = buildCuerpoPreview(m?.cuerpo);
          return {
            id: rowId,
            titulo: m?.titulo || "",
            cuerpo_preview: (
              <div
                style={{
                  maxWidth: 420,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={String(m?.cuerpo || "").trim()}
              >
                {cuerpoPreviewText}
              </div>
            ),
            roles:
              Array.isArray(m?.roles) && m.roles.length > 0
                ? m.roles.map((r) => ROLE_LABELS[r] || r).join(", ")
                : "Todos",
            acciones: (
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  className="icon-button"
                  title="Editar"
                  onClick={(e) => {
                    e.stopPropagation();
                    startEdit(rowId);
                  }}
                >
                  <span className="material-symbols-outlined">edit</span>
                </button>
                <button
                  className="icon-button"
                  title="Borrar"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(rowId);
                  }}
                >
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </div>
            ),
          };
        };
        setRows(list.map(rowFromMessage));
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => q === "" || r.titulo.toLowerCase().includes(q));
  }, [rows, query]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filtered.slice(start, end);
  }, [filtered, page, pageSize]);

  const onCreate = () => setOpen(true);

  const submit = async () => {
    try {
      if (!form.titulo || !form.cuerpo) {
        setSnack({
          open: true,
          message: "Título y cuerpo son obligatorios",
          type: "error",
        });
        return;
      }
      const payload = {
        titulo: form.titulo,
        cuerpo: form.cuerpo,
        roles: form.roles,
        creado_por: getCurrentUser()?.name || "Testing",
      };
      const created = await createMessage(payload);
      if (!created) {
        setSnack({
          open: true,
          message: "Error creando mensaje",
          type: "error",
        });
        return;
      }
      const createdId = created._id || created.id;
      const cuerpoPreviewText = buildCuerpoPreview(created?.cuerpo);
      setRows((prev) => [
        {
          id: createdId,
          titulo: created.titulo || "",
          cuerpo_preview: (
            <div
              style={{
                maxWidth: 420,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={String(created?.cuerpo || "").trim()}
            >
              {cuerpoPreviewText}
            </div>
          ),
          roles:
            Array.isArray(created.roles) && created.roles.length > 0
              ? created.roles.map((r) => ROLE_LABELS[r] || r).join(", ")
              : "Todos",
          acciones: (
            <div style={{ display: "flex", gap: 6 }}>
              <button
                className="icon-button"
                title="Editar"
                onClick={(e) => {
                  e.stopPropagation();
                  startEdit(createdId);
                }}
              >
                <span className="material-symbols-outlined">edit</span>
              </button>
              <button
                className="icon-button"
                title="Borrar"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(createdId);
                }}
              >
                <span className="material-symbols-outlined">delete</span>
              </button>
            </div>
          ),
        },
        ...prev,
      ]);
      setOpen(false);
      setForm({ titulo: "", cuerpo: "", roles: [] });
      setSnack({ open: true, message: "Mensaje creado", type: "success" });
    } catch (e) {
      const message =
        e?.message === "titulo y cuerpo son obligatorios"
          ? "Título y cuerpo son obligatorios"
          : "Error creando mensaje";
      setSnack({ open: true, message, type: "error" });
    }
  };

  const submitEdit = async () => {
    try {
      if (!editingId) return;
      if (!editForm.titulo || !editForm.cuerpo) {
        setSnack({
          open: true,
          message: "Título y cuerpo son obligatorios",
          type: "error",
        });
        return;
      }
      const payload = {
        titulo: editForm.titulo,
        cuerpo: editForm.cuerpo,
        roles: editForm.roles,
        modificado_por: getCurrentUser()?.name || "Testing",
      };
      const updated = await updateMessageById(editingId, payload);
      if (!updated) {
        setSnack({
          open: true,
          message: "Mensaje no encontrado",
          type: "error",
        });
        return;
      }
      setRows((prev) =>
        prev.map((r) =>
          r.id === editingId
            ? {
                ...r,
                titulo: updated.titulo,
                cuerpo_preview: (
                  <div
                    style={{
                      maxWidth: 420,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={String(updated?.cuerpo || "").trim()}
                  >
                    {buildCuerpoPreview(updated?.cuerpo)}
                  </div>
                ),
                roles:
                  Array.isArray(updated.roles) && updated.roles.length > 0
                    ? updated.roles.map((r) => ROLE_LABELS[r] || r).join(", ")
                    : "Todos",
              }
            : r
        )
      );
      setOpenEdit(false);
      setEditingId(null);
      setSnack({ open: true, message: "Mensaje actualizado", type: "success" });
    } catch (e) {
      setSnack({
        open: true,
        message: "Error actualizando mensaje",
        type: "error",
      });
    }
  };

  const toggleRole = (role) => {
    const has = form.roles.includes(role);
    setForm({
      ...form,
      roles: has ? form.roles.filter((r) => r !== role) : [...form.roles, role],
    });
  };

  const toggleRoleEdit = (role) => {
    const has = editForm.roles.includes(role);
    setEditForm({
      ...editForm,
      roles: has
        ? editForm.roles.filter((r) => r !== role)
        : [...editForm.roles, role],
    });
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
            placeholder="Buscar por título"
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
          title="Mensajes"
          columns={columns}
          data={paginated}
          loading={loading}
          createLabel={"Crear mensaje"}
          onCreate={onCreate}
          onRowClick={(row) => navigate(`/app/admin/mensajes/${row.id}`)}
        />
      ) : (
        <CardGrid
          title="Mensajes"
          items={paginated.map((i) => ({ ...i, name: i.titulo }))}
          loading={loading}
          createLabel={"Crear mensaje"}
          onCreate={onCreate}
          onCardClick={(item) => navigate(`/app/admin/mensajes/${item.id}`)}
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
        title="Crear mensaje"
        onClose={() => setOpen(false)}
        onSubmit={submit}
        submitLabel="Crear"
      >
        <div>
          <div className="label">Título</div>
          <input
            className="input"
            value={form.titulo}
            onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            placeholder="Título"
          />
        </div>
        <div>
          <div className="label">Cuerpo</div>
          <textarea
            className="input"
            style={{ width: "100%", resize: "vertical", minHeight: 140 }}
            value={form.cuerpo}
            onChange={(e) => setForm({ ...form, cuerpo: e.target.value })}
            placeholder="Contenido del mensaje"
            rows={5}
          />
        </div>
        <div>
          <div className="label">Roles destinatarios</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {Object.values(ROLES).map((role) => (
              <label
                key={role}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <input
                  type="checkbox"
                  checked={form.roles.includes(role)}
                  onChange={() => toggleRole(role)}
                />
                {ROLE_LABELS[role] || role}
              </label>
            ))}
          </div>
          <small>
            Si no seleccionas ningún rol, el mensaje será visible para todos.
          </small>
        </div>
      </Modal>

      <Modal
        open={openEdit}
        title="Editar mensaje"
        onClose={() => setOpenEdit(false)}
        onSubmit={submitEdit}
        submitLabel="Guardar"
      >
        <div>
          <div className="label">Título</div>
          <input
            className="input"
            value={editForm.titulo}
            onChange={(e) =>
              setEditForm({ ...editForm, titulo: e.target.value })
            }
            placeholder="Título"
          />
        </div>
        <div>
          <div className="label">Cuerpo</div>
          <textarea
            className="input"
            style={{ width: "100%", resize: "vertical", minHeight: 140 }}
            value={editForm.cuerpo}
            onChange={(e) =>
              setEditForm({ ...editForm, cuerpo: e.target.value })
            }
            placeholder="Contenido del mensaje"
            rows={5}
          />
        </div>
        <div>
          <div className="label">Roles destinatarios</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {Object.values(ROLES).map((role) => (
              <label
                key={role}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <input
                  type="checkbox"
                  checked={editForm.roles.includes(role)}
                  onChange={() => toggleRoleEdit(role)}
                />
                {ROLE_LABELS[role] || role}
              </label>
            ))}
          </div>
          <small>
            Si no seleccionas ningún rol, el mensaje será visible para todos.
          </small>
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
