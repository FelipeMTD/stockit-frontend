'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { api, type Asset, type Paginated } from '@/lib/api';
import StatusBadge from '@/components/ui/status-badge';
import { useCategories, useSites } from '@/lib/hooks';

type Filters = {
  categoryId: string;
  siteId: string;
  status: string;
  lifeState: string;
  acquisitionType: string;
};

const EMPTY_FILTERS: Filters = {
  categoryId: '',
  siteId: '',
  status: '',
  lifeState: '',
  acquisitionType: '',
};

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

function useDebounced<T>(value: T, delay = 350) {
  const [v, setV] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);

    return () => clearTimeout(id);
  }, [value, delay]);

  return v;
}

function asArray(value: any) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;

  return [];
}

function getValidPageSize(value: string | null) {
  const parsed = Number(value || 10);

  return [10, 50, 100].includes(parsed) ? parsed : 10;
}

function getValidPage(value: string | null) {
  const parsed = Number(value || 1);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function getAssetExtra(asset: Asset) {
  const anyAsset = asset as any;

  return {
    custodianName: asset.currentCustodian?.fullName ?? '',
    custodianDoc: anyAsset.currentCustodian?.documentId ?? '',
    locationName:
      anyAsset.currentLocation?.name ?? anyAsset.currentLocationLabel ?? '',
    siteName: anyAsset.site?.name ?? '',
  };
}

function countActiveFilters(filters: Filters, q: string, isTrashMode: boolean) {
  let count = 0;

  if (q.trim()) count += 1;
  if (filters.categoryId) count += 1;
  if (filters.siteId) count += 1;
  if (filters.status) count += 1;
  if (filters.lifeState) count += 1;
  if (filters.acquisitionType) count += 1;
  if (isTrashMode) count += 1;

  return count;
}

function optionLabel(
  options: Array<{ value: string; label: string }>,
  value: string,
) {
  return options.find((option) => option.value === value)?.label ?? value;
}

function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
      title="Quitar filtro"
    >
      <span>{label}</span>
      <X className="h-3.5 w-3.5 text-slate-400" />
    </button>
  );
}

export default function AssetTable() {
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const listTopRef = useRef<HTMLDivElement | null>(null);

  const categories = useCategories();
  const sites = useSites();

  const [userRole, setUserRole] = useState<string | null>(null);

  const [isTrashMode, setIsTrashMode] = useState(
    () => searchParams.get('trash') === '1',
  );

  const [showFilters, setShowFilters] = useState(false);

  const [q, setQ] = useState(() => searchParams.get('q') ?? '');
  const dq = useDebounced(q.trim(), 350);

  const [pageSize, setPageSize] = useState<number>(() =>
    getValidPageSize(searchParams.get('pageSize')),
  );

  const [page, setPage] = useState<number>(() =>
    getValidPage(searchParams.get('page')),
  );

  const [filters, setFilters] = useState<Filters>(() => ({
    categoryId: searchParams.get('categoryId') ?? '',
    siteId: searchParams.get('siteId') ?? '',
    status: searchParams.get('status') ?? '',
    lifeState: searchParams.get('lifeState') ?? '',
    acquisitionType: searchParams.get('acquisitionType') ?? '',
  }));

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setUserRole(localStorage.getItem('user_role'));
  }, []);

  const canManageTrash =
    userRole === 'ACTIVOS_FIJOS' || userRole === 'SUPER_ADMIN';

  const categoryItems = useMemo(() => asArray(categories.data), [categories.data]);
  const siteItems = useMemo(() => asArray(sites.data), [sites.data]);

  const activeFilterCount = useMemo(
    () => countActiveFilters(filters, q, isTrashMode),
    [filters, q, isTrashMode],
  );

  const categoryLabel = useMemo(() => {
    return (
      categoryItems.find((category: any) => category.id === filters.categoryId)
        ?.name || filters.categoryId
    );
  }, [categoryItems, filters.categoryId]);

  const siteLabel = useMemo(() => {
    return (
      siteItems.find((site: any) => site.id === filters.siteId)?.name ||
      filters.siteId
    );
  }, [siteItems, filters.siteId]);

  const listParams = useMemo(() => {
    const params = new URLSearchParams();

    if (q.trim()) params.set('q', q.trim());
    if (page > 1) params.set('page', String(page));
    if (pageSize !== 10) params.set('pageSize', String(pageSize));
    if (filters.categoryId) params.set('categoryId', filters.categoryId);
    if (filters.siteId) params.set('siteId', filters.siteId);
    if (filters.status) params.set('status', filters.status);
    if (filters.lifeState) params.set('lifeState', filters.lifeState);

    if (filters.acquisitionType) {
      params.set('acquisitionType', filters.acquisitionType);
    }

    if (isTrashMode) params.set('trash', '1');

    return params;
  }, [q, page, pageSize, filters, isTrashMode]);

  const currentListUrl = useMemo(() => {
    const paramsString = listParams.toString();

    return paramsString ? `${pathname}?${paramsString}` : pathname;
  }, [pathname, listParams]);

  useEffect(() => {
    const paramsString = listParams.toString();
    const nextUrl = paramsString ? `${pathname}?${paramsString}` : pathname;

    const currentSearch = searchParams.toString();
    const currentUrl = currentSearch ? `${pathname}?${currentSearch}` : pathname;

    if (nextUrl !== currentUrl) {
      router.replace(nextUrl, {
        scroll: false,
      });
    }
  }, [listParams, pathname, router, searchParams]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['assets', { dq, ...filters, pageSize, page, isTrashMode }],
    queryFn: async () => {
      const params: Record<string, any> = {
        pageSize,
        page,
      };

      if (isTrashMode) params.trash = true;
      if (dq) params.q = dq;
      if (filters.categoryId) params.categoryId = filters.categoryId;
      if (filters.siteId) params.siteId = filters.siteId;
      if (filters.status) params.status = filters.status;
      if (filters.lifeState) params.lifeState = filters.lifeState;
      if (filters.acquisitionType) {
        params.acquisitionType = filters.acquisitionType;
      }

      const res = await api.get<Paginated<Asset>>('/api/assets', {
        params,
      });

      return res.data;
    },
    placeholderData: (previousData) => previousData,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const restoreMut = useMutation({
    mutationFn: async (id: string) => api.post(`/api/assets/${id}/restore`),
    onSuccess: () => {
      toast.success('Activo restaurado exitosamente');
      qc.invalidateQueries({ queryKey: ['assets'] });
    },
    onError: (error: any) =>
      toast.error(error.response?.data?.error || 'Error al restaurar'),
  });

  const hardDeleteMut = useMutation({
    mutationFn: async (id: string) => api.delete(`/api/assets/${id}/hard`),
    onSuccess: () => {
      toast.success('Activo eliminado permanentemente');
      qc.invalidateQueries({ queryKey: ['assets'] });
    },
    onError: (error: any) =>
      toast.error(error.response?.data?.error || 'Error al eliminar'),
  });

  const items = data?.items ?? [];
  const total = data?.total ?? items.length;

  const currentPage = data?.page ?? page;
  const currentPageSize = data?.pageSize ?? pageSize;

  const totalPages =
    (data as any)?.pageCount ??
    (data as any)?.pages ??
    (currentPageSize ? Math.max(1, Math.ceil(total / currentPageSize)) : 1);

  const startItem = total === 0 ? 0 : (currentPage - 1) * currentPageSize + 1;
  const endItem =
    total === 0 ? 0 : Math.min(total, currentPage * currentPageSize);

  const scrollToListTop = () => {
    window.requestAnimationFrame(() => {
      listTopRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

  const goToPage = (nextPage: number) => {
    setPage(nextPage);
    scrollToListTop();
  };

  const clearFilters = () => {
    setQ('');
    setFilters(EMPTY_FILTERS);
    setIsTrashMode(false);
    setPageSize(10);
    setPage(1);
    scrollToListTop();
  };

  const toggleTrashMode = () => {
    setIsTrashMode((value) => !value);
    setPage(1);
    scrollToListTop();
  };

  const updateFilter = (key: keyof Filters, value: string) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));

    setPage(1);
    scrollToListTop();
  };

  const handleSearchChange = (value: string) => {
    setQ(value);
    setPage(1);
  };

  const handleClearSearch = () => {
    setQ('');
    setPage(1);
    scrollToListTop();
  };

  const handlePageSizeChange = (value: string) => {
    setPageSize(Number(value) || 10);
    setPage(1);
    scrollToListTop();
  };

  return (
    <div ref={listTopRef} className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              value={q}
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder="Buscar por código, nombre o serial…"
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-10 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#3C9CD1] focus:ring-4 focus:ring-[#3C9CD1]/10"
              aria-label="Buscar activos"
            />

            {q && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Limpiar búsqueda"
              >
                <XCircle className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between xl:justify-end">
            <button
              type="button"
              onClick={() => setShowFilters((value) => !value)}
              className={[
                'inline-flex h-11 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition',
                showFilters || activeFilterCount > 0
                  ? 'border-[#3C9CD1]/30 bg-[#3C9CD1]/10 text-[#1B3859]'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              ].join(' ')}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filtros
              {activeFilterCount > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#54BF5B] px-1.5 text-[11px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Limpiar
              </button>
            )}

            <div className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-xs text-slate-500 shadow-sm">
              <span>Mostrar</span>

              <select
                className="h-8 rounded-xl border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 outline-none focus:border-[#3C9CD1] focus:ring-2 focus:ring-[#3C9CD1]/10"
                value={pageSize}
                onChange={(event) => handlePageSizeChange(event.target.value)}
              >
                <option value={10}>10</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>

              <span>por página</span>
            </div>
          </div>
        </div>

        {activeFilterCount > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200/80 pt-3">
            {q.trim() && (
              <FilterChip
                label={`Búsqueda: ${q.trim()}`}
                onRemove={handleClearSearch}
              />
            )}

            {filters.categoryId && (
              <FilterChip
                label={`Categoría: ${categoryLabel}`}
                onRemove={() => updateFilter('categoryId', '')}
              />
            )}

            {filters.siteId && (
              <FilterChip
                label={`Sede: ${siteLabel}`}
                onRemove={() => updateFilter('siteId', '')}
              />
            )}

            {filters.status && (
              <FilterChip
                label={`Estado: ${optionLabel(
                  STATUS_OPTIONS,
                  filters.status,
                )}`}
                onRemove={() => updateFilter('status', '')}
              />
            )}

            {filters.lifeState && (
              <FilterChip
                label={`Operativo: ${optionLabel(
                  LIFE_STATE_OPTIONS,
                  filters.lifeState,
                )}`}
                onRemove={() => updateFilter('lifeState', '')}
              />
            )}

            {filters.acquisitionType && (
              <FilterChip
                label={`Adquisición: ${optionLabel(
                  ACQ_OPTIONS,
                  filters.acquisitionType,
                )}`}
                onRemove={() => updateFilter('acquisitionType', '')}
              />
            )}

            {isTrashMode && (
              <FilterChip label="Papelera" onRemove={toggleTrashMode} />
            )}
          </div>
        )}

        {showFilters && (
          <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#1B3859]">
                  Filtros avanzados
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowFilters(false)}
                className="grid h-8 w-8 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                aria-label="Cerrar filtros"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-5">
              <select
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-[#3C9CD1] focus:ring-4 focus:ring-[#3C9CD1]/10"
                value={filters.categoryId}
                onChange={(event) =>
                  updateFilter('categoryId', event.target.value)
                }
              >
                <option value="">Categoría: Todas</option>
                {categoryItems.map((category: any) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>

              <select
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-[#3C9CD1] focus:ring-4 focus:ring-[#3C9CD1]/10"
                value={filters.siteId}
                onChange={(event) => updateFilter('siteId', event.target.value)}
              >
                <option value="">Sede: Todas</option>
                {siteItems.map((site: any) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>

              <select
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-[#3C9CD1] focus:ring-4 focus:ring-[#3C9CD1]/10"
                value={filters.status}
                onChange={(event) => updateFilter('status', event.target.value)}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    Estado: {option.label}
                  </option>
                ))}
              </select>

              <select
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-[#3C9CD1] focus:ring-4 focus:ring-[#3C9CD1]/10"
                value={filters.lifeState}
                onChange={(event) =>
                  updateFilter('lifeState', event.target.value)
                }
              >
                {LIFE_STATE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    Operativo: {option.label}
                  </option>
                ))}
              </select>

              <select
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-[#3C9CD1] focus:ring-4 focus:ring-[#3C9CD1]/10"
                value={filters.acquisitionType}
                onChange={(event) =>
                  updateFilter('acquisitionType', event.target.value)
                }
              >
                {ACQ_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    Adquisición: {option.label}
                  </option>
                ))}
              </select>
            </div>

            {canManageTrash && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                <div>
                  <p className="text-xs font-semibold text-slate-700">
                    Papelera de activos
                  </p>
                  <p className="text-xs text-slate-500">
                    Muestra activos eliminados para restaurarlos o destruirlos.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={toggleTrashMode}
                  className={[
                    'inline-flex h-9 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-semibold transition',
                    isTrashMode
                      ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                  ].join(' ')}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {isTrashMode ? 'Ocultar papelera' : 'Ver papelera'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        {isLoading && (
          <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white text-sm text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Cargando activos…
          </div>
        )}

        {!isLoading && items.length === 0 && (
          <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-4 text-center">
            <p className="text-sm font-semibold text-slate-700">
              {isTrashMode ? 'La papelera está vacía' : 'Sin resultados'}
            </p>
            <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">
              {isTrashMode
                ? 'No hay activos eliminados para mostrar.'
                : 'Ajusta la búsqueda o limpia los filtros para ampliar los resultados.'}
            </p>
          </div>
        )}

        {!isLoading &&
          items.map((asset) => {
            const { custodianName, custodianDoc, locationName, siteName } =
              getAssetExtra(asset);

            return (
              <article
                key={asset.id}
                className={[
                  'group rounded-2xl border p-4 transition-all duration-150 ease-out',
                  'hover:-translate-y-0.5 hover:shadow-sm',
                  isTrashMode
                    ? 'border-red-100 bg-red-50/70'
                    : 'border-slate-200 bg-white hover:border-slate-300',
                ].join(' ')}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="max-w-full truncate text-sm font-bold tracking-wide text-[#111827] sm:max-w-[360px]"
                        title={asset.tag}
                      >
                        {asset.tag}
                      </span>

                      <StatusBadge status={asset.status} />
                    </div>

                    <p
                      className="mt-1 truncate text-sm font-medium text-slate-700"
                      title={asset.name}
                    >
                      {asset.name}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span className="max-w-full truncate">
                        Custodio:{' '}
                        <b className="font-semibold text-slate-700">
                          {custodianName || '—'}
                        </b>
                      </span>

                      <span className="truncate">
                        Documento:{' '}
                        <b className="font-semibold text-slate-700">
                          {custodianDoc || '—'}
                        </b>
                      </span>

                      {siteName && (
                        <span className="truncate">
                          Sede:{' '}
                          <b className="font-semibold text-slate-700">
                            {siteName}
                          </b>
                        </span>
                      )}

                      <span className="truncate">
                        Ubicación:{' '}
                        <b className="font-semibold text-slate-700">
                          {locationName || 'sin ubicación'}
                        </b>
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
                    {isTrashMode ? (
                      <>
                        <button
                          type="button"
                          onClick={() => restoreMut.mutate(asset.id)}
                          disabled={restoreMut.isPending}
                          className="inline-flex h-9 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Restaurar
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const ok = confirm(
                              '¿Seguro que deseas eliminar este activo PARA SIEMPRE? Esta acción no se puede deshacer.',
                            );

                            if (ok) {
                              hardDeleteMut.mutate(asset.id);
                            }
                          }}
                          disabled={hardDeleteMut.isPending}
                          className="inline-flex h-9 items-center rounded-xl bg-red-600 px-3 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Destruir
                        </button>
                      </>
                    ) : (
                      <Link
                        href={`/assets/${asset.id}?from=${encodeURIComponent(
                          currentListUrl,
                        )}`}
                        className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-[#1B3859] transition hover:border-[#3C9CD1]/40 hover:bg-[#3C9CD1]/10"
                      >
                        Ver
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>
                </div>
              </article>
            );
          })}

        {!isLoading && isFetching && items.length > 0 && (
          <div className="flex items-center justify-end text-xs text-slate-400">
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            Actualizando…
          </div>
        )}

        <div className="mt-3 flex flex-col gap-2 border-t border-slate-200/80 pt-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>
            {total === 0
              ? isTrashMode
                ? 'La papelera está vacía.'
                : 'Sin activos para mostrar.'
              : `Mostrando ${startItem}-${endItem} de ${total} activos`}
          </span>

          {total > 0 && totalPages > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => goToPage(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Anterior
              </button>

              <span className="rounded-xl bg-white px-3 py-2 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                Página {currentPage} de {totalPages}
              </span>

              <button
                type="button"
                className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() =>
                  goToPage(Math.min(totalPages, currentPage + 1))
                }
                disabled={currentPage >= totalPages}
              >
                Siguiente
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}