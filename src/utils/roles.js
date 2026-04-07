// Definición de roles, permisos y utilidades de UI

export const ROLES = {
  ADMIN: "admin",
  OFICINA: "dispatcher",
  MANAGER: "manager",
  CONDUCTOR: "driver",
  ALMACEN: "warehouse",
  MOZO: "mozo",
  CONSIGNATARIO: "consignee",
  LOGISTICA: "logistic",
};

export const ROLE_LABELS = {
  [ROLES.ADMIN]: "Administrador",
  [ROLES.OFICINA]: "Oficina",
  [ROLES.MANAGER]: "Manager",
  [ROLES.CONDUCTOR]: "Conductor",
  [ROLES.ALMACEN]: "Almacén",
  [ROLES.MOZO]: "Mozo",
  [ROLES.CONSIGNATARIO]: "Consignatario",
  [ROLES.LOGISTICA]: "Logistica",
};

// Colores para UI (avatar, badges, etc.)
export const ROLE_COLORS = {
  [ROLES.ADMIN]: "#e53935", // rojo
  [ROLES.OFICINA]: "#1e88e5", // azul
  [ROLES.MANAGER]: "#3949ab", // índigo
  [ROLES.CONDUCTOR]: "#8e24aa", // morado
  [ROLES.ALMACEN]: "#fb8c00", // naranja
  [ROLES.MOZO]: "#64748b", // gris
  [ROLES.CONSIGNATARIO]: "#6d4c41", // marrón
  [ROLES.LOGISTICA]: "#43a047", // verde
};

// Permisos de alto nivel (se pueden granular más según necesidad)
export const PERMISSIONS = {
  VIEW_DASHBOARD: "view_dashboard",
  MANAGE_USERS: "manage_users",
  MANAGE_COMPANIES: "manage_companies",
  MANAGE_SHIPS: "manage_ships",
  MANAGE_LOCATIONS: "manage_locations",
  VIEW_LOGISTICS: "view_logistics",
  MANAGE_LOADS: "manage_loads",
  MANAGE_PALLETS: "manage_pallets",
};

// Matriz de permisos por rol (ajustable según negocio)
export const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: Object.values(PERMISSIONS),
  [ROLES.OFICINA]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_LOGISTICS,
    PERMISSIONS.MANAGE_LOADS,
    PERMISSIONS.MANAGE_PALLETS,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.MANAGE_COMPANIES,
    PERMISSIONS.MANAGE_SHIPS,
    PERMISSIONS.MANAGE_LOCATIONS,
  ],
  [ROLES.MANAGER]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_LOGISTICS,
    PERMISSIONS.MANAGE_LOADS,
  ],
  [ROLES.LOGISTICA]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_LOGISTICS,
    PERMISSIONS.MANAGE_LOADS,
    PERMISSIONS.MANAGE_PALLETS,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.MANAGE_COMPANIES,
    PERMISSIONS.MANAGE_SHIPS,
    PERMISSIONS.MANAGE_LOCATIONS,
  ],
  [ROLES.CONDUCTOR]: [PERMISSIONS.VIEW_LOGISTICS],
  [ROLES.ALMACEN]: [PERMISSIONS.MANAGE_PALLETS],
  [ROLES.MOZO]: [PERMISSIONS.VIEW_LOGISTICS, PERMISSIONS.MANAGE_PALLETS],
  [ROLES.CONSIGNATARIO]: [PERMISSIONS.VIEW_LOGISTICS],
};

export function normalizeRole(role) {
  const raw = String(role || "")
    .trim()
    .toLowerCase();
  if (!raw) return null;
  if (raw === "oficina" || raw === "office") return ROLES.OFICINA;
  if (raw === "almacen" || raw === "almacén") return ROLES.ALMACEN;
  if (raw === "logistica" || raw === "logística" || raw === "logistics")
    return ROLES.LOGISTICA;
  if (raw === "conductor") return ROLES.CONDUCTOR;
  if (raw === "consignatario") return ROLES.CONSIGNATARIO;
  if (raw === "administrador") return ROLES.ADMIN;
  if (raw === "dispatch") return ROLES.OFICINA;
  return raw;
}

export function getRoleColor(role) {
  return ROLE_COLORS[normalizeRole(role)] || "#9e9e9e";
}

export function getRoleLabel(role) {
  const normalized = normalizeRole(role);
  return ROLE_LABELS[normalized] || normalized;
}

export function hasPermission(role, permission) {
  const perms = ROLE_PERMISSIONS[normalizeRole(role)] || [];
  return perms.includes(permission);
}

export function readAuthState() {
  try {
    const raw = localStorage.getItem("auth");
    if (!raw) return { user: null, session: null };
    const parsed = JSON.parse(raw);
    const user =
      parsed?.user && typeof parsed.user === "object"
        ? parsed.user
        : parsed?.currentUser && typeof parsed.currentUser === "object"
        ? parsed.currentUser
        : typeof parsed === "object" &&
          (parsed.email || parsed.role || parsed.id || parsed._id)
        ? parsed
        : null;
    const session =
      parsed?.session && typeof parsed.session === "object"
        ? parsed.session
        : null;
    return { user, session };
  } catch {
    return { user: null, session: null };
  }
}

export function writeAuthState({ user, session }) {
  const nextUser = user && typeof user === "object" ? user : null;
  const nextSession = session && typeof session === "object" ? session : null;
  if (!nextUser) {
    localStorage.removeItem("auth");
    return;
  }
  localStorage.setItem(
    "auth",
    JSON.stringify({
      user: nextUser,
      ...(nextSession ? { session: nextSession } : {}),
    })
  );
}

export function clearAuthState() {
  localStorage.removeItem("auth");
}

export function getCurrentUser() {
  try {
    const { user } = readAuthState();
    return user;
  } catch {
    return null;
  }
}

export function getCurrentRole() {
  const user = getCurrentUser();
  return normalizeRole(user?.role) || null;
}
