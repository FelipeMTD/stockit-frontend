// src/components/layout/app-shell.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import type { PropsWithChildren } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { api, getAccessToken } from '@/lib/api';
import { normalizeRole, type AppRole } from '@/lib/roles';

type User = {
  id: string | number;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  documentId?: string | null;
  isActive?: boolean;
};

type RouteRule = {
  path: string;
  mode: 'exact' | 'prefix';
};

const ALL_LINKS = [
  { href: '/assets', label: 'Inventario', key: 'assets' },
  { href: '/entregas', label: 'Entregas y Recogidas', key: 'handover' },
  { href: '/routes', label: 'Rutas', key: 'routes' },
  { href: '/people', label: 'Población', key: 'people' },
  { href: '/reportes', label: 'Reportes', key: 'reports' },
  { href: '/settings', label: 'Configuraciones', key: 'settings' },
];

const HOME_BY_ROLE: Record<AppRole, string> = {
  SUPER_ADMIN: '/assets',
  ACTIVOS_FIJOS: '/assets',
  INVENTARIO: '/assets',
  ADMINISTRATIVO: '/assets',
  CONDUCTOR: '/routes',
  VIEWER: '/assets',
};

const NAV_LINKS_BY_ROLE: Record<AppRole, string[]> = {
  SUPER_ADMIN: ['/assets', '/entregas', '/routes', '/people', '/reportes', '/settings'],
  ACTIVOS_FIJOS: ['/assets', '/entregas', '/routes', '/people', '/reportes', '/settings'],
  INVENTARIO: ['/assets', '/entregas', '/routes', '/people', '/reportes'],
  ADMINISTRATIVO: ['/assets', '/reportes'],
  CONDUCTOR: ['/routes'],
  VIEWER: ['/assets'],
};

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
    { path: '/people', mode: 'prefix' },
    { path: '/entregas', mode: 'prefix' },
    { path: '/routes', mode: 'prefix' },
    { path: '/reportes', mode: 'prefix' },
    { path: '/settings', mode: 'prefix' },
  ],
};

function normalizePath(pathname: string | null) {
  if (!pathname) return '/';

  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

function isLoginPath(pathname: string | null) {
  const path = normalizePath(pathname);
  return path === '/login' || path.startsWith('/login/');
}

function matchRule(pathname: string, rule: RouteRule) {
  const path = normalizePath(pathname);
  const rulePath = normalizePath(rule.path);

  if (rule.mode === 'exact') {
    return path === rulePath;
  }

  return path === rulePath || path.startsWith(`${rulePath}/`);
}

function isAssetWritePath(pathname: string) {
  const path = normalizePath(pathname);

  if (path === '/assets/new') return true;
  if (path === '/assets/import') return true;

  return /^\/assets\/[^/]+\/edit$/.test(path);
}

function isDenied(pathname: string, role: AppRole) {
  const path = normalizePath(pathname);

  if (
    (role === 'ADMINISTRATIVO' || role === 'VIEWER') &&
    isAssetWritePath(path)
  ) {
    return true;
  }

  const rules = DENY_RULES_BY_ROLE[role] ?? [];
  return rules.some((rule) => matchRule(path, rule));
}

function isAllowed(pathname: string, role: AppRole) {
  const path = normalizePath(pathname);

  if (isDenied(path, role)) {
    return false;
  }

  const rules = ALLOW_RULES_BY_ROLE[role] ?? [];
  return rules.some((rule) => matchRule(path, rule));
}

function getHomeForRole(role: AppRole | null) {
  if (!role) return '/assets';
  return HOME_BY_ROLE[role] ?? '/assets';
}

function getNavLinksForRole(role?: string | null) {
  const normalizedRole = normalizeRole(role);

  if (!normalizedRole) {
    return ALL_LINKS.filter((link) => link.href === '/assets');
  }

  const allowedLinks = NAV_LINKS_BY_ROLE[normalizedRole] ?? ['/assets'];

  return ALL_LINKS.filter((link) => allowedLinks.includes(link.href));
}

function initialsFrom(name?: string | null, email?: string | null) {
  const base = (name && name.trim()) || (email && email.trim()) || '';

  if (!base) return 'U';

  const parts = base.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

function clearLocalSession() {
  if (typeof window === 'undefined') return;

  localStorage.removeItem('access_token');
  localStorage.removeItem('accessToken');
  localStorage.removeItem('token');
  localStorage.removeItem('auth_token');
  localStorage.removeItem('jwt');
  localStorage.removeItem('user_role');
  localStorage.removeItem('user');
  localStorage.removeItem('auth_user');
  localStorage.removeItem('user_name');
  localStorage.removeItem('user_id');
}

function persistLocalSession(user: User, role: AppRole) {
  if (typeof window === 'undefined') return;

  localStorage.setItem('user_role', role);
  localStorage.setItem('user', JSON.stringify({ ...user, role }));

  if (user.name) {
    localStorage.setItem('user_name', user.name);
  }

  if (user.id) {
    localStorage.setItem('user_id', String(user.id));
  }
}

function readStoredUser(): { user: User; role: AppRole } | null {
  if (typeof window === 'undefined') return null;

  const token = getAccessToken();

  if (!token) {
    return null;
  }

  const rawUser =
    localStorage.getItem('user') || localStorage.getItem('auth_user');

  let parsedUser: Partial<User> = {};

  if (rawUser) {
    try {
      parsedUser = JSON.parse(rawUser) as Partial<User>;
    } catch {
      parsedUser = {};
    }
  }

  const role = normalizeRole(
    parsedUser.role || localStorage.getItem('user_role'),
  );

  if (!role) {
    return null;
  }

  const user: User = {
    id: parsedUser.id || localStorage.getItem('user_id') || 'local-user',
    name:
      parsedUser.name ||
      localStorage.getItem('user_name') ||
      parsedUser.email ||
      'Usuario',
    email: parsedUser.email || null,
    documentId: parsedUser.documentId || null,
    isActive: parsedUser.isActive ?? true,
    role,
  };

  return { user, role };
}

function normalizeDisplayRole(role?: string | null) {
  return normalizeRole(role) ?? 'VIEWER';
}

export default function AppShell({ children }: PropsWithChildren) {
  const pathnameRaw = usePathname();
  const pathname = normalizePath(pathnameRaw);
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const isLogin = isLoginPath(pathname);

  useEffect(() => {
    let active = true;

    if (isLogin) {
      setUser(null);
      setAuthorized(true);
      setLoadingUser(false);
      return;
    }

    const stored = readStoredUser();

    if (!stored) {
      clearLocalSession();
      setUser(null);
      setAuthorized(false);
      setLoadingUser(false);
      router.replace('/login');
      return;
    }

    const { user: storedUser, role } = stored;

    persistLocalSession(storedUser, role);

    const allowed = isAllowed(pathname, role);

    setUser(storedUser);
    setAuthorized(allowed);
    setLoadingUser(false);

    if (!allowed) {
      const target = getHomeForRole(role);

      if (pathname !== target) {
        router.replace(target);
      }

      return;
    }

    /**
     * Validación remota en segundo plano.
     * Importante:
     * - NO bloquea el render inicial.
     * - Evita quedarse pegado en "Cargando sesión…".
     */
    api
      .get('/api/auth/me', {
        timeout: 10_000,
      })
      .then((res) => {
        if (!active) return;

        const me = res.data as User;
        const normalizedRole = normalizeRole(me.role);

        if (!normalizedRole) {
          clearLocalSession();
          setUser(null);
          setAuthorized(false);
          router.replace('/login');
          return;
        }

        persistLocalSession(me, normalizedRole);

        const stillAllowed = isAllowed(pathname, normalizedRole);

        setUser({
          ...me,
          role: normalizedRole,
        });

        setAuthorized(stillAllowed);

        if (!stillAllowed) {
          router.replace(getHomeForRole(normalizedRole));
        }
      })
      .catch(() => {
        if (!active) return;

        clearLocalSession();
        setUser(null);
        setAuthorized(false);
        router.replace('/login');
      });

    return () => {
      active = false;
    };
  }, [isLogin, pathname, router]);

  const navLinks = useMemo(() => getNavLinksForRole(user?.role), [user?.role]);

  const onLogout = async () => {
    try {
      setLoggingOut(true);

      try {
        await api.post('/api/auth/logout');
      } catch {
        // Si el logout remoto falla, igual limpiamos sesión local.
      }

      clearLocalSession();

      router.replace('/login');
    } finally {
      setLoggingOut(false);
    }
  };

  if (isLogin) {
    return <>{children}</>;
  }

  if (loadingUser || !authorized) {
    return (
      <div className="min-h-dvh grid place-items-center bg-slate-50 text-slate-600 text-sm">
        Cargando sesión…
      </div>
    );
  }

  const displayName = user?.name?.trim() || user?.email || 'Usuario';
  const displayRole = normalizeDisplayRole(user?.role);
  const initials = initialsFrom(user?.name, user?.email);
  const homeHref = navLinks[0]?.href || getHomeForRole(displayRole);

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-30 border-b bg-white/80 backdrop-blur dark:bg-slate-900/80">
        <div className="mx-auto max-w-6xl px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <Link href={homeHref} className="flex items-center gap-3">
              <Image
                src="/brand/Recurso_2isotipo_color.svg"
                alt="STOCKit"
                width={36}
                height={36}
                className="ring-slate-200 object-contain bg-white dark:hidden"
                priority
              />

              <Image
                src="/brand/Recurso_2isotipo_blanco.svg"
                alt="STOCKit"
                width={36}
                height={36}
                className="hidden ring-1 ring-slate-700 object-contain dark:inline-block dark:bg-slate-900"
                priority
              />

              <div className="font-semibold tracking-tight">Activos Fijos</div>
            </Link>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2">
                <div className="h-9 w-9 rounded-full bg-emerald-600 text-white grid place-items-center text-sm font-semibold">
                  {initials}
                </div>

                <div className="leading-tight text-right">
                  <div
                    className="text-sm font-medium truncate max-w-[160px]"
                    title={displayName}
                  >
                    {displayName}
                  </div>

                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {displayRole}
                  </div>
                </div>
              </div>

              <button
                onClick={onLogout}
                disabled={loggingOut}
                className="rounded-xl border px-3 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
              >
                {loggingOut ? 'Cerrando…' : 'Cerrar sesión'}
              </button>
            </div>
          </div>

          <nav className="mt-3 flex gap-1 flex-wrap">
            {navLinks.map((link) => {
              const active =
                pathname === link.href || pathname.startsWith(`${link.href}/`);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-full px-3 py-1.5 text-sm ${
                    active
                      ? 'bg-sky-900 text-white dark:bg-white dark:text-slate-900'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-3 py-4">{children}</main>
    </div>
  );
}