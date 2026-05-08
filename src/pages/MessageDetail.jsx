import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Modal from "../components/Modal.jsx";
import Snackbar from "../components/Snackbar.jsx";
import FormField from "../components/FormField.jsx";
import {
  ROLES,
  ROLE_LABELS,
  getCurrentRole,
  getCurrentUser,
} from "../utils/roles.js";
import {
  deleteMessageById,
  fetchAllUsers,
  markMessageRead,
  subscribeMessageById,
  subscribeMessageReads,
  updateMessageById,
} from "../firebase/auth.js";

export default function MessageDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const role = getCurrentRole();
  const currentUser = getCurrentUser();
  const currentUserId = String(
    currentUser?._id || currentUser?.id || "",
  ).trim();
  const canManageMessages = role === ROLES.LOGISTICA;

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [users, setUsers] = useState([]);
  const [reads, setReads] = useState([]);

  const [openEdit, setOpenEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    titulo: "",
    cuerpo: "",
    roles: [],
    target_user_id: "",
    priority: "info",
    pinned: false,
    active: true,
    expires_at: "",
  });

  const [snack, setSnack] = useState({
    open: false,
    message: "",
    type: "success",
  });

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

  useEffect(() => {
    let active = true;
    setLoading(true);
    const unsubscribe = subscribeMessageById(String(id || "").trim(), {
      onChange: (m) => {
        if (!active) return;
        setMessage(m);
        setLoading(false);
        setEditForm({
          titulo: m?.titulo || "",
          cuerpo: m?.cuerpo || "",
          roles: Array.isArray(m?.roles) ? m.roles : [],
          target_user_id: String(m?.target_user_id || "").trim(),
          priority: String(m?.priority || "info"),
          pinned: !!m?.pinned,
          active: typeof m?.active === "boolean" ? m.active : true,
          expires_at: toDateTimeLocal(m?.expires_at),
        });
      },
      onError: () => {
        if (!active) return;
        setMessage(null);
        setLoading(false);
      },
    });
    return () => {
      active = false;
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [id]);

  useEffect(() => {
    if (!currentUserId) return;
    if (!message) return;
    markMessageRead({ messageId: id, user: currentUser }).catch(() => null);
  }, [currentUser, currentUserId, id, message]);

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
    if (!canManageMessages) return;
    let active = true;
    const unsubscribe = subscribeMessageReads(String(id || "").trim(), {
      onChange: (list) => {
        if (!active) return;
        setReads(Array.isArray(list) ? list : []);
      },
      onError: () => {
        if (!active) return;
        setReads([]);
      },
    });
    return () => {
      active = false;
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [canManageMessages, id]);

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
      const updated = await updateMessageById(id, payload);
      if (!updated) {
        setSnack({
          open: true,
          message: "Mensaje no encontrado",
          type: "error",
        });
        return;
      }
      setMessage(updated);
      setOpenEdit(false);
      setSnack({ open: true, message: "Mensaje actualizado", type: "success" });
    } catch (e) {
      setSnack({
        open: true,
        message: String(e?.message || "Error actualizando mensaje"),
        type: "error",
      });
    }
  };

  const handleDelete = async () => {
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
      setSnack({ open: true, message: "Mensaje borrado", type: "success" });
      navigate("/app/admin/mensajes");
    } catch (e) {
      setSnack({
        open: true,
        message: String(e?.message || "Error borrando mensaje"),
        type: "error",
      });
    }
  };

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

  const usersById = useMemo(() => {
    const map = new Map();
    for (const u of users) {
      const uid = String(u?._id || u?.id || "").trim();
      if (!uid) continue;
      map.set(uid, u);
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

  const readSet = useMemo(() => {
    return new Set(
      reads.map((r) => String(r?.user_id || "").trim()).filter(Boolean),
    );
  }, [reads]);

  const recipients = useMemo(() => {
    if (!canManageMessages) return [];
    if (!message) return [];
    const targetId = String(message?.target_user_id || "").trim();
    const roles = Array.isArray(message?.roles) ? message.roles : [];
    const list = Array.isArray(users) ? users : [];
    const isActive = (u) => (typeof u?.active === "boolean" ? u.active : true);
    if (targetId) {
      return list.filter(
        (u) => String(u?._id || u?.id || "").trim() === targetId,
      );
    }
    if (roles.length > 0) {
      return list.filter(
        (u) => isActive(u) && roles.includes(String(u?.role || "").trim()),
      );
    }
    return list.filter(isActive);
  }, [canManageMessages, message, users]);

  const unreadRecipients = useMemo(() => {
    if (!canManageMessages) return [];
    return recipients.filter((u) => {
      const uid = String(u?._id || u?.id || "").trim();
      if (!uid) return false;
      return !readSet.has(uid);
    });
  }, [canManageMessages, readSet, recipients]);

  const shouldGroupReads = useMemo(() => {
    if (!canManageMessages) return false;
    if (!message) return false;
    const targetId = String(message?.target_user_id || "").trim();
    if (targetId) return false;
    const roles = Array.isArray(message?.roles) ? message.roles : [];
    return roles.length === 0 || roles.length > 1;
  }, [canManageMessages, message]);

  const [openRoleGroups, setOpenRoleGroups] = useState({});

  useEffect(() => {
    if (!shouldGroupReads) return;
    setOpenRoleGroups({});
  }, [message?._id, shouldGroupReads]);

  const roleGroups = useMemo(() => {
    if (!shouldGroupReads) return [];
    const roles = Array.isArray(message?.roles) ? message.roles : [];
    const byRole = new Map();
    for (const u of recipients) {
      const rid = String(u?.role || "").trim() || "(sin-rol)";
      if (!byRole.has(rid)) byRole.set(rid, []);
      byRole.get(rid).push(u);
    }
    const roleIds =
      roles.length > 0 ? roles : Array.from(byRole.keys()).filter(Boolean);
    const groups = [];
    for (const rid of roleIds) {
      const list = byRole.get(String(rid || "").trim() || "(sin-rol)") || [];
      if (list.length === 0) continue;
      const readUsers = [];
      const unreadUsers = [];
      for (const u of list) {
        const uid = String(u?._id || u?.id || "").trim();
        if (!uid) continue;
        if (readSet.has(uid)) readUsers.push(u);
        else unreadUsers.push(u);
      }
      groups.push({
        roleId: rid,
        label:
          ROLE_LABELS[rid] ||
          (rid === "(sin-rol)" ? "(Sin rol)" : String(rid || "")),
        total: list.length,
        readUsers,
        unreadUsers,
      });
    }
    groups.sort((a, b) => String(a.label).localeCompare(String(b.label)));
    return groups;
  }, [message, readSet, recipients, shouldGroupReads]);

  if (loading) return <div className="card">Cargando...</div>;
  if (!message) return <div className="card">No encontrado</div>;

  return (
    <>
      <section className="card">
        <div className="card-header">
          <h2 className="card-title">Detalle mensaje</h2>
          <div style={{ display: "flex", gap: 8 }}>
            {canManageMessages && (
              <>
                <button
                  className="icon-button"
                  onClick={() => setOpenEdit(true)}
                  title="Modificar"
                >
                  <span className="material-symbols-outlined">edit</span>
                </button>
                <button
                  className="icon-button"
                  onClick={handleDelete}
                  title="Borrar"
                >
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </>
            )}
            <button
              className="icon-button"
              onClick={() => navigate(-1)}
              title="Atrás"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
          </div>
        </div>
        <div style={{ padding: 16 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "160px 1fr",
              gap: 8,
            }}
          >
            <div className="label">Título</div>
            <div>{message.titulo || "-"}</div>
            <div className="label">Cuerpo</div>
            <div style={{ whiteSpace: "pre-wrap" }}>
              {message.cuerpo || "-"}
            </div>
            <div className="label">Destinatarios</div>
            <div>{formatAudienceLabel(message)}</div>
            <div className="label">Prioridad</div>
            <div>
              {PRIORITY_OPTIONS.find((p) => p.value === message.priority)
                ?.label || "Info"}
            </div>
            <div className="label">Fijado</div>
            <div>{message.pinned ? "Sí" : "No"}</div>
            <div className="label">Activo</div>
            <div>{message.active === false ? "No" : "Sí"}</div>
            <div className="label">Caduca</div>
            <div>
              {message.expires_at
                ? toDateTimeLocal(message.expires_at).replace("T", " ")
                : "-"}
            </div>
          </div>

          {canManageMessages && (
            <div style={{ marginTop: 18 }}>
              <div className="label" style={{ marginBottom: 8 }}>
                Lecturas
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ color: "var(--text-secondary)" }}>
                    Destinatarios: {recipients.length}
                  </div>
                  <div style={{ color: "var(--text-secondary)" }}>
                    Leído: {readSet.size}
                  </div>
                  <div style={{ color: "var(--text-secondary)" }}>
                    Sin leer: {unreadRecipients.length}
                  </div>
                </div>

                {shouldGroupReads ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    {roleGroups.map((g) => {
                      const isOpen = !!openRoleGroups[g.roleId];
                      return (
                        <div
                          key={g.roleId}
                          style={{
                            border: "1px solid var(--border)",
                            borderRadius: 10,
                            padding: 10,
                          }}
                        >
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() =>
                              setOpenRoleGroups((prev) => ({
                                ...prev,
                                [g.roleId]: !prev[g.roleId],
                              }))
                            }
                            style={{
                              width: "100%",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: 10,
                              padding: 8,
                            }}
                            title={g.label}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                              }}
                            >
                              <span className="material-symbols-outlined">
                                {isOpen ? "expand_more" : "chevron_right"}
                              </span>
                              <div style={{ fontWeight: 600 }}>{g.label}</div>
                            </div>
                            <div
                              style={{
                                color: "var(--text-secondary)",
                                fontSize: 13,
                              }}
                            >
                              {g.readUsers.length}/{g.total} leído ·{" "}
                              {g.unreadUsers.length} sin leer
                            </div>
                          </button>

                          {isOpen && (
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                gap: 12,
                                marginTop: 10,
                              }}
                            >
                              <div style={{ display: "grid", gap: 6 }}>
                                <div style={{ fontWeight: 600 }}>Leído</div>
                                {g.readUsers.length === 0 ? (
                                  <div
                                    style={{ color: "var(--text-secondary)" }}
                                  >
                                    Nadie todavía
                                  </div>
                                ) : (
                                  <div style={{ display: "grid", gap: 4 }}>
                                    {g.readUsers
                                      .slice()
                                      .sort((a, b) =>
                                        String(a?.name || "").localeCompare(
                                          String(b?.name || ""),
                                        ),
                                      )
                                      .slice(0, 60)
                                      .map((u) => {
                                        const uid = String(
                                          u?._id || u?.id || "",
                                        ).trim();
                                        const label =
                                          String(u?.name || "").trim() || uid;
                                        const extra = String(
                                          u?.email || "",
                                        ).trim();
                                        return (
                                          <div
                                            key={uid}
                                            style={{
                                              color: "var(--text-secondary)",
                                            }}
                                          >
                                            {label}
                                            {extra ? ` (${extra})` : ""}
                                          </div>
                                        );
                                      })}
                                    {g.readUsers.length > 60 && (
                                      <div
                                        style={{
                                          color: "var(--text-secondary)",
                                        }}
                                      >
                                        +{g.readUsers.length - 60} más
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div style={{ display: "grid", gap: 6 }}>
                                <div style={{ fontWeight: 600 }}>Sin leer</div>
                                {g.unreadUsers.length === 0 ? (
                                  <div
                                    style={{ color: "var(--text-secondary)" }}
                                  >
                                    Nadie
                                  </div>
                                ) : (
                                  <div style={{ display: "grid", gap: 4 }}>
                                    {g.unreadUsers
                                      .slice()
                                      .sort((a, b) =>
                                        String(a?.name || "").localeCompare(
                                          String(b?.name || ""),
                                        ),
                                      )
                                      .slice(0, 60)
                                      .map((u) => {
                                        const uid = String(
                                          u?._id || u?.id || "",
                                        ).trim();
                                        const label =
                                          String(u?.name || "").trim() || uid;
                                        const extra = String(
                                          u?.email || "",
                                        ).trim();
                                        return (
                                          <div
                                            key={uid}
                                            style={{
                                              color: "var(--text-secondary)",
                                            }}
                                          >
                                            {label}
                                            {extra ? ` (${extra})` : ""}
                                          </div>
                                        );
                                      })}
                                    {g.unreadUsers.length > 60 && (
                                      <div
                                        style={{
                                          color: "var(--text-secondary)",
                                        }}
                                      >
                                        +{g.unreadUsers.length - 60} más
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <>
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ fontWeight: 600 }}>Leído por</div>
                      {reads.length === 0 ? (
                        <div style={{ color: "var(--text-secondary)" }}>
                          Nadie todavía
                        </div>
                      ) : (
                        <div style={{ display: "grid", gap: 4 }}>
                          {reads
                            .slice()
                            .sort((a, b) =>
                              String(a?.name || "").localeCompare(
                                String(b?.name || ""),
                              ),
                            )
                            .map((r) => {
                              const label =
                                String(r?.name || "").trim() || r.user_id;
                              const extra = String(r?.email || "").trim();
                              return (
                                <div
                                  key={r.id}
                                  style={{ color: "var(--text-secondary)" }}
                                >
                                  {label}
                                  {extra ? ` (${extra})` : ""}
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>

                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ fontWeight: 600 }}>Sin leer</div>
                      {unreadRecipients.length === 0 ? (
                        <div style={{ color: "var(--text-secondary)" }}>
                          Nadie
                        </div>
                      ) : (
                        <div style={{ display: "grid", gap: 4 }}>
                          {unreadRecipients.slice(0, 80).map((u) => {
                            const uid = String(u?._id || u?.id || "").trim();
                            const label = String(u?.name || "").trim() || uid;
                            const extra = String(u?.email || "").trim();
                            return (
                              <div
                                key={uid}
                                style={{ color: "var(--text-secondary)" }}
                              >
                                {label}
                                {extra ? ` (${extra})` : ""}
                              </div>
                            );
                          })}
                          {unreadRecipients.length > 80 && (
                            <div style={{ color: "var(--text-secondary)" }}>
                              +{unreadRecipients.length - 80} más
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

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
