import { getCurrentRole, hasPermission } from '../utils/roles.js'

export default function Can({ permission, children }) {
  const role = getCurrentRole()
  if (!role) return null
  return hasPermission(role, permission) ? children : null
}