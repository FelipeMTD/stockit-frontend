'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarDays,

  Loader2,
  MapPin,
  PackageCheck,
  Phone,
  Search,
  SlidersHorizontal,
  Truck,
  User,
  XCircle,
} from 'lucide-react';

import Guard from '@/components/auth-guard';
import { PageShell } from '@/components/common/page-shell';
import { SectionCard } from '@/components/common/section-card';
import { useRoutesList } from '@/lib/hooks';
import { capsFor, normalizeRole, type AppRole } from '@/lib/roles';

type RouteStopItem = {
  id?: string;
  action?: string | null;
  asset?: {
    id?: string;
    tag?: string | null;
    name?: string | null;
  } | null;
};

type RouteItem = {
  id: string;
  code?: string | null;

  type?: string | null;
  rawType?: string | null;

  status?: string | null;
  rawStatus?: string | null;

  notes?: string | null;

  contact?: string | null;
  contactPhone?: string | null;
  contactDoc?: string | null;
  address?: string | null;

  scheduledDate?: string | null;

  assignedDriverId?: string | null;
  driverName?: string | null;
  driverEmail?: string | null;

  createdById?: string | null;
  createdByName?: string | null;
  createdByEmail?: string | null;

  routeNumber?: number | string | null;

  stop?: {
    id?: string;
    items?: RouteStopItem[];
  } | null;

  assetTags?: string[];
};

const STATUS_FILTERS = [
  { value: 'ALL', label: 'Todos' },
  { value: 'SCHEDULED', label: 'Programadas' },
  { value: 'IN_PROGRESS', label: 'En curso' },
  { value: 'PENDING_REVIEW', label: 'Completadas 1/2' },
  { value: 'COMPLETED', label: 'Completadas 2/2' },
  { value: 'CANCELLED', label: 'Canceladas' },
] as const;

const TYPE_FILTERS = [
  { value: 'ALL', label: 'Todos' },
  { value: 'DELIVERY', label: 'Entrega' },
  { value: 'PICKUP', label: 'Recogida' },
  { value: 'MIXED', label: 'Mixta' },
] as const;

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

function fTime(value?: string | null) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function normalizeStatus(status?: string | null) {
  const raw = String(status || '').trim();
  const s = raw.toUpperCase();

  if (!s || s === 'UNDEFINED' || s === 'NULL') return 'SCHEDULED';

  if (
    s.includes('1/2') ||
    s.includes('PENDING_REVIEW') ||
    s.includes('PENDIENTE')
  ) {
    return 'PENDING_REVIEW';
  }

  if (
    s.includes('2/2') ||
    s.includes('COMPLETED') ||
    s.includes('COMPLETADA')
  ) {
    return 'COMPLETED';
  }

  if (s.includes('IN_PROGRESS') || s.includes('CURSO')) {
    return 'IN_PROGRESS';
  }

  if (s.includes('SCHEDULED') || s.includes('PROGRAMADA')) {
    return 'SCHEDULED';
  }

  if (s.includes('CANCELLED') || s.includes('CANCELADA')) {
    return 'CANCELLED';
  }

  return s;
}

function formatStatus(status?: string | null) {
  const normalized = normalizeStatus(status);

  if (normalized === 'PENDING_REVIEW') return 'Completada 1/2';
  if (normalized === 'COMPLETED') return 'Completada 2/2';
  if (normalized === 'IN_PROGRESS') return 'En curso';
  if (normalized === 'SCHEDULED') return 'Programada';
  if (normalized === 'CANCELLED') return 'Cancelada';

  return status || 'Programada';
}

function statusBadgeClass(status?: string | null) {
  const normalized = normalizeStatus(status);

  if (normalized === 'PENDING_REVIEW') {
    return 'border-blue-200 bg-blue-50 text-blue-900';
  }

  if (normalized === 'COMPLETED') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }

  if (normalized === 'IN_PROGRESS') {
    return 'border-sky-200 bg-sky-50 text-sky-800';
  }

  if (normalized === 'SCHEDULED') {
    return 'border-amber-200 bg-amber-50 text-amber-800';
  }

  if (normalized === 'CANCELLED') {
    return 'border-rose-200 bg-rose-50 text-rose-800';
  }

  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function normalizeType(type?: string | null) {
  const raw = String(type || '').trim();
  const s = raw.toUpperCase();

  if (!s) return 'MIXED';

  if (s.includes('DELIVERY') || s.includes('ENTREGA')) return 'DELIVERY';
  if (s.includes('PICKUP') || s.includes('RECOGIDA')) return 'PICKUP';
  if (s.includes('MIXED') || s.includes('MIXTA')) return 'MIXED';

  return s;
}

function formatType(type?: string | null) {
  const normalized = normalizeType(type);

  if (normalized === 'DELIVERY') return 'Entrega';
  if (normalized === 'PICKUP') return 'Recogida';
  if (normalized === 'MIXED') return 'Mixta';

  return type || 'Servicio';
}

function typeBadgeClass(type?: string | null) {
  const normalized = normalizeType(type);

  if (normalized === 'DELIVERY') {
    return 'border-[#3C9CD1]/30 bg-[#3C9CD1]/10 text-[#1B3859]';
  }

  if (normalized === 'PICKUP') {
    return 'border-[#54BF5B]/30 bg-[#54BF5B]/10 text-[#16803A]';
  }

  return 'border-slate-200 bg-slate-50 text-slate-700';
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

function getRouteCode(route: RouteItem) {
  if (route.code) return route.code;

  if (route.routeNumber) {
    return `RUTA ${String(route.routeNumber).padStart(3, '0')}`;
  }

  return 'RUTA SIN CÓDIGO';
}

function getAssetCount(route: RouteItem) {
  if (Array.isArray(route.stop?.items)) return route.stop.items.length;
  if (Array.isArray(route.assetTags)) return route.assetTags.length;

  return 0;
}

function getStoredRole(): AppRole | null {
  if (typeof window === 'undefined') return null;

  return normalizeRole(localStorage.getItem('user_role'));
}

function getInitialSearchParams() {
  if (typeof window === 'undefined') {
    return {
      q: '',
      status: 'ALL',
      type: 'ALL',
    };
  }

  const params = new URLSearchParams(window.location.search);

  return {
    q: params.get('q') || '',
    status: params.get('status') || 'ALL',
    type: params.get('type') || 'ALL',
  };
}

function buildRoutesQuery({
  q,
  status,
  type,
}: {
  q: string;
  status: string;
  type: string;
}) {
  const params = new URLSearchParams();

  if (q.trim()) params.set('q', q.trim());
  if (status !== 'ALL') params.set('status', status);
  if (type !== 'ALL') params.set('type', type);

  const query = params.toString();

  return query ? `/routes?${query}` : '/routes';
}


export default function RoutesPage() {
  const [mounted, setMounted] = useState(false);
  const [role, setRole] = useState<AppRole | null>(null);

  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const initial = getInitialSearchParams();

    setMounted(true);
    setRole(getStoredRole());
    setQ(initial.q);
    setStatusFilter(initial.status);
    setTypeFilter(initial.type);

    if (initial.status !== 'ALL' || initial.type !== 'ALL') {
      setShowFilters(true);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const nextUrl = buildRoutesQuery({
      q,
      status: statusFilter,
      type: typeFilter,
    });

    window.history.replaceState(null, '', nextUrl);
  }, [mounted, q, statusFilter, typeFilter]);

  const caps = useMemo(() => capsFor(role), [role]);

  const canViewRoutes = caps.viewRoutes;
  const canEditRoutes = caps.editRoutes;
  const isDriver = role === 'CONDUCTOR';

  const { data, isLoading, isFetching, isError } = useRoutesList(q);

  const routes = useMemo(() => extractRoutes(data), [data]);

  const filteredRoutes = useMemo(() => {
    return routes.filter((route) => {
      const statusSource = route.rawStatus || route.status;
      const typeSource = route.rawType || route.type;

      const statusOk =
        statusFilter === 'ALL' || normalizeStatus(statusSource) === statusFilter;

      const typeOk =
        typeFilter === 'ALL' || normalizeType(typeSource) === typeFilter;

      return statusOk && typeOk;
    });
  }, [routes, statusFilter, typeFilter]);



  const hasActiveFilters =
    q.trim() || statusFilter !== 'ALL' || typeFilter !== 'ALL';

  const currentListUrl = useMemo(
    () =>
      buildRoutesQuery({
        q,
        status: statusFilter,
        type: typeFilter,
      }),
    [q, statusFilter, typeFilter],
  );

  const clearFilters = () => {
    setQ('');
    setStatusFilter('ALL');
    setTypeFilter('ALL');
  };

  if (!mounted) {
    return (
      <Guard>
        <PageShell>
          <SectionCard>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando rutas…
            </div>
          </SectionCard>
        </PageShell>
      </Guard>
    );
  }

  return (
    <Guard>
      <PageShell>
        {!canViewRoutes ? (
          <SectionCard>
            <p className="text-sm text-slate-600">
              No tienes permisos para ver rutas.
            </p>
          </SectionCard>
        ) : (
          <SectionCard
            title="Rutas"
            contentClassName="p-0"
            actions={
              canEditRoutes ? (
                <span className="inline-flex h-9 items-center rounded-full border border-[#3C9CD1]/30 bg-[#3C9CD1]/10 px-3 text-xs font-semibold text-[#1B3859]">
                  Modo administrador
                </span>
              ) : null
            }
          >
            <div className="space-y-5 p-4 sm:p-5">
            

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
                <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto_auto] xl:items-center">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                    <input
                      value={q}
                      onChange={(event) => setQ(event.target.value)}
                      placeholder={
                        isDriver
                          ? 'Buscar en tus rutas asignadas…'
                          : 'Buscar por paciente, código, dirección o conductor…'
                      }
                      className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-10 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#3C9CD1] focus:ring-4 focus:ring-[#3C9CD1]/10"
                    />

                    {q && (
                      <button
                        type="button"
                        onClick={() => setQ('')}
                        className="absolute right-3 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                        aria-label="Limpiar búsqueda"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowFilters((value) => !value)}
                    className={[
                      'inline-flex h-11 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition',
                      showFilters || statusFilter !== 'ALL' || typeFilter !== 'ALL'
                        ? 'border-[#3C9CD1]/30 bg-[#3C9CD1]/10 text-[#1B3859]'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                    Filtros
                  </button>

                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                    >
                      Limpiar
                    </button>
                  )}
                </div>

                {showFilters && (
                  <div className="mt-3 grid gap-3 border-t border-slate-200 pt-3 md:grid-cols-2">
                    <select
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value)}
                      className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-[#3C9CD1] focus:ring-4 focus:ring-[#3C9CD1]/10"
                    >
                      {STATUS_FILTERS.map((option) => (
                        <option key={option.value} value={option.value}>
                          Estado: {option.label}
                        </option>
                      ))}
                    </select>

                    <select
                      value={typeFilter}
                      onChange={(event) => setTypeFilter(event.target.value)}
                      className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-[#3C9CD1] focus:ring-4 focus:ring-[#3C9CD1]/10"
                    >
                      {TYPE_FILTERS.map((option) => (
                        <option key={option.value} value={option.value}>
                          Tipo: {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {isLoading && (
                  <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white text-sm text-slate-500">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cargando rutas…
                  </div>
                )}

                {isError && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
                    No se pudieron cargar las rutas.
                  </div>
                )}

                {!isLoading && !isError && filteredRoutes.length === 0 && (
                  <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-4 text-center">
                    <p className="text-sm font-semibold text-slate-700">
                      No hay rutas para mostrar
                    </p>
                    <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">
                      Ajusta la búsqueda o limpia los filtros para ampliar los resultados.
                    </p>
                  </div>
                )}

                {filteredRoutes.map((route) => {
                  const statusSource = route.rawStatus || route.status;
                  const typeSource = route.rawType || route.type;
                  const displayStatus = formatStatus(statusSource);
                  const routeCode = getRouteCode(route);
                  const assetCount = getAssetCount(route);
                  const hour = fTime(route.scheduledDate);

                  return (
                    <article
                      key={route.id}
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[#3C9CD1]/40 hover:shadow-md"
                    >
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="truncate text-base font-bold text-[#111827]">
                              {routeCode}
                            </h2>

                            <span
                              className={[
                                'inline-flex h-7 items-center rounded-full border px-3 text-xs font-semibold',
                                statusBadgeClass(statusSource),
                              ].join(' ')}
                            >
                              {displayStatus}
                            </span>

                            <span
                              className={[
                                'inline-flex h-7 items-center rounded-full border px-3 text-xs font-semibold',
                                typeBadgeClass(typeSource),
                              ].join(' ')}
                            >
                              {formatType(typeSource)}
                            </span>
                          </div>

                          <div className="mt-3 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
                            <div className="min-w-0">
                              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                                <User className="h-3.5 w-3.5" />
                                Contacto
                              </p>
                              <p className="mt-1 truncate font-semibold text-slate-800">
                                {route.contact || 'Sin contacto'}
                              </p>
                              <p className="mt-0.5 truncate text-xs text-slate-500">
                                Documento: {route.contactDoc || '—'}
                              </p>
                            </div>

                            <div className="min-w-0">
                              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                                <MapPin className="h-3.5 w-3.5" />
                                Dirección
                              </p>
                              <p className="mt-1 truncate font-medium text-slate-700">
                                {route.address || 'Sin dirección'}
                              </p>
                            </div>

                            <div className="min-w-0">
                              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                                <CalendarDays className="h-3.5 w-3.5" />
                                Programación
                              </p>
                              <p className="mt-1 font-medium text-slate-700">
                                {fDateOnly(route.scheduledDate)}
                                {hour ? ` · ${hour}` : ''}
                              </p>
                            </div>

                            <div className="min-w-0">
                              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                                <Truck className="h-3.5 w-3.5" />
                                Conductor
                              </p>
                              <p className="mt-1 truncate font-medium text-slate-700">
                                {route.driverName || (isDriver ? 'Asignada a ti' : 'Sin asignar')}
                              </p>
                              {route.driverEmail && (
                                <p className="mt-0.5 truncate text-xs text-slate-500">
                                  {route.driverEmail}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2 xl:grid-cols-3">
                            <span className="inline-flex min-h-8 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 font-semibold">
                              <PackageCheck className="h-3.5 w-3.5" />
                              {assetCount} activo{assetCount === 1 ? '' : 's'}
                            </span>

                            <span className="inline-flex min-h-8 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 font-semibold">
                              <User className="h-3.5 w-3.5" />
                              Creada por: {route.createdByName || '—'}
                            </span>

                            {route.contactPhone && route.contactPhone !== '—' && (
                              <span className="inline-flex min-h-8 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 font-semibold">
                                <Phone className="h-3.5 w-3.5" />
                                {route.contactPhone}
                              </span>
                            )}
                          </div>
                        </div>

                        <Link
                          href={`/routes/${route.id}?from=${encodeURIComponent(
                            currentListUrl,
                          )}`}
                          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#1B3859] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#132B45]"
                        >
                          {isDriver ? 'Gestionar' : 'Ver detalle'}
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </article>
                  );
                })}

                {!isLoading && isFetching && filteredRoutes.length > 0 && (
                  <div className="flex items-center justify-end text-xs text-slate-400">
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Actualizando…
                  </div>
                )}
              </div>
            </div>
          </SectionCard>
        )}
      </PageShell>
    </Guard>
  );
}