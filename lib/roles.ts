/** Human-readable labels for every role value stored in DB */
export const ROLE_LABELS: Record<string, string> = {
  superadmin:   'Super Admin',
  tenant_admin: 'Admin',
  user:         'User',
  // legacy ghost role — should not exist after SQL migration
  admin:        'Admin (legacy)',
}

export function roleLabel(role: string | null | undefined): string {
  if (!role) return 'User'
  return ROLE_LABELS[role] ?? role
}
