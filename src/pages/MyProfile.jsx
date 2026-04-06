import { useEffect, useMemo, useState } from "react";
import Snackbar from "../components/Snackbar.jsx";
import { fetchUserById, fetchInteractionsByActorId } from "../firebase/auth.js";
import { getCurrentUser, getRoleColor, getRoleLabel } from "../utils/roles.js";

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

const avatarSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">
  <rect width="180" height="180" rx="90" fill="#EEF2FF"/>
  <circle cx="90" cy="72" r="34" fill="#C7D2FE"/>
  <path d="M36 156c8-28 32-48 54-48s46 20 54 48" fill="#C7D2FE"/>
  <circle cx="90" cy="90" r="84" fill="none" stroke="#A5B4FC" stroke-width="6"/>
</svg>`;

export default function MyProfile() {
  const authUser = useMemo(() => getCurrentUser(), []);
  const meId = useMemo(() => {
    return String(authUser?._id || authUser?.id || "").trim();
  }, [authUser]);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [interactionsLoading, setInteractionsLoading] = useState(true);
  const [interactions, setInteractions] = useState([]);
  const [snack, setSnack] = useState({
    open: false,
    message: "",
    type: "success",
  });

  const avatarUrl = useMemo(() => {
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(avatarSvg)}`;
  }, []);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        setLoading(true);
        const u = meId ? await fetchUserById(meId) : null;
        if (!mounted) return;
        setProfile(u || authUser || null);
      } catch {
        if (!mounted) return;
        setProfile(authUser || null);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [meId, authUser]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        setInteractionsLoading(true);
        const list = await fetchInteractionsByActorId({
          actorId: meId,
          limitCount: 25,
        });
        if (!mounted) return;
        setInteractions(Array.isArray(list) ? list : []);
      } catch (e) {
        if (!mounted) return;
        setInteractions([]);
        const code = String(e?.code || "").trim();
        const msg = String(e?.message || "").trim();
        const isIndex =
          code === "failed-precondition" ||
          code === "FAILED_PRECONDITION" ||
          msg.toLowerCase().includes("index");
        setSnack({
          open: true,
          message: isIndex
            ? "No se pudieron cargar tus interacciones (falta un índice en Firestore)"
            : `No se pudieron cargar tus interacciones${
                code ? ` (${code})` : ""
              }`,
          type: "error",
        });
      } finally {
        if (mounted) setInteractionsLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [meId]);

  const name = String(profile?.name || "").trim();
  const email = String(profile?.email || "").trim();
  const role = profile?.role || authUser?.role || "";
  const roleLabel = getRoleLabel(role);
  const roleColor = getRoleColor(role);
  const initial = (name || email || "?").trim().charAt(0).toUpperCase();

  const interactionRows = useMemo(() => {
    return interactions.map((i) => {
      const actorName = String(i?.actor?.name || "").trim();
      const actorEmail = String(i?.actor?.email || "").trim();
      const targetName = String(i?.target?.name || "").trim();
      const targetEmail = String(i?.target?.email || "").trim();
      const actor =
        actorName && actorEmail
          ? `${actorName} (${actorEmail})`
          : actorName || actorEmail || "";
      const target =
        targetName && targetEmail
          ? `${targetName} (${targetEmail})`
          : targetName || targetEmail || "";
      const type = String(i?.type || "").trim();
      const typeLabel = TYPE_LABELS[type] || type;
      return {
        id: i?.id || `${type}-${String(i?.createdAt || "")}`,
        at: formatDateTime(i?.createdAt),
        typeLabel,
        actor,
        target,
      };
    });
  }, [interactions]);

  return (
    <>
      <section className="card">
        <div className="card-header">
          <h2 className="card-title">Mi perfil</h2>
        </div>

        <div style={{ padding: 12, display: "grid", gap: 12 }}>
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              padding: 12,
              border: "1px solid var(--border)",
              borderRadius: 12,
              background: "#fff",
            }}
          >
            <div style={{ position: "relative", width: 84, height: 84 }}>
              <img
                src={avatarUrl}
                alt="Foto de perfil"
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: 999,
                  display: "block",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  right: -4,
                  bottom: -4,
                  width: 34,
                  height: 34,
                  borderRadius: 999,
                  border: "2px solid #fff",
                  background: roleColor,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontWeight: 900,
                }}
                title={roleLabel}
              >
                {initial || "?"}
              </div>
            </div>

            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{ fontWeight: 900, fontSize: 18, lineHeight: "22px" }}
              >
                {loading ? "Cargando..." : name || email || "-"}
              </div>
              <div style={{ color: "var(--text-secondary)", marginTop: 2 }}>
                {email || "-"}
              </div>
              <div
                style={{
                  marginTop: 8,
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 10px",
                    borderRadius: 999,
                    border: "1px solid var(--border)",
                    background: "#f8fafc",
                    fontWeight: 800,
                    fontSize: 12,
                    color: "var(--text-primary)",
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      background: roleColor,
                      display: "inline-block",
                    }}
                  />
                  {roleLabel || "-"}
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 10px",
                    borderRadius: 999,
                    border: "1px solid var(--border)",
                    background: "#fff",
                    fontWeight: 700,
                    fontSize: 12,
                    color: "var(--text-secondary)",
                  }}
                >
                  ID: {meId || "-"}
                </span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Últimas interacciones</h3>
            </div>
            <div style={{ padding: 12, display: "grid", gap: 10 }}>
              {interactionsLoading ? (
                <div style={{ color: "var(--text-secondary)" }}>
                  Cargando...
                </div>
              ) : interactionRows.length === 0 ? (
                <div style={{ color: "var(--text-secondary)" }}>
                  No hay interacciones recientes
                </div>
              ) : (
                interactionRows.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      padding: "10px 12px",
                      background: "#fff",
                      display: "grid",
                      gap: 4,
                    }}
                  >
                    <div style={{ fontWeight: 900 }}>{r.typeLabel || "-"}</div>
                    <div
                      style={{ color: "var(--text-secondary)", fontSize: 13 }}
                    >
                      {r.at || "-"}
                    </div>
                    {(r.target || r.actor) && (
                      <div
                        style={{ color: "var(--text-secondary)", fontSize: 13 }}
                      >
                        {r.target ? `Objetivo: ${r.target}` : ""}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
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
