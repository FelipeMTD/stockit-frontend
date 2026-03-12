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
    lifeState: string; // "estado operativo" (activo/inactivo/retirado)
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

  const { data, isLoading } = useQuery({
      queryKey: ['assets', { dq, ...filters, pageSize, page }],
      queryFn: async () => {
        const params: Record<string, any> = {
          pageSize,
          page,
        };
        if (dq) params.q = dq;
        if (filters.categoryId) params.categoryId = filters.categoryId;
        if (filters.siteId) params.siteId = filters.siteId;
        if (filters.status) params.status = filters.status;
        if (filters.lifeState) params.lifeState = filters.lifeState;
        if (filters.acquisitionType) params.acquisitionType = filters.acquisitionType;

        const { data } = await api.get<Paginated<Asset>>('/api/assets', { params });
        return data;
      },
      // CAMBIO VITAL PARA V5:
      placeholderData: (previousData) => previousData, 
      staleTime: 30_000,
      gcTime: 5 * 60_000,
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

        {/* Bloque tipo snippet: limpiar + texto + paginación */}
        <div className="flex items-center justify-between text-xs text-slate-500">
          <button
            onClick={clearFilters}
            className="rounded-lg border px-3 py-1.5 text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Limpiar filtros
          </button>

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
          <div className="text-sm text-slate-500">Sin resultados.</div>
        )}

        {items.map((a) => {
          const anyA: any = a;
          const custName = a.currentCustodian?.fullName ?? null;

          // 🔹 Aquí estaba el error: antes usabas `.doc`
          const custDoc =
            (anyA.currentCustodian?.documentId as string | undefined) ?? null;

          const uiLocation = anyA.currentLocation?.name ?? anyA.currentLocationLabel ?? null;
          const siteName = anyA.site?.name ?? null;

          return (
            <div
              key={a.id}
              className="rounded-xl border bg-white dark:bg-slate-900 p-3"
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

                <Link
                  href={`/assets/${a.id}`}
                  className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white inline-flex items-center gap-1 shrink-0"
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
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* =========================
   Modal de creación de activo
   ========================= */
function CreateAssetModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const sites = useSites();

  const [form, setForm] = useState({
    tag: '',
    name: '',
    serial: '',
    siteId: '',
  });

  const create = useMutation({
    mutationFn: async () => {
      const payload = {
        tag: form.tag.trim(),
        name: form.name.trim(),
        serial: form.serial.trim() || null,
        siteId: form.siteId || null,
      };
      if (!payload.tag) throw new Error('El código es obligatorio');
      if (!payload.name) throw new Error('El nombre es obligatorio');

      return (await api.post('/api/assets', payload)).data;
    },
    onSuccess: () => {
      toast.success('Activo creado');
      qc.invalidateQueries({ queryKey: ['assets'] });
      qc.invalidateQueries({
        predicate: (q) => String(q.queryKey[0]).startsWith('asset'),
      });
      onClose();
    },
    onError: (e: any) => {
      toast.error(
        e?.response?.data?.error ??
          e?.message ??
          'No se pudo crear el activo'
      );
    },
  });

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/30 p-4">
      <div className="w-full max-w-lg rounded-2xl border bg-white dark:bg-slate-900 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Nuevo activo</h3>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
          className="space-y-3"
        >
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <label className="text-sm">
                Código (tag) <span className="text-rose-500">*</span>
              </label>
              <input
                value={form.tag}
                onChange={(e) =>
                  setForm((s) => ({ ...s, tag: e.target.value }))
                }
                placeholder="ACT-0001"
                className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
              />
            </div>

            <div className="grid gap-1.5">
              <label className="text-sm">
                Nombre <span className="text-rose-500">*</span>
              </label>
              <input
                value={form.name}
                onChange={(e) =>
                  setForm((s) => ({ ...s, name: e.target.value }))
                }
                placeholder="Portátil Dell"
                className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
              />
            </div>

            <div className="grid gap-1.5">
              <label className="text-sm">Serie</label>
              <input
                value={form.serial}
                onChange={(e) =>
                  setForm((s) => ({ ...s, serial: e.target.value }))
                }
                placeholder="SN-ABC-123"
                className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
              />
            </div>

            {/* Sede */}
            <div className="grid gap-1.5">
              <label className="text-sm">Sede</label>
              <select
                value={form.siteId}
                onChange={(e) =>
                  setForm((s) => ({ ...s, siteId: e.target.value }))
                }
                className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
              >
                <option value="">—</option>
                {sites.data?.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sm px-3 py-2 rounded-lg border hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={create.isPending}
              className="text-sm px-3 py-2 rounded-lg bg-gradient-to-r from-brand to-accent text-white hover:opacity-95 disabled:opacity-60"
            >
              {create.isPending ? 'Creando…' : 'Crear activo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
