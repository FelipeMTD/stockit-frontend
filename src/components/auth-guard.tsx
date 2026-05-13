'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { getAccessToken } from '@/lib/api';
import { normalizeRole, type AppRole } from '@/lib/roles';

type GuardProps = {
  children: ReactNode;
};

type RouteRule = {
  path: string;
  mode: 'exact' | 'prefix';
};

const HOME_BY_ROLE: Record<AppRole, string> = {
  SUPER_ADMIN: '/assets',
  ACTIVOS_FIJOS: '/assets',
  INVENTARIO: '/assets',
  ADMINISTRATIVO: '/assets',
  CONDUCTOR: '/routes',
  VIEWER: '/assets',
};

/**
 * Reglas importantes:
 *
 * - /assets como exact permite SOLO el listado.
 * - /assets/[id] se permite con prefijo usando /assets/ para detalle/anexos.
 * - /assets/new, /assets/import y /assets/:id/edit se bloquean por DENY_RULES
 *   cuando el rol no tiene permiso de escritura.
 *
 * No uses solo startsWith('/assets') para roles de lectura, porque eso abre
 * creación/importación/edición por URL directa.
 */
const ALLOW_RULES_BY_ROLE: Record<AppRole, RouteRule[]> = {
  SUPER_ADMIN: [
    { path: '/assets', mode: 'prefix' },
    { path: '/entregas', mode: 'prefix' },
    { path: '/routes', mode: 'prefix' },
    { path: '/people', mode: 'prefix' },
    { path: '/reportes', mode: 'prefix' },
    { path: '/settings', mode: 'prefix' },
  ],

  ACTIVOS_FIJOS: [
    { path: '/assets', mode: 'prefix' },
    { path: '/entregas', mode: 'prefix' },
    { path: '/routes', mode: 'prefix' },
    { path: '/people', mode: 'prefix' },
    { path: '/reportes', mode: 'prefix' },
    { path: '/settings', mode: 'prefix' },
  ],

  INVENTARIO: [
    { path: '/assets', mode: 'prefix' },
    { path: '/entregas', mode: 'prefix' },
    { path: '/routes', mode: 'prefix' },
    { path: '/people', mode: 'prefix' },
    { path: '/reportes', mode: 'prefix' },
  ],

  ADMINISTRATIVO: [
    { path: '/assets', mode: 'prefix' },
    { path: '/reportes', mode: 'prefix' },
  ],

  CONDUCTOR: [
    { path: '/routes', mode: 'prefix' },
  ],

  VIEWER: [
    { path: '/assets', mode: 'prefix' },
  ],
};

const DENY_RULES_BY_ROLE: Partial<Record<AppRole, RouteRule[]>> = {
  INVENTARIO: [
    { path: '/settings', mode: 'prefix' },
  ],

  ADMINISTRATIVO: [
    { path: '/assets/new', mode: 'exact' },
    { path: '/assets/import', mode: 'exact' },
    { path: '/assets/', mode: 'prefix' },
    { path: '/people', mode: 'prefix' },
    { path: '/entregas', mode: 'prefix' },
    { path: '/routes', mode: 'prefix' },
    { path: '/settings', mode: 'prefix' },
  ],

  CONDUCTOR: [
    { path: '/assets', mode: 'prefix' },
    { path: '/people', mode: 'prefix' },
    { path: '/entregas', mode: 'prefix' },
    { path: '/reportes', mode: 'prefix' },
    { path: '/settings', mode: 'prefix' },
  ],

  VIEWER: [
    { path: '/assets/new', mode: 'exact' },
    { path: '/assets/import', mode: 'exact' },
    { path: '/assets/', mode: 'prefix' },
    { path: '/people', mode: 'prefix' },
    { path: '/entregas', mode: 'prefix' },
    { path: '/routes', mode: 'prefix' },
    { path: '/reportes', mode: 'prefix' },
    { path: '/settings', mode: 'prefix' },
  ],
};

function isPublicPath(pathname: string | null) {
  if (!pathname) return false;

  return pathname === '/login' || pathname.startsWith('/login/');
}

function normalizePath(pathname: string | null) {
  if (!pathname) return '/';

  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

function matchRule(pathname: string, rule: RouteRule) {
  const path = normalizePath(pathname);
  const rulePath = normalizePath(rule.path);

  if (rule.mode === 'exact') {
    return path === rulePath;
  }

  /**
   * Prefijo seguro:
   * - '/people' permite '/people' y '/people/...'
   * - '/assets/' como regla permite cualquier subruta de /assets,
   *   útil para bloquear detalle/edición/import en roles read-only.
   */
  if (rulePath.endsWith('/')) {
    return path.startsWith(rulePath);
  }

  return path === rulePath || path.startsWith(`${rulePath}/`);
}

function isDenied(pathname: string, role: AppRole) {
  const rules = DENY_RULES_BY_ROLE[role] ?? [];
  return rules.some((rule) => matchRule(pathname, rule));
}

function isAllowed(pathname: string, role: AppRole) {
  if (isDenied(pathname, role)) {
    return false;
  }

  const rules = ALLOW_RULES_BY_ROLE[role] ?? [];
  return rules.some((rule) => matchRule(pathname, rule));
}

function getHomeForRole(role: AppRole | null) {
  if (!role) return '/assets';
  return HOME_BY_ROLE[role] ?? '/assets';
}

function getStoredRole(): AppRole | null {
  if (typeof window === 'undefined') return null;

  return normalizeRole(localStorage.getItem('user_role'));
}

export default function Guard({ children }: GuardProps) {
  const router = useRouter();
  const pathnameRaw = usePathname();

  const pathname = useMemo(() => normalizePath(pathnameRaw), [pathnameRaw]);

  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isPublicPath(pathname)) {
      setReady(true);
      return;
    }

    setReady(false);

    const token = getAccessToken();

    if (!token) {
      router.replace('/login');
      return;
    }

    const role = getStoredRole();

    if (!role) {
      router.replace('/assets');
      return;
    }

    if (!isAllowed(pathname, role)) {
      const target = getHomeForRole(role);

      if (pathname !== target) {
        router.replace(target);
        return;
      }
    }

    setReady(true);
  }, [pathname, router]);

  if (!ready) {
    return (
      <div className="min-h-dvh flex items-center justify-center text-sm text-slate-500">
        Cargando…
      </div>
    );
  }

  return <>{children}</>;
}