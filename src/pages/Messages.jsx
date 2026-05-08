import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DataTable from "../components/DataTable.jsx";
import CardGrid from "../components/CardGrid.jsx";
import Modal from "../components/Modal.jsx";
import Snackbar from "../components/Snackbar.jsx";
import Pagination from "../components/Pagination.jsx";
import FormField from "../components/FormField.jsx";
import {
  ROLES,
  ROLE_LABELS,
  getCurrentRole,
  getCurrentUser,
} from "../utils/roles.js";
import {
  buildMessageAudienceKeysForUser,
  createMessage,
  deleteMessageById,
  ensureRecentMessagesAudienceBackfill,
  fetchAllUsers,
  fetchMessagesPage,
  getMessagesCount,
  subscribeMessagesPage,
  updateMessageById,
} from "../firebase/auth.js";

const PRIORITY_OPTIONS = [
  { value: "info", label: "Info" },
  { value: "warning", label: "Aviso" },
  { value: "urgent", label: "Urgente" },
];

const MESSAGE_ROLE_OPTIONS = [
  ROLES.OFICINA,
  ROLES.LOGISTICA,
  ROLES.CONDUCTOR,
  ROLES.ALMACEN,
  ROLES.MOZO,
];

export default function Messages() {
  const navigate = useNavigate();
  const role = getCurrentRole();
  const currentUser = getCurrentUser();
  const currentUserId = String(
    currentUser?._id || currentUser?.id || "",
  ).trim();
  const canManageMessages = role === ROLES.LOGISTICA;
  const buildCuerpoPreview = useCallback((value) => {
    const normalized = String(value || "")
      .replace(/\s+/g, " ")
      .trim();
    if (!normalized) return "-";
    const max = 140;
    return normalized.length > max
      ? `${normalized.slice(0, max)}…`
      : normalized;
  }, []);

  const toDateTimeLocal = (value) => {
    if (!value) return "";
    try {
      const d =
        typeof value?.toDate === "function"
          ? value.toDate()
          : value instanceof Date
            ? value
            : new Date(String(value));
      if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
      const pad = (n) => String(n).padStart(2, "0");
      const yyyy = d.getFullYear();
      const mm = pad(d.getMonth() + 1);
      const dd = pad(d.getDate());
      const hh = pad(d.getHours());
      const mi = pad(d.getMinutes());
      return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
    } catch {
      return "";
    }
  };

  const fromDateTimeLocal = (value) => {
    const v = String(value || "").trim();
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  };

  const [view, setView] = useState("table");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [includeInactive, setIncludeInactive] = useState(false);

  const emptyForm = useMemo(
    () => ({
      titulo: "",
      cuerpo: "",
      roles: [],
      target_user_id: "",
      priority: "info",
      pinned: false,
      active: true,
      expires_at: "",
    }),
    [],
  );
  const [form, setForm] = useState(emptyForm);
  const [openEdit, setOpenEdit] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);

  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [snack, setSnack] = useState({
    open: false,
    message: "",
    type: "success",
  });

  const audienceKeys = useMemo(
    () =>
      buildMessageAudienceKeysForUser({
        userId: currentUserId,
        role,
      }),
    [currentUserId, role],
  );

  const handleDelete = useCallback(
    async (id) => {
      if (!canManageMessages) {
        setSnack({
          open: true,
          message: "No tienes permisos para borrar mensajes",
          type: "error",
        });
        return;
      }
      if (!window.confirm("¿Seguro que deseas borrar este mensaje?")) return;
      try {
        await deleteMessageById(id);
        setMessages((prev) => prev.filter((m) => (m?._id || m?.id) !== id));
        setSnack({ open: true, message: "Mensaje borrado", type: "success" });
      } catch (e) {
        setSnack({
          open: true,
          message: String(e?.message || "Error borrando mensaje"),
          type: "error",
        });
      }
    },
    [canManageMessages],
  );

  useEffect(() => {
    if (!canManageMessages) return;
    let mounted = true;
    fetchAllUsers()
      .then((list) => {
        if (!mounted) return;
        const normalized = Array.isArray(list) ? list : [];
        normalized.sort((a, b) =>
          String(a?.name || "").localeCompare(String(b?.name || "")),
        );
        setUsers(normalized);
      })
      .catch(() => {
        if (!mounted) return;
        setUsers([]);
      });
    return () => {
      mounted = false;
    };
  }, [canManageMessages]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    if (canManageMessages) {
      ensureRecentMessagesAudienceBackfill({ limitCount: 200 }).catch(
        () => null,
      );
    }
    getMessagesCount({
      audienceKeys,
      includeInactive,
      canManage: canManageMessages,
    })
      .then((n) => {
        if (!mounted) return;
        setTotal(n);
      })
      .catch(() => {
        if (!mounted) return;
        setTotal(0);
        setSnack({
          open: true,
          message: "Error cargando mensajes (count)",
          type: "error",
        });
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [audienceKeys, canManageMessages, includeInactive]);

  // Sin estado de cursores para evitar bucles: resolvemos cursor dentro del efecto de suscripción

  useEffect(() => {
    let active = true;
    let unsubscribe = null;
    const run = async () => {
      try {
        setLoading(true);
        let cursor = null;
        if (page > 1) {
          let prev = null;
          for (let p = 1; p < page; p += 1) {
            const res = await fetchMessagesPage({
              audienceKeys,
              pageSize,
              cursor: prev,
              includeInactive,
              canManage: canManageMessages,
            });
            prev = res.lastDoc;
            if (!prev) break;
          }
          cursor = cursor || prev;
        }
        if (!active) return;
        unsubscribe = subscribeMessagesPage(
          {
            audienceKeys,
            pageSize,
            cursor,
            includeInactive,
            canManage: canManageMessages,
          },
          {
            onChange: ({ items, lastDoc }) => {
              if (!active) return;
              setMessages(items);
              setLoading(false);
            },
            onError: () => {
              if (!active) return;
              setMessages([]);
              setLoading(false);
              setSnack({
                open: true,
                message: "Error cargando mensajes (realtime)",
                type: "error",
              });
            },
          },
        );
      } catch (e) {
        if (!active) return;
        setMessages([]);
        setLoading(false);
        setSnack({
          open: true,
          message: String(e?.message || "Error cargando mensajes"),
          type: "error",
        });
      }
    };
    run();
    return () => {
      active = false;
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [audienceKeys, canManageMessages, includeInactive, page, pageSize]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return messages
      .filter((m) => {
        if (!canManageMessages) return true;
        if (includeInactive) return true;
        return typeof m?.active === "boolean" ? m.active : true;
      })
      .filter(
        (m) =>
          q === "" ||
          String(m?.titulo || "")
            .toLowerCase()
            .includes(q),
      );
  }, [canManageMessages, includeInactive, messages, query]);

  const usersById = useMemo(() => {
    const map = new Map();
    for (const u of users) {
      const id = String(u?._id || u?.id || "").trim();
      if (!id) continue;
      map.set(id, u);
    }
    return map;
  }, [users]);

  const formatAudienceLabel = useCallback(
    (m) => {
      const targetId = String(m?.target_user_id || "").trim();
      if (targetId) {
        const u = usersById.get(targetId);
        const label = String(u?.name || "").trim();
        const extra = String(u?.email || "").trim();
        return `Usuario: ${label || targetId}${extra ? ` (${extra})` : ""}`;
      }
      const roles = Array.isArray(m?.roles) ? m.roles : [];
      if (roles.length === 0) return "Todos";
      return roles.map((r) => ROLE_LABELS[r] || r).join(", ");
    },
    [usersById],
  );

  const rows = useMemo(() => {
    return filtered.map((m) => {
      const id = m?._id || m?.id;
      const priorityLabel =
        PRIORITY_OPTIONS.find((p) => p.value === m?.priority)?.label ||
        String(m?.priority || "Info");
      return {
        id,
        titulo: m?.titulo || "",
        cuerpo_preview: buildCuerpoPreview(m?.cuerpo),
        destinatarios: formatAudienceLabel(m),
        prioridad: priorityLabel,
        fijado: m?.pinned ? "Sí" : "No",
        activo: m?.active === false ? "No" : "Sí",
        ...(canManageMessages
          ? {
              acciones: (
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    className="icon-button"
                    title="Editar"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingId(id);
                      setEditForm({
                        titulo: m?.titulo || "",
                        cuerpo: m?.cuerpo || "",
                        roles: Array.isArray(m?.roles) ? m.roles : [],
                        target_user_id: String(m?.target_user_id || "").trim(),
                        priority: String(m?.priority || "info"),
                        pinned: !!m?.pinned,
                        active:
                          typeof m?.active === "boolean" ? m.active : true,
                        expires_at: toDateTimeLocal(m?.expires_at),
                      });
                      setOpenEdit(true);
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
            }
          : {}),
      };
    });
  }, [
    buildCuerpoPreview,
    canManageMessages,
    filtered,
    formatAudienceLabel,
    handleDelete,
  ]);

  const toggleRoleCreate = useCallback((roleId) => {
    const rid = String(roleId || "").trim();
    if (!rid) return;
    setForm((prev) => {
      const current = Array.isArray(prev?.roles) ? prev.roles : [];
      const has = current.includes(rid);
      return {
        ...prev,
        roles: has ? current.filter((r) => r !== rid) : [...current, rid],
      };
    });
  }, []);

  const toggleRoleEdit = useCallback((roleId) => {
    const rid = String(roleId || "").trim();
    if (!rid) return;
    setEditForm((prev) => {
      const current = Array.isArray(prev?.roles) ? prev.roles : [];
      const has = current.includes(rid);
      return {
        ...prev,
        roles: has ? current.filter((r) => r !== rid) : [...current, rid],
      };
    });
  }, []);

  const columns = useMemo(() => {
    const base = [
      { key: "titulo", header: "Título" },
      { key: "cuerpo_preview", header: "Cuerpo" },
      { key: "destinatarios", header: "Destinatarios" },
      { key: "prioridad", header: "Prioridad" },
      { key: "fijado", header: "Fijado" },
    ];
    const maybeActive = canManageMessages
      ? [...base, { key: "activo", header: "Activo" }]
      : base;
    if (!canManageMessages) return maybeActive;
    return [...maybeActive, { key: "acciones", header: "Acciones" }];
  }, [canManageMessages]);

  const submit = async () => {
    try {
      if (!canManageMessages) {
        setSnack({
          open: true,
          message: "No tienes permisos para crear mensajes",
          type: "error",
        });
        return;
      }
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
        roles: String(form.target_user_id || "").trim() ? [] : form.roles,
        target_user_id: String(form.target_user_id || "").trim(),
        priority: form.priority,
        pinned: !!form.pinned,
        active: typeof form.active === "boolean" ? form.active : true,
        expires_at: fromDateTimeLocal(form.expires_at),
        creado_por: getCurrentUser()?.name || "Testing",
        created_by_uid: currentUserId,
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
      setOpen(false);
      setForm(emptyForm);
      setPage(1);
      setSnack({ open: true, message: "Mensaje creado", type: "success" });
    } catch (e) {
      const message =
        e?.message === "titulo y cuerpo son obligatorios"
          ? "Título y cuerpo son obligatorios"
          : String(e?.message || "Error creando mensaje");
      setSnack({ open: true, message, type: "error" });
    }
  };

  const submitEdit = async () => {
    try {
      if (!canManageMessages) {
        setSnack({
          open: true,
          message: "No tienes permisos para modificar mensajes",
          type: "error",
        });
        return;
      }
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
        roles: String(editForm.target_user_id || "").trim()
          ? []
          : editForm.roles,
        target_user_id: String(editForm.target_user_id || "").trim(),
        priority: editForm.priority,
        pinned: !!editForm.pinned,
        active: typeof editForm.active === "boolean" ? editForm.active : true,
        expires_at: fromDateTimeLocal(editForm.expires_at),
        modificado_por: getCurrentUser()?.name || "Testing",
        updated_by_uid: currentUserId,
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
      setOpenEdit(false);
      setEditingId(null);
      setSnack({ open: true, message: "Mensaje actualizado", type: "success" });
    } catch (e) {
      setSnack({
        open: true,
        message: String(e?.message || "Error actualizando mensaje"),
        type: "error",
      });
    }
  };

  const onCreate = () => {
    if (!canManageMessages) {
      setSnack({
        open: true,
        message: "No tienes permisos para crear mensajes",
        type: "error",
      });
      return;
    }
    setForm(emptyForm);
    setOpen(true);
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
          {canManageMessages && (
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => {
                  setIncludeInactive(!!e.target.checked);
                  setPage(1);
                }}
              />
              Ver archivados
            </label>
          )}
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
          data={rows}
          loading={loading}
          createLabel={canManageMessages ? "Crear mensaje" : undefined}
          onCreate={canManageMessages ? onCreate : undefined}
          onRowClick={(row) => {
            const rid = String(row?.id || "").trim();
            if (!rid) {
              setSnack({
                open: true,
                message: "No se pudo abrir el mensaje",
                type: "error",
              });
              return;
            }
            window.setTimeout(() => {
              navigate(`/app/admin/mensajes/${encodeURIComponent(rid)}`);
            }, 0);
          }}
        />
      ) : (
        <CardGrid
          title="Mensajes"
          items={rows.map((i) => ({ ...i, name: i.titulo }))}
          loading={loading}
          createLabel={canManageMessages ? "Crear mensaje" : undefined}
          onCreate={canManageMessages ? onCreate : undefined}
          onCardClick={(item) => {
            const rid = String(item?.id || "").trim();
            if (!rid) {
              setSnack({
                open: true,
                message: "No se pudo abrir el mensaje",
                type: "error",
              });
              return;
            }
            window.setTimeout(() => {
              navigate(`/app/admin/mensajes/${encodeURIComponent(rid)}`);
            }, 0);
          }}
        />
      )}

      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={(p) => setPage(Math.max(1, p))}
        onPageSizeChange={(s) => {
          setPageSize(s);
          setPage(1);
        }}
      />

      {canManageMessages && (
        <Modal
          open={open}
          title="Crear mensaje"
          onClose={() => setOpen(false)}
          onSubmit={submit}
          submitLabel="Crear"
          width={860}
        >
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
          >
            <div style={{ display: "grid", gap: 12 }}>
              <FormField label="Título">
                <input
                  className="input"
                  value={form.titulo}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, titulo: e.target.value }))
                  }
                  placeholder="Título"
                />
              </FormField>
              <FormField label="Cuerpo">
                <textarea
                  className="input"
                  style={{ width: "100%", resize: "vertical", minHeight: 220 }}
                  value={form.cuerpo}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, cuerpo: e.target.value }))
                  }
                  placeholder="Contenido del mensaje"
                  rows={10}
                />
              </FormField>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <FormField label="Prioridad">
                  <select
                    className="input"
                    value={form.priority}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, priority: e.target.value }))
                    }
                  >
                    {PRIORITY_OPTIONS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Caduca (opcional)">
                  <input
                    className="input"
                    type="datetime-local"
                    value={form.expires_at}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        expires_at: e.target.value,
                      }))
                    }
                  />
                </FormField>
              </div>
              <FormField label="Usuario específico (opcional)">
                <select
                  className="input"
                  value={form.target_user_id}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setForm((prev) => ({
                      ...prev,
                      target_user_id: nextId,
                      roles: nextId ? [] : prev.roles,
                    }));
                  }}
                >
                  <option value="">Ninguno</option>
                  {users.map((u) => {
                    const uid = String(u?._id || u?.id || "").trim();
                    if (!uid) return null;
                    const label = String(u?.name || "").trim() || uid;
                    const extra = String(u?.email || "").trim();
                    return (
                      <option key={uid} value={uid}>
                        {label}
                        {extra ? ` (${extra})` : ""}
                      </option>
                    );
                  })}
                </select>
              </FormField>
              <FormField label="Roles destinatarios">
                <div
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    padding: 10,
                    display: "grid",
                    gap: 8,
                    maxHeight: 200,
                    overflow: "auto",
                    opacity: String(form.target_user_id || "").trim() ? 0.5 : 1,
                    pointerEvents: String(form.target_user_id || "").trim()
                      ? "none"
                      : "auto",
                  }}
                >
                  {MESSAGE_ROLE_OPTIONS.map((r) => (
                    <label
                      key={r}
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <input
                        type="checkbox"
                        checked={
                          Array.isArray(form.roles) && form.roles.includes(r)
                        }
                        onChange={() => toggleRoleCreate(r)}
                      />
                      <span>{ROLE_LABELS[r] || r}</span>
                    </label>
                  ))}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    marginTop: 6,
                  }}
                >
                  Si no seleccionas roles ni usuario, el mensaje será visible
                  para todos.
                </div>
              </FormField>
            </div>
          </div>
        </Modal>
      )}

      {canManageMessages && (
        <Modal
          open={openEdit}
          title="Editar mensaje"
          onClose={() => setOpenEdit(false)}
          onSubmit={submitEdit}
          submitLabel="Guardar"
          width={860}
        >
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
          >
            <div style={{ display: "grid", gap: 12 }}>
              <FormField label="Título">
                <input
                  className="input"
                  value={editForm.titulo}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, titulo: e.target.value }))
                  }
                  placeholder="Título"
                />
              </FormField>
              <FormField label="Cuerpo">
                <textarea
                  className="input"
                  style={{ width: "100%", resize: "vertical", minHeight: 220 }}
                  value={editForm.cuerpo}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, cuerpo: e.target.value }))
                  }
                  placeholder="Contenido del mensaje"
                  rows={10}
                />
              </FormField>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <FormField label="Prioridad">
                  <select
                    className="input"
                    value={editForm.priority}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        priority: e.target.value,
                      }))
                    }
                  >
                    {PRIORITY_OPTIONS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Caduca (opcional)">
                  <input
                    className="input"
                    type="datetime-local"
                    value={editForm.expires_at}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        expires_at: e.target.value,
                      }))
                    }
                  />
                </FormField>
              </div>
              <FormField label="Usuario específico (opcional)">
                <select
                  className="input"
                  value={editForm.target_user_id}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setEditForm((prev) => ({
                      ...prev,
                      target_user_id: nextId,
                      roles: nextId ? [] : prev.roles,
                    }));
                  }}
                >
                  <option value="">Ninguno</option>
                  {users.map((u) => {
                    const uid = String(u?._id || u?.id || "").trim();
                    if (!uid) return null;
                    const label = String(u?.name || "").trim() || uid;
                    const extra = String(u?.email || "").trim();
                    return (
                      <option key={uid} value={uid}>
                        {label}
                        {extra ? ` (${extra})` : ""}
                      </option>
                    );
                  })}
                </select>
              </FormField>
              <FormField label="Roles destinatarios">
                <div
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    padding: 10,
                    display: "grid",
                    gap: 8,
                    maxHeight: 200,
                    overflow: "auto",
                    opacity: String(editForm.target_user_id || "").trim()
                      ? 0.5
                      : 1,
                    pointerEvents: String(editForm.target_user_id || "").trim()
                      ? "none"
                      : "auto",
                  }}
                >
                  {MESSAGE_ROLE_OPTIONS.map((r) => (
                    <label
                      key={r}
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <input
                        type="checkbox"
                        checked={
                          Array.isArray(editForm.roles) &&
                          editForm.roles.includes(r)
                        }
                        onChange={() => toggleRoleEdit(r)}
                      />
                      <span>{ROLE_LABELS[r] || r}</span>
                    </label>
                  ))}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    marginTop: 6,
                  }}
                >
                  Si no seleccionas roles ni usuario, el mensaje será visible
                  para todos.
                </div>
              </FormField>
            </div>
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
