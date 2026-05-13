'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRoutesList } from '@/lib/hooks';
import Guard from '@/components/auth-guard';
import { capsFor, normalizeRole, type AppRole } from '@/lib/roles';

type RouteItem = {
  id: string;
  code?: string | null;
  type?: string | null;
  status?: string | null;
  contact?: string | null;
  address?: string | null;
  scheduledDate?: string | null;
  driverName?: string | null;
  routeNumber?: number | string | null;
};

function fDateOnly(value?: string | null) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function formatStatus(status?: string | null) {
  const s = String(status || '').toUpperCase().trim();

  if (!s || s === 'UNDEFINED' || s === 'NULL') return 'PROGRAMADA';

  if (s.includes('1/2') || s.includes('PENDING_REVIEW')) {
    return 'COMPLETADA 1/2';
  }

  if (s.includes('2/2') || s.includes('COMPLETED') || s === 'COMPLETADA') {
    return 'COMPLETADA 2/2';
  }

  if (s.includes('IN_PROGRESS') || s.includes('CURSO')) {
    return 'EN CURSO';
  }

  if (s.includes('SCHEDULED') || s.includes('PROGRAMADA')) {
    return 'PROGRAMADA';
  }

  if (s.includes('CANCELLED') || s.includes('CANCELADA')) {
    return 'CANCELADA';
  }

  return status || 'PROGRAMADA';
}

function statusBadgeClass(status?: string | null) {
  const s = String(status || '').toUpperCase();

  if (s.includes('1/2') || s.includes('PENDING_REVIEW')) {
    return 'bg-blue-50 text-blue-900 border-blue-200 px-3 py-1 rounded-full text-[10px] font-bold border shadow-sm';
  }

  if (s.includes('2/2') || s.includes('COMPLET')) {
    return 'bg-emerald-50 text-emerald-900 border-emerald-200 px-3 py-1 rounded-full text-[10px] font-bold border shadow-sm';
  }

  if (s.includes('CURSO') || s.includes('PROGRESS')) {
    return 'bg-sky-50 text-sky-800 border-sky-200 px-3 py-1 rounded-full text-[10px] font-bold border shadow-sm';
  }

  if (s.includes('PROGRAM') || s.includes('SCHEDULED')) {
    return 'bg-amber-50 text-amber-800 border-amber-200 px-3 py-1 rounded-full text-[10px] font-bold border shadow-sm';
  }

  if (s.includes('CANCEL')) {
    return 'bg-rose-50 text-rose-800 border-rose-200 px-3 py-1 rounded-full text-[10px] font-bold border shadow-sm';
  }

  return 'bg-slate-50 text-slate-600 border-slate-200 px-3 py-1 rounded-full text-[10px] font-bold border shadow-sm';
}

function extractRoutes(data: unknown): RouteItem[] {
  if (Array.isArray(data)) {
    return data as RouteItem[];
  }

  if (
    data &&
    typeof data === 'object' &&
    Array.isArray((data as any).items)
  ) {
    return (data as any).items as RouteItem[];
  }

  return [];
}

function getStoredRole(): AppRole | null {
  if (typeof window === 'undefined') return null;

  return normalizeRole(localStorage.getItem('user_role'));
}

export default function RoutesPage() {
  const [mounted, setMounted] = useState(false);
  const [role, setRole] = useState<AppRole | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    setMounted(true);
    setRole(getStoredRole());
  }, []);

  const caps = useMemo(() => capsFor(role), [role]);

  const canViewRoutes = caps.viewRoutes;
  const canEditRoutes = caps.editRoutes;
  const isDriver = role === 'CONDUCTOR';

  const { data, isLoading, isError } = useRoutesList(q);

  const routes = useMemo(() => extractRoutes(data), [data]);

  if (!mounted) {
    return (
      <Guard>
        <div className="p-8 text-center text-slate-500 font-bold tracking-widest animate-pulse">
          CARGANDO RUTAS...
        </div>
      </Guard>
    );
  }

  return (
    <Guard>
      {!canViewRoutes ? (
        <div className="rounded-xl border bg-white p-4 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">
          No tienes permisos para ver rutas.
        </div>
      ) : (
        <section className="space-y-6 p-6 max-w-5xl mx-auto">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">
                Rutas de Servicio
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                {isDriver
                  ? 'Solo se muestran las rutas asignadas a tu usuario.'
                  : 'Consulta y gestión operativa de rutas logísticas.'}
              </p>
            </div>

            {canEditRoutes && (
              <div className="rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-800 border border-sky-100">
                Modo administrador
              </div>
            )}
          </div>

          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Buscar por paciente, código, dirección o conductor..."
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-900 outline-none shadow-sm"
          />

          <div className="grid gap-4">
            {isLoading && (
              <div className="text-sm text-slate-500 font-bold tracking-widest text-center py-10">
                OBTENIENDO DATOS...
              </div>
            )}

            {isError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
                No se pudieron cargar las rutas.
              </div>
            )}

            {!isLoading && !isError && routes.length === 0 && (
              <div className="text-sm text-slate-500 font-bold tracking-widest text-center py-10">
                NO HAY RUTAS DISPONIBLES
              </div>
            )}

            {routes.map((route) => {
              const displayStatus = formatStatus(route.status);
              const code =
                route.code ||
                (route.routeNumber ? `RUTA-${route.routeNumber}` : 'SIN CÓDIGO');

              return (
                <div
                  key={route.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center hover:shadow-md transition-all"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      <span className="font-bold text-slate-900">
                        {code} - {route.type || 'SERVICIO'}
                      </span>

                      <span className={statusBadgeClass(displayStatus)}>
                        {displayStatus}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 font-bold uppercase truncate">
                      {route.contact || 'SIN CONTACTO'} —{' '}
                      {route.address || 'SIN DIRECCIÓN'}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <p className="text-[11px] font-bold text-sky-700 bg-sky-50 inline-block px-2 py-1 rounded">
                        Programada para: {fDateOnly(route.scheduledDate)}
                      </p>

                      {!isDriver && route.driverName && (
                        <p className="text-[11px] font-bold text-slate-600 bg-slate-50 inline-block px-2 py-1 rounded">
                          Conductor: {route.driverName}
                        </p>
                      )}
                    </div>
                  </div>

                  <Link
                    href={`/routes/${route.id}`}
                    className="bg-blue-900 text-white px-6 py-2.5 rounded-lg text-xs font-bold shadow-lg hover:bg-blue-950 transition-colors uppercase tracking-wider shrink-0 sm:ml-4 text-center"
                  >
                    {isDriver ? 'GESTIONAR' : 'VER DETALLE'}
                  </Link>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </Guard>
  );
}