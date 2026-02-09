// Definición de roles, permisos y utilidades de UI

export const ROLES = {
  ADMIN: 'admin',
  OFICINA: 'dispatcher',
  CONDUCTOR: 'driver',
  ALMACEN: 'warehouse',
  CONSIGNATARIO: 'consignee',
  LOGISTICA: 'logistic',
}

export const ROLE_LABELS = {
  [ROLES.ADMIN]: 'Administrador',
  [ROLES.OFICINA]: 'Oficina',
  [ROLES.CONDUCTOR]: 'Conductor',
  [ROLES.ALMACEN]: 'Almacén',
  [ROLES.CONSIGNATARIO]: 'Consignatario',
  [ROLES.LOGISTICA]: 'Logistica',
}

// Colores para UI (avatar, badges, etc.)
export const ROLE_COLORS = {
  [ROLES.ADMIN]: '#e53935', // rojo
  [ROLES.OFICINA]: '#1e88e5', // azul
  [ROLES.CONDUCTOR]: '#8e24aa', // morado
  [ROLES.ALMACEN]: '#fb8c00', // naranja
  [ROLES.CONSIGNATARIO]: '#6d4c41', // marrón
  [ROLES.LOGISTICA]: '#43a047', // verde
}

// Permisos de alto nivel (se pueden granular más según necesidad)
export const PERMISSIONS = {
  VIEW_DASHBOARD: 'view_dashboard',
  MANAGE_USERS: 'manage_users',
  MANAGE_COMPANIES: 'manage_companies',
  MANAGE_SHIPS: 'manage_ships',
  MANAGE_LOCATIONS: 'manage_locations',
  VIEW_LOGISTICS: 'view_logistics',
  MANAGE_LOADS: 'manage_loads',
  MANAGE_PALLETS: 'manage_pallets',
}

// Matriz de permisos por rol (ajustable según negocio)
export const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: Object.values(PERMISSIONS),
  [ROLES.OFICINA]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.MANAGE_COMPANIES,
    PERMISSIONS.MANAGE_SHIPS,
    PERMISSIONS.MANAGE_LOCATIONS,
  ],
  [ROLES.LOGISTICA]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_LOGISTICS,
    PERMISSIONS.MANAGE_LOADS,
    PERMISSIONS.MANAGE_PALLETS,
    PERMISSIONS.MANAGE_USERS,
  ],
  [ROLES.CONDUCTOR]: [
    PERMISSIONS.VIEW_LOGISTICS,
  ],
  [ROLES.ALMACEN]: [
    PERMISSIONS.MANAGE_PALLETS,
  ],
  [ROLES.CONSIGNATARIO]: [
    PERMISSIONS.VIEW_LOGISTICS,
  ],
}

export function getRoleColor(role) {
  return ROLE_COLORS[role] || '#9e9e9e'
}

export function getRoleLabel(role) {
  return ROLE_LABELS[role] || role
}

export function hasPermission(role, permission) {
  const perms = ROLE_PERMISSIONS[role] || []
  return perms.includes(permission)
}

export function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('auth') || '{}').user || null
  } catch {
    return null
  }
}

export function getCurrentRole() {
  const user = getCurrentUser()
  return user?.role || null
}