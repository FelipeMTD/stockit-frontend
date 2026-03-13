'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, type Asset, type Paginated } from '@/lib/api';
import StatusBadge from '@/components/ui/status-badge';
import { useSites, useCategories } from '@/lib/hooks';

/* =========================
   Helpers
   ========================= */
function useDebounced<T>(value: T, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

// Ajusta si tu backend maneja otros valores
const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'IN_STOCK', label: 'En bodega' },
  { value: 'ASSIGNED', label: 'Asignado' },
  { value: 'IN_REPAIR', label: 'En reparación' },
  { value: 'LOST', label: 'Perdido' },
  { value: 'DISPOSED', label: 'De baja' },
];

const LIFE_STATE_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'ACTIVE', label: 'Activo' },
  { value: 'INACTIVE', label: 'Inactivo' },
  { value: 'RETIRED', label: 'Retirado' },
];

const ACQ_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'PURCHASE', label: 'Compra' },
  { value: 'LEASE', label: 'Arrendamiento' },
  { value: 'DONATION', label: 'Donación' },
  { value: 'INTERNAL', label: 'Interna' },
  { value: 'OTHER', label: 'Otro' },
];

export default function AssetTable() {
  const qc = useQueryClient();

  // 1. ESTADOS DE LA PAPELERA Y ROLES
  const [isTrashMode, setIsTrashMode] = useState(false);
  const userRole = typeof window !== 'undefined' ? localStorage.getItem('user_role') : null;
  const canManageTrash = userRole === 'ACTIVOS_FIJOS' || userRole === 'SUPER_ADMIN';

  const [q, setQ] = useState('');
  const dq = useDebounced(q.trim(), 350);

  // Tamaño de página y página actual
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState<number>(1);

  // Filtros
  const categories = useCategories();
  const sites = useSites();

  const [filters, setFilters] = useState<{
    categoryId: string;
    siteId: string;
    status: string;
    lifeState: string;
    acquisitionType: string;
  }>({
    categoryId: '',
    siteId: '',
    status: '',
    lifeState: '',
    acquisitionType: '',
  });

  // Resetear a página 1 cuando cambian filtros / búsqueda / pageSize
  useEffect(() => {
    setPage(1);
  }, [
    dq,
    filters.categoryId,
    filters.siteId,
    filters.status,
    filters.lifeState,
    filters.acquisitionType,
    pageSize,
  ]);

  // 2. QUERY ACTUALIZADA (Soporta Trash)
  const { data, isLoading } = useQuery({
      queryKey: ['assets', { dq, ...filters, pageSize, page, isTrashMode }],
      queryFn: async () => {
        const params: Record<string, any> = {
          pageSize,
          page,
        };
        
        // Pide la papelera si el modo está activo
        if (isTrashMode) params.trash = true;

        if (dq) params.q = dq;
        if (filters.categoryId) params.categoryId = filters.categoryId;
        if (filters.siteId) params.siteId = filters.siteId;
        if (filters.status) params.status = filters.status;
        if (filters.lifeState) params.lifeState = filters.lifeState;
        if (filters.acquisitionType) params.acquisitionType = filters.acquisitionType;

        const { data } = await api.get<Paginated<Asset>>('/api/assets', { params });
        return data;
      },
      placeholderData: (previousData) => previousData, 
      staleTime: 30_000,
      gcTime: 5 * 60_000,
    });

  // 3. MUTACIONES DE LA PAPELERA
  const restoreMut = useMutation({
    mutationFn: async (id: string) => api.post(`/api/assets/${id}/restore`),
    onSuccess: () => {
      toast.success('Activo restaurado exitosamente');
      qc.invalidateQueries({ queryKey: ['assets'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error al restaurar'),
  });

  const hardDeleteMut = useMutation({
    mutationFn: async (id: string) => api.delete(`/api/assets/${id}/hard`),
    onSuccess: () => {
      toast.success('Activo eliminado permanentemente');
      qc.invalidateQueries({ queryKey: ['assets'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error al eliminar'),
  });

  const clearFilters = () =>
    setFilters({
      categoryId: '',
      siteId: '',
      status: '',
      lifeState: '',
      acquisitionType: '',
    });

  const items = data?.items ?? [];
  const total = data?.total ?? items.length;

  const currentPage = data?.page ?? page;
  const currentPageSize = data?.pageSize ?? pageSize;
  const totalPages =
    data?.pageCount ??
    (currentPageSize ? Math.max(1, Math.ceil(total / currentPageSize)) : 1);

  const showingCount =
    total === 0 ? 0 : Math.min(total, currentPage * currentPageSize);

  return (
    <div className="space-y-4">
      {/* Barra de búsqueda y filtros */}
      <div className="flex flex-col gap-3">
        {/* Arriba: buscador + selector de cantidad (estilo "Mostrar:") */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {/* Buscador */}
          <div className="relative flex-1">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por código, nombre o serial…"
              className="w-full rounded-full border px-10 py-2 text-sm bg-white dark:bg-slate-950
                         focus:outline-none focus:ring-2 focus:ring-sky-300 dark:focus:ring-sky-700"
              aria-label="Buscar activos"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>

          {/* Selector de tamaño de página, estilo similar al snippet */}
          <div className="flex items-center gap-2 self-end sm:self-auto text-xs text-slate-500">
            <span>Mostrar:</span>
            <select
              className="rounded-xl border px-2 py-1.5 text-xs bg-white dark:bg-slate-950"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value) || 10)}
            >
              <option value={10}>10</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>por página</span>
          </div>
        </div>

        {/* Selectores de filtros */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          {/* Categoría */}
          <select
            className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
            value={filters.categoryId}
            onChange={(e) =>
              setFilters((s) => ({ ...s, categoryId: e.target.value }))
            }
          >
            <option value="">Categoría: Todas</option>
            {categories.data?.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Sede */}
          <select
            className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
            value={filters.siteId}
            onChange={(e) =>
              setFilters((s) => ({ ...s, siteId: e.target.value }))
            }
          >
            <option value="">Sede: Todas</option>
            {sites.data?.map((s: any) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Estado (status) */}
          <select
            className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
            value={filters.status}
            onChange={(e) =>
              setFilters((s) => ({ ...s, status: e.target.value }))
            }
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                Estado: {o.label}
              </option>
            ))}
          </select>

          {/* Estado operativo (lifeState) */}
          <select
            className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
            value={filters.lifeState}
            onChange={(e) =>
              setFilters((s) => ({ ...s, lifeState: e.target.value }))
            }
          >
            {LIFE_STATE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                Operativo: {o.label}
              </option>
            ))}
          </select>

          {/* Tipo de adquisición */}
          <select
            className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
            value={filters.acquisitionType}
            onChange={(e) =>
              setFilters((s) => ({ ...s, acquisitionType: e.target.value }))
            }
          >
            {ACQ_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                Adquisición: {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* 4. BOTONES LIMPIAR FILTROS Y PAPELERA */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-slate-500 gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={clearFilters}
              className="rounded-lg border px-3 py-1.5 text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Limpiar filtros
            </button>
            
            {/* Solo lo ven quienes tengan permiso */}
            {canManageTrash && (
              <button
                onClick={() => {
                  setIsTrashMode(!isTrashMode);
                  setPage(1);
                }}
                className={`rounded-lg border px-3 py-1.5 font-medium transition-colors ${
                  isTrashMode 
                    ? 'bg-rose-100 text-rose-700 border-rose-300 hover:bg-rose-200 dark:bg-rose-900/30 dark:text-rose-400' 
                    : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {isTrashMode ? '← Ocultar Papelera' : '🗑️ Ver Papelera'}
              </button>
            )}
          </div>

          <div className="flex items-center gap-4">
            <span>
              {total === 0
                ? 'Sin activos para mostrar.'
                : `Mostrando ${showingCount} de ${total} activos`}
            </span>

            {total > 0 && totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="px-2 py-1 rounded-lg border disabled:opacity-40"
                  onClick={() =>
                    setPage((p) => Math.max(1, p - 1))
                  }
                  disabled={currentPage <= 1}
                >
                  Anterior
                </button>
                <span>
                  Página {currentPage} de {totalPages}
                </span>
                <button
                  type="button"
                  className="px-2 py-1 rounded-lg border disabled:opacity-40"
                  onClick={() =>
                    setPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage >= totalPages}
                >
                  Siguiente
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {isLoading && (
          <div className="text-sm text-slate-500">Cargando activos…</div>
        )}

        {!isLoading && items.length === 0 && (
          <div className="text-sm text-slate-500">
            {isTrashMode ? 'La papelera está vacía.' : 'Sin resultados.'}
          </div>
        )}

        {items.map((a) => {
          const anyA: any = a;
          const custName = a.currentCustodian?.fullName ?? null;

          const custDoc =
            (anyA.currentCustodian?.documentId as string | undefined) ?? null;

          const uiLocation = anyA.currentLocation?.name ?? anyA.currentLocationLabel ?? null;
          const siteName = anyA.site?.name ?? null;

          return (
            <div
              key={a.id}
              className={`rounded-xl border p-3 ${
                isTrashMode ? 'bg-rose-50 border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/50' : 'bg-white dark:bg-slate-900'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="font-semibold truncate max-w-[220px]"
                      title={a.tag}
                    >
                      {a.tag}
                    </span>
                    <StatusBadge status={a.status} />
                  </div>

                  <div
                    className="text-sm truncate max-w-[420px]"
                    title={a.name}
                  >
                    {a.name}
                  </div>

                  {/* Meta */}
                  <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                    <span className="truncate">
                      Custodio:{' '}
                      <b title={custName ?? ''}>{custName ?? ''}</b>
                    </span>
                    <span className="truncate">
                      Documento:{' '}
                      <b title={custDoc ?? '—'}>{custDoc ?? '—'}</b>
                    </span>
                    {siteName && (
                      <span className="truncate">
                        Sede: <b title={siteName}>{siteName}</b>
                      </span>
                    )}
                    {uiLocation && (
                      <span className="truncate">
                        Ubicación:{' '}
                        <b title={uiLocation}>{uiLocation}</b>
                      </span>
                    )}
                  </div>
                </div>

                {/* 5. BOTONES DE ACCIÓN DINÁMICOS */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                  {isTrashMode ? (
                    <>
                      <button
                        onClick={() => restoreMut.mutate(a.id)}
                        disabled={restoreMut.isPending}
                        className="text-xs px-3 py-1.5 font-medium bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
                      >
                        Restaurar
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('¿Seguro que deseas eliminar este activo PARA SIEMPRE? Esta acción no se puede deshacer.')) {
                            hardDeleteMut.mutate(a.id);
                          }
                        }}
                        disabled={hardDeleteMut.isPending}
                        className="text-xs px-3 py-1.5 font-medium bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors"
                      >
                        Destruir
                      </button>
                    </>
                  ) : (
                    <Link
                      href={`/assets/${a.id}`}
                      className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white inline-flex items-center gap-1"
                    >
                      Ver
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}