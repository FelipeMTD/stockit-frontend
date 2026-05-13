import { normalizeRole, type AppRole } from './roles';

export type Perm =
  | 'READ_INVENTORY'
  | 'WRITE_INVENTORY'
  | 'READ_ROUTES'
  | 'WRITE_ROUTES'
  | 'READ_HANDOVER'
  | 'WRITE_HANDOVER'
  | 'READ_PEOPLE'
  | 'WRITE_PEOPLE'
  | 'READ_REPORTS'
  | 'EXPORT_INVENTORY'
  | 'EXPORT_MOVEMENTS'
  | 'EXPORT_PEOPLE'
  | 'READ_SETTINGS'
  | 'WRITE_SETTINGS'
  | 'READ_USERS'
  | 'WRITE_USERS';

const PERMISSIONS_BY_ROLE: Record<AppRole, Perm[]> = {
  SUPER_ADMIN: [
    'READ_INVENTORY',
    'WRITE_INVENTORY',
    'READ_ROUTES',
    'WRITE_ROUTES',
    'READ_HANDOVER',
    'WRITE_HANDOVER',
    'READ_PEOPLE',
    'WRITE_PEOPLE',
    'READ_REPORTS',
    'EXPORT_INVENTORY',
    'EXPORT_MOVEMENTS',
    'EXPORT_PEOPLE',
    'READ_SETTINGS',
    'WRITE_SETTINGS',
    'READ_USERS',
    'WRITE_USERS',
  ],

  ACTIVOS_FIJOS: [
    'READ_INVENTORY',
    'WRITE_INVENTORY',
    'READ_ROUTES',
    'WRITE_ROUTES',
    'READ_HANDOVER',
    'WRITE_HANDOVER',
    'READ_PEOPLE',
    'WRITE_PEOPLE',
    'READ_REPORTS',
    'EXPORT_INVENTORY',
    'EXPORT_MOVEMENTS',
    'EXPORT_PEOPLE',
    'READ_SETTINGS',
    'WRITE_SETTINGS',
    'READ_USERS',
    'WRITE_USERS',
  ],

  INVENTARIO: [
    'READ_INVENTORY',
    'WRITE_INVENTORY',
    'READ_ROUTES',
    'WRITE_ROUTES',
    'READ_HANDOVER',
    'WRITE_HANDOVER',
    'READ_PEOPLE',
    'WRITE_PEOPLE',
    'READ_REPORTS',
    'EXPORT_INVENTORY',
    'EXPORT_MOVEMENTS',
    'EXPORT_PEOPLE',
  ],

  ADMINISTRATIVO: [
    'READ_INVENTORY',
    'READ_REPORTS',
    'EXPORT_INVENTORY',
    'EXPORT_MOVEMENTS',
  ],

  CONDUCTOR: [
    'READ_ROUTES',
  ],

  VIEWER: [
    'READ_INVENTORY',
  ],
};

export function can(
  role: string | null | undefined,
  perm: Perm,
): boolean {
  const normalizedRole = normalizeRole(role);

  if (!normalizedRole) {
    return false;
  }

  return PERMISSIONS_BY_ROLE[normalizedRole].includes(perm);
}

export function canAny(
  role: string | null | undefined,
  perms: Perm[],
): boolean {
  return perms.some((perm) => can(role, perm));
}

export function canAll(
  role: string | null | undefined,
  perms: Perm[],
): boolean {
  return perms.every((perm) => can(role, perm));
}

export function permissionsFor(role: string | null | undefined): Perm[] {
  const normalizedRole = normalizeRole(role);

  if (!normalizedRole) {
    return [];
  }

  return PERMISSIONS_BY_ROLE[normalizedRole];
}