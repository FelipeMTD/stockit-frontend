export type AppRole =
  | 'SUPER_ADMIN'
  | 'ACTIVOS_FIJOS'
  | 'INVENTARIO'
  | 'ADMINISTRATIVO'
  | 'CONDUCTOR'
  | 'VIEWER';

export type Caps = {
  viewInventory: boolean;
  editInventory: boolean;

  viewRoutes: boolean;
  editRoutes: boolean;

  viewPeople: boolean;
  editPeople: boolean;

  viewReports: boolean;
  exportInventory: boolean;
  exportMovements: boolean;
  exportPeople: boolean;

  viewSettings: boolean;
  adminAll: boolean;
};

const ALLOWED_ROLES: AppRole[] = [
  'SUPER_ADMIN',
  'ACTIVOS_FIJOS',
  'INVENTARIO',
  'ADMINISTRATIVO',
  'CONDUCTOR',
  'VIEWER',
];

export function normalizeRole(role?: string | null): AppRole | null {
  const normalized = String(role || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');

  return ALLOWED_ROLES.includes(normalized as AppRole)
    ? (normalized as AppRole)
    : null;
}

export function isRole(role: string | null | undefined, expected: AppRole): boolean {
  return normalizeRole(role) === expected;
}

export function hasRole(
  role: string | null | undefined,
  allowedRoles: AppRole[],
): boolean {
  const normalized = normalizeRole(role);
  return !!normalized && allowedRoles.includes(normalized);
}

export function capsFor(role?: string | null): Caps {
  const r = normalizeRole(role);

  switch (r) {
    case 'SUPER_ADMIN':
    case 'ACTIVOS_FIJOS':
      return {
        viewInventory: true,
        editInventory: true,

        viewRoutes: true,
        editRoutes: true,

        viewPeople: true,
        editPeople: true,

        viewReports: true,
        exportInventory: true,
        exportMovements: true,
        exportPeople: true,

        viewSettings: true,
        adminAll: true,
      };

    case 'INVENTARIO':
      return {
        viewInventory: true,
        editInventory: true,

        viewRoutes: true,
        editRoutes: true,

        viewPeople: true,
        editPeople: true,

        viewReports: true,
        exportInventory: true,
        exportMovements: true,
        exportPeople: true,

        viewSettings: false,
        adminAll: false,
      };

    case 'ADMINISTRATIVO':
      return {
        viewInventory: true,
        editInventory: false,

        viewRoutes: false,
        editRoutes: false,

        viewPeople: false,
        editPeople: false,

        viewReports: true,
        exportInventory: true,
        exportMovements: true,
        exportPeople: false,

        viewSettings: false,
        adminAll: false,
      };

    case 'CONDUCTOR':
      return {
        viewInventory: false,
        editInventory: false,

        viewRoutes: true,
        editRoutes: false,

        viewPeople: false,
        editPeople: false,

        viewReports: false,
        exportInventory: false,
        exportMovements: false,
        exportPeople: false,

        viewSettings: false,
        adminAll: false,
      };

    case 'VIEWER':
    default:
      return {
        viewInventory: true,
        editInventory: false,

        viewRoutes: false,
        editRoutes: false,

        viewPeople: false,
        editPeople: false,

        viewReports: false,
        exportInventory: false,
        exportMovements: false,
        exportPeople: false,

        viewSettings: false,
        adminAll: false,
      };
  }
}