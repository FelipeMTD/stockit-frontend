// src/components/layout/app-shell.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  PropsWithChildren,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
} from 'react';
import {
  BarChart3,
  Boxes,
  ClipboardCheck,
  LogOut,
  MapPinned,
  Settings,
  Users,
} from 'lucide-react';

import { api, getAccessToken } from '@/lib/api';
import { normalizeRole, type AppRole } from '@/lib/roles';

type NavKey =
  | 'assets'
  | 'handover'
  | 'routes'
  | 'people'
  | 'reports'
  | 'settings';

type NavLink = {
  href: string;
  label: string;
  shortLabel: string;
  key: NavKey;
  icon: ComponentType<{ className?: string }>;
};

type RouteRule = {
  path: string;
  mode: 'exact' | 'prefix';
};

type User = {
  id: string | number;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  documentId?: string | null;
};

const ALL_LINKS: NavLink[] = [
  {
    href: '/assets',
    label: 'Inventario',
    shortLabel: 'Inventario',
    key: 'assets',
    icon: Boxes,
  },
  {
    href: '/entregas',
    label: 'Entregas y recogidas',
    shortLabel: 'Entregas',
    key: 'handover',
    icon: ClipboardCheck,
  },
  {
    href: '/routes',
    label: 'Rutas',
    shortLabel: 'Rutas',
    key: 'routes',
    icon: MapPinned,
  },
  {
    href: '/people',
    label: 'Población',
    shortLabel: 'Población',
    key: 'people',
    icon: Users,
  },
  {
    href: '/reportes',
    label: 'Reportes',
    shortLabel: 'Reportes',
    key: 'reports',
    icon: BarChart3,
  },
  {
    href: '/settings',
    label: 'Configuraciones',
    shortLabel: 'Config.',
    key: 'settings',
    icon: Settings,
  },
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
  SUPER_ADMIN: [
    '/assets',
    '/entregas',
    '/routes',
    '/people',
    '/reportes',
    '/settings',
  ],
  ACTIVOS_FIJOS: [
    '/assets',
    '/entregas',
    '/routes',
    '/people',
    '/reportes',
    '/settings',
  ],
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

  CONDUCTOR: [{ path: '/routes', mode: 'prefix' }],

  VIEWER: [{ path: '/assets', mode: 'prefix' }],
};

const DENY_RULES_BY_ROLE: Partial<Record<AppRole, RouteRule[]>> = {
  INVENTARIO: [{ path: '/settings', mode: 'prefix' }],

  ADMINISTRATIVO: [
    { path: '/assets/new', mode: 'exact' },
    { path: '/assets/import', mode: 'exact' },
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

function getNavLinksForRole(role?: string | null) {
  const normalizedRole = normalizeRole(role);

  if (!normalizedRole) {
    return ALL_LINKS.filter((link) => link.href === '/assets');
  }

  const allowedLinks = NAV_LINKS_BY_ROLE[normalizedRole] ?? ['/assets'];

  return ALL_LINKS.filter((link) => allowedLinks.includes(link.href));
}

function normalizeDisplayRole(role?: string | null) {
  const normalized = normalizeRole(role);
  return normalized ?? 'VIEWER';
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
}

function persistLocalSession(user: User, role: AppRole) {
  if (typeof window === 'undefined') return;

  localStorage.setItem('user_role', role);
  localStorage.setItem(
    'user',
    JSON.stringify({
      ...user,
      role,
    }),
  );
}


function NavTabs({
  navLinks,
  pathname,
}: {
  navLinks: NavLink[];
  pathname: string;
}) {
  return (
    <nav className="border-t border-slate-100 bg-white">
      <div className="stock-scrollbar-none mx-auto flex w-full max-w-[1500px] gap-6 overflow-x-auto px-3 py-2 sm:px-4 lg:px-6">
        {navLinks.map((link) => {
          const active =
            pathname === link.href || pathname.startsWith(`${link.href}/`);
          const Icon = link.icon;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={[
                'group relative inline-flex h-11 shrink-0 items-center gap-2 px-1 text-sm font-semibold',
                'transition-colors duration-150 ease-out',
                'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#3C9CD1]/20',
                active
                  ? 'text-[#111827]'
                  : 'text-slate-500 hover:text-[#111827]',
              ].join(' ')}
            >
              <span
                className={[
                  'grid h-8 w-8 place-items-center rounded-full transition-colors duration-150 ease-out',
                  active
                    ? 'bg-slate-100 text-[#111827]'
                    : 'bg-slate-100 text-slate-400 group-hover:text-[#111827]',
                ].join(' ')}
              >
                <Icon className="h-4 w-4" />
              </span>

              <span className="hidden sm:inline">{link.label}</span>
              <span className="sm:hidden">{link.shortLabel}</span>

              {active && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[#54BF5B]" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
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

    async function validateSession() {
      if (isLogin) {
        if (!active) return;

        setLoadingUser(false);
        setAuthorized(true);
        return;
      }

      if (typeof window === 'undefined') return;

      setLoadingUser(true);
      setAuthorized(false);

      const token = getAccessToken();

      if (!token) {
        clearLocalSession();
        router.replace('/login');
        return;
      }

      try {
        const res = await api.get('/api/auth/me');
        const me = res.data as User;

        const normalizedRole = normalizeRole(me.role);

        if (!normalizedRole) {
          clearLocalSession();
          router.replace('/login');
          return;
        }

        persistLocalSession(me, normalizedRole);

        const currentPathAllowed = isAllowed(pathname, normalizedRole);

        if (!currentPathAllowed) {
          const target = getHomeForRole(normalizedRole);

          if (pathname !== target) {
            router.replace(target);
            return;
          }
        }

        if (!active) return;

        setUser({
          ...me,
          role: normalizedRole,
        });

        setAuthorized(true);
      } catch {
        clearLocalSession();
        router.replace('/login');
      } finally {
        if (active) {
          setLoadingUser(false);
        }
      }
    }

    validateSession();

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
      <div className="grid min-h-dvh place-items-center bg-[var(--stock-bg)] px-4 text-center">
        <div className="rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--stock-blue-dark)]" />
          <p className="text-sm font-medium text-slate-600">
            Cargando sesión…
          </p>
        </div>
      </div>
    );
  }

  const displayName = user?.name?.trim() || user?.email || 'Usuario';
  const displayRole = normalizeDisplayRole(user?.role);
  const initials = initialsFrom(user?.name, user?.email);
  const homeHref = navLinks[0]?.href || '/assets';

  return (
    <div className="min-h-dvh bg-[var(--stock-bg)] text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur">        <div className="mx-auto flex h-16 w-full max-w-[1500px] items-center justify-between gap-3 px-3 sm:px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link href={homeHref} className="flex shrink-0 items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl border border-slate-200 bg-white shadow-sm">
              <Image
                src="/brand/Recurso_2isotipo_color.svg"
                alt="STOCKit"
                width={30}
                height={30}
                className="object-contain"
                priority
              />
            </div>

            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-sm font-semibold leading-tight text-[var(--stock-blue-dark)]">
                Activos Fijos
              </p>
              <p className="text-xs font-medium text-slate-500">
                Gestión STOCKit
              </p>
            </div>
          </Link>

          
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 sm:flex">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--stock-green)] text-xs font-semibold text-white">
              {initials}
            </div>

            <div className="leading-tight">
              <p
                className="max-w-44 truncate text-xs font-semibold text-[var(--stock-blue-dark)]"
                title={displayName}
              >
                {displayName}
              </p>
              <p className="text-[11px] font-medium text-slate-500">
                {displayRole}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            disabled={loggingOut}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-[var(--stock-blue-dark)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">
              {loggingOut ? 'Cerrando…' : 'Salir'}
            </span>
          </button>
        </div>
      </div>

        <NavTabs navLinks={navLinks} pathname={pathname} />
      </header>

      <main className="min-h-[calc(100dvh-7rem)] pb-8">{children}</main>
    </div>
  );
}