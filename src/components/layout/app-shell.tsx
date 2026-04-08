// src/components/layout/app-shell.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { PropsWithChildren, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';

const ALL_LINKS = [
  { href: '/assets',   label: 'Inventario',            key: 'assets' },
  { href: '/entregas', label: 'Entregas y Recogidas',  key: 'handover' },
  { href: '/routes',   label: 'Rutas',                 key: 'routes' },
  { href: '/people',   label: 'Población',             key: 'people' },
  { href: '/reportes', label: 'Reportes',              key: 'reports' },
  { href: '/settings', label: 'Configuraciones',       key: 'settings' },
];

type User = {
  id: string | number;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  documentId?: string | null;
};

function initialsFrom(name?: string | null, email?: string | null) {
  const base = (name && name.trim()) || (email && email.trim()) || '';
  if (!base) return 'U';
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

// 🔹 Links visibles según el rol
function getNavLinksForRole(role?: string | null) {
  const r = (role || '').toUpperCase();

  if (r === 'CONDUCTOR') {
    return ALL_LINKS.filter((l) => l.href === '/routes');
  }

  // ✅ INVENTARIO: Ve Reportes, pero NO Configuraciones
  if (r === 'INVENTARIO') {
    return ALL_LINKS.filter((l) =>
      ['/assets', '/entregas', '/routes', '/people', '/reportes'].includes(l.href),
    );
  }

  // ✅ ADMINISTRATIVO: Ve Reportes, pero NO Configuraciones
  if (r === 'ADMINISTRATIVO') {
    return ALL_LINKS.filter((l) =>
      ['/assets', '/reportes'].includes(l.href),
    );
  }

  if (r === 'VIEWER') {
     return ALL_LINKS.filter((l) =>
      ['/assets'].includes(l.href),
    );
  }

  // SUPER_ADMIN y ACTIVOS_FIJOS: Ven TODO el menú
  return ALL_LINKS;
}

// ✅ AQUÍ ESTABA EL ERROR: Faltaba el "export default" antes de function AppShell
export default function AppShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const isLogin = pathname === '/login';

  useEffect(() => {
    if (isLogin) {
      setLoadingUser(false);
      return;
    }

    if (typeof window === 'undefined') return;

    const token = localStorage.getItem('access_token');
    if (!token) {
      router.replace('/login');
      return;
    }

    const fetchMe = async () => {
      try {
        const res = await api.get('/api/auth/me');
        const me = res.data as User;
        setUser(me);

        const roleUpper = (me.role || '').toUpperCase();

        if (typeof window !== 'undefined') {
          localStorage.setItem('user_role', roleUpper);
        }

        // 🔹 Redirecciones según rol
        if (roleUpper === 'CONDUCTOR') {
          const allowed = ['/routes'];
          const isAllowed = allowed.some((base) => pathname === base || pathname.startsWith(base + '/'));
          if (!isAllowed) router.replace('/routes');
        } else if (roleUpper === 'INVENTARIO') {
          const allowed = ['/assets', '/entregas', '/routes', '/people', '/reportes'];
          const isAllowed = allowed.some((base) => pathname === base || pathname.startsWith(base + '/'));
          if (!isAllowed) router.replace('/assets');
        } else if (roleUpper === 'ADMINISTRATIVO') {
          const allowed = ['/assets', '/reportes'];
          const isAllowed = allowed.some((base) => pathname === base || pathname.startsWith(base + '/'));
          if (!isAllowed) router.replace('/assets');
        } else if (roleUpper === 'VIEWER') {
          const allowed = ['/assets'];
          const isAllowed = allowed.some((base) => pathname === base || pathname.startsWith(base + '/'));
          if (!isAllowed) router.replace('/assets');
        }
      } catch (err) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_role');
        router.replace('/login');
      } finally {
        setLoadingUser(false);
      }
    };

    fetchMe();
  }, [isLogin, router, pathname]);

  const navLinks = useMemo(() => getNavLinksForRole(user?.role), [user?.role]);

  const onLogout = async () => {
    try {
      setLoggingOut(true);
      try { await api.post('/api/auth/logout'); } catch {}
      if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_role');
      }
      router.replace('/login');
    } finally {
      setLoggingOut(false);
    }
  };

  if (isLogin) return <>{children}</>;

  if (loadingUser) {
    return <div className="min-h-dvh grid place-items-center bg-slate-50 text-slate-600 text-sm">Cargando sesión…</div>;
  }

  const displayName = user?.name?.trim() || user?.email || 'Usuario administrativo';
  const displayRole = user?.role || 'Administrativo';
  const initials = initialsFrom(user?.name, user?.email);
  const homeHref = navLinks[0]?.href || '/assets';

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-30 border-b bg-white/80 backdrop-blur dark:bg-slate-900/80">
        <div className="mx-auto max-w-6xl px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <Link href={homeHref} className="flex items-center gap-3">
              <Image src="/brand/Recurso_2isotipo_color.svg" alt="STOCKit" width={36} height={36} className="ring-slate-200 object-contain bg-white dark:hidden" priority />
              <Image src="/brand/Recurso_2isotipo_blanco.svg" alt="STOCKit" width={36} height={36} className="hidden ring-1 ring-slate-700 object-contain dark:inline-block dark:bg-slate-900" priority />
              <div className="font-semibold tracking-tight">Activos Fijos</div>
            </Link>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2">
                <div className="h-9 w-9 rounded-full bg-emerald-600 text-white grid place-items-center text-sm font-semibold">{initials}</div>
                <div className="leading-tight text-right">
                  <div className="text-sm font-medium truncate max-w-[160px]" title={displayName}>{displayName}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{displayRole}</div>
                </div>
              </div>
              <button onClick={onLogout} disabled={loggingOut} className="rounded-xl border px-3 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60">
                {loggingOut ? 'Cerrando…' : 'Cerrar sesión'}
              </button>
            </div>
          </div>

          <nav className="mt-3 flex gap-1 flex-wrap">
            {navLinks.map((l) => {
              const active = pathname === l.href || pathname.startsWith(l.href + '/');
              return (
                <Link key={l.href} href={l.href} className={`rounded-full px-3 py-1.5 text-sm ${active ? 'bg-sky-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
                  {l.label}
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