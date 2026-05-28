'use client';

import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  
  CalendarDays,
  ClipboardList,
  Database,
  Download,
  FileSpreadsheet,
  Filter,
  Loader2,
  PackageCheck,
  RotateCcw,
  Search,
  Shield,
  UserRound,
  Users,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import Guard from '@/components/auth-guard';
import { PageShell } from '@/components/common/page-shell';
import { SectionCard } from '@/components/common/section-card';
import { api } from '@/lib/api';
import { capsFor, normalizeRole, type AppRole } from '@/lib/roles';

type Person = {
  id: string;
  fullName: string;
  documentId?: string | null;
};

type Asset = {
  id: string;
  tag: string;
  name: string;
};

type User = {
  id: string;
  email: string;
  name?: string | null;
  documentId?: string | null;
  role?: string | null;
  isActive?: boolean | null;
};

type Category = {
  id: string;
  name: string;
  code?: string | null;
};

type Site = {
  id: string;
  name: string;
};

type Location = {
  id: string;
  name: string;
  siteId?: string | null;
};

type CheckboxOption = {
  value: string;
  label: string;
  description?: string | null;
};

const STATUS_OPTIONS: CheckboxOption[] = [
  { value: 'IN_STOCK', label: 'En bodega' },
  { value: 'ASSIGNED', label: 'Asignado' },
  { value: 'IN_REPAIR', label: 'En reparación' },
  { value: 'LOST', label: 'Perdido' },
  { value: 'DISPOSED', label: 'De baja' },
];

const PERSON_TYPES: CheckboxOption[] = [
  { value: 'PACIENTE', label: 'Paciente' },
  { value: 'NOMINA', label: 'Nómina' },
  { value: 'OPS', label: 'OPS' },
  { value: 'TERCERO', label: 'Tercero' },
];

const BIG_PAGE_SIZE = 10_000;

function toggleValue(current: string[], value: string, checked: boolean) {
  if (checked) {
    if (current.includes(value)) return current;

    return [...current, value];
  }

  return current.filter((item) => item !== value);
}

function safeLower(value?: string | null) {
  return String(value || '').toLowerCase();
}

function extractItems<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (
    payload &&
    typeof payload === 'object' &&
    Array.isArray((payload as any).items)
  ) {
    return (payload as any).items as T[];
  }

  return [];
}

function inputClass() {
  return 'h-11 w-full rounded-2xl border border-slate-200 bg-white px-10 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#3C9CD1] focus:ring-4 focus:ring-[#3C9CD1]/10';
}

function smallInputClass() {
  return 'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#3C9CD1] focus:ring-4 focus:ring-[#3C9CD1]/10';
}



function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={inputClass()}
      />

      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label="Limpiar búsqueda"
        >
          <XCircle className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function CheckboxPanel({
  title,
  subtitle,
  options,
  selected,
  onToggle,
  loading,
  emptyLabel = 'Sin opciones disponibles',
  maxHeight = 'max-h-48',
}: {
  title: string;
  subtitle?: string;
  options: CheckboxOption[];
  selected: string[];
  onToggle: (value: string, checked: boolean) => void;
  loading?: boolean;
  emptyLabel?: string;
  maxHeight?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <p className="text-sm font-semibold text-[#1B3859]">{title}</p>
        {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
      </div>

      <div
        className={`${maxHeight} space-y-1 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-2`}
      >
        {loading ? (
          <div className="flex items-center gap-2 px-2 py-3 text-xs text-slate-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Cargando…
          </div>
        ) : options.length === 0 ? (
          <p className="px-2 py-3 text-xs text-slate-400">{emptyLabel}</p>
        ) : (
          options.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-700 transition hover:bg-white sm:text-sm"
            >
              <input
                type="checkbox"
                className="mt-0.5 rounded border-slate-300 text-[#1B3859] focus:ring-[#3C9CD1]"
                checked={selected.includes(option.value)}
                onChange={(event) => onToggle(option.value, event.target.checked)}
              />

              <span className="min-w-0">
                <span className="block truncate font-medium">{option.label}</span>
                {option.description && (
                  <span className="block truncate text-[11px] text-slate-500">
                    {option.description}
                  </span>
                )}
              </span>
            </label>
          ))
        )}
      </div>

      {selected.length > 0 && (
        <p className="mt-2 text-xs font-semibold text-[#1B3859]">
          {selected.length} seleccionado(s)
        </p>
      )}
    </div>
  );
}

function ReportCard({
  title,
  description,
  icon,
  badge,
  children,
  footer,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  badge?: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50/70 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#3C9CD1]/10 text-[#1B3859]">
              {icon}
            </div>

            <div>
              <h2 className="text-base font-bold text-[#111827]">{title}</h2>
              <p className="mt-1 text-sm leading-5 text-slate-500">
                {description}
              </p>
            </div>
          </div>

          {badge && (
            <span className="inline-flex h-8 shrink-0 items-center rounded-full border border-[#3C9CD1]/30 bg-[#3C9CD1]/10 px-3 text-xs font-semibold text-[#1B3859]">
              {badge}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">{children}</div>

      <div className="flex justify-end border-t border-slate-100 bg-slate-50/60 px-4 py-4 sm:px-5">
        {footer}
      </div>
    </section>
  );
}

export default function ReportesPage() {
  const [roleReady, setRoleReady] = useState(false);
  const [role, setRole] = useState<AppRole | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedRole = localStorage.getItem('user_role');

    setRole(normalizeRole(storedRole));
    setRoleReady(true);
  }, []);

  const caps = useMemo(() => capsFor(role), [role]);

  const canExportInventory = caps.exportInventory;
  const canExportMovements = caps.exportMovements;
  const canExportPeople = caps.exportPeople;

  const needsInventoryCatalogs = canExportInventory;
  const needsMovementCatalogs = canExportMovements;

  const peopleQ = useQuery<Person[]>({
    queryKey: ['people-mini-for-reports'],
    enabled: roleReady && needsMovementCatalogs,
    queryFn: async (): Promise<Person[]> => {
      const res = await api.get<Person[] | { items: Person[] }>(
        '/api/people/mini',
        {
          params: {
            pageSize: BIG_PAGE_SIZE,
          },
        },
      );

      return extractItems<Person>(res.data);
    },
  });

  const assetsQ = useQuery<Asset[]>({
    queryKey: ['assets-mini-for-reports'],
    enabled: roleReady && needsMovementCatalogs,
    queryFn: async (): Promise<Asset[]> => {
      const res = await api.get<Asset[] | { items: Asset[] }>('/api/assets', {
        params: {
          pageSize: BIG_PAGE_SIZE,
        },
      });

      return extractItems<Asset>(res.data);
    },
  });

  const usersQ = useQuery<User[]>({
    queryKey: ['users-mini-for-reports'],
    enabled: roleReady && needsMovementCatalogs,
    queryFn: async (): Promise<User[]> => {
      const res = await api.get<User[] | { items: User[] }>('/api/users/mini', {
        params: {
          pageSize: BIG_PAGE_SIZE,
          active: true,
        },
      });

      return extractItems<User>(res.data);
    },
    retry: false,
  });

  const categoriesQ = useQuery<Category[]>({
    queryKey: ['categories-mini-for-reports'],
    enabled: roleReady && needsInventoryCatalogs,
    queryFn: async (): Promise<Category[]> => {
      const res = await api.get<Category[] | { items: Category[] }>(
        '/api/catalog/categories',
        {
          params: {
            pageSize: 1000,
          },
        },
      );

      return extractItems<Category>(res.data);
    },
  });

  const sitesQ = useQuery<Site[]>({
    queryKey: ['sites-mini-for-reports'],
    enabled: roleReady && needsInventoryCatalogs,
    queryFn: async (): Promise<Site[]> => {
      const res = await api.get<Site[] | { items: Site[] }>('/api/sites', {
        params: {
          pageSize: 500,
        },
      });

      return extractItems<Site>(res.data);
    },
  });

  const locationsQ = useQuery<Location[]>({
    queryKey: ['locations-mini-for-reports'],
    enabled: roleReady && needsInventoryCatalogs,
    queryFn: async (): Promise<Location[]> => {
      const res = await api.get<Location[] | { items: Location[] }>(
        '/api/catalog/locations',
        {
          params: {
            pageSize: 2000,
          },
        },
      );

      return extractItems<Location>(res.data);
    },
  });

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const [movAssetIds, setMovAssetIds] = useState<string[]>([]);
  const [movPersonIds, setMovPersonIds] = useState<string[]>([]);
  const [movAdminIds, setMovAdminIds] = useState<string[]>([]);

  const [assetSearch, setAssetSearch] = useState('');
  const [personSearch, setPersonSearch] = useState('');
  const [adminSearch, setAdminSearch] = useState('');

  const [invQ, setInvQ] = useState('');
  const [invStatus, setInvStatus] = useState<string[]>([]);
  const [invCategoryIds, setInvCategoryIds] = useState<string[]>([]);
  const [invSiteIds, setInvSiteIds] = useState<string[]>([]);
  const [invWarehouseIds, setInvWarehouseIds] = useState<string[]>([]);

  const [peopleTypeFilters, setPeopleTypeFilters] = useState<string[]>([]);

  async function download(url: string, filename: string) {
    try {
      const res = await api.get(url, {
        responseType: 'blob',
        withCredentials: true,
      });

      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');

      a.href = blobUrl;
      a.download = filename;

      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(blobUrl);
    } catch (error: any) {
      toast.error(error?.response?.data?.error ?? 'No se pudo descargar');
    }
  }

  const downloadInventory = () => {
    if (!canExportInventory) {
      toast.error('No tienes permiso para exportar inventario.');
      return;
    }

    const params = new URLSearchParams();

    if (invQ.trim()) {
      params.set('q', invQ.trim());
    }

    invStatus.forEach((status) => params.append('status', status));
    invCategoryIds.forEach((id) => params.append('categoryId', id));
    invSiteIds.forEach((id) => params.append('siteId', id));
    invWarehouseIds.forEach((id) => params.append('assignedWarehouseId', id));

    const qs = params.toString();
    const url = qs
      ? `/api/reports/inventory.csv?${qs}`
      : '/api/reports/inventory.csv';

    download(url, 'inventario.csv');
  };

  const downloadMovements = () => {
    if (!canExportMovements) {
      toast.error('No tienes permiso para exportar movimientos.');
      return;
    }

    const params = new URLSearchParams();

    if (from) {
      params.set('from', from);
    }

    if (to) {
      params.set('to', to);
    }

    movAssetIds.forEach((id) => params.append('assetId', id));
    movPersonIds.forEach((id) => params.append('personId', id));
    movAdminIds.forEach((id) => params.append('createdById', id));

    const qs = params.toString();
    const url = qs
      ? `/api/reports/movements.csv?${qs}`
      : '/api/reports/movements.csv';

    download(url, 'movimientos.csv');
  };

  const downloadPeople = () => {
    if (!canExportPeople) {
      toast.error('No tienes permiso para exportar población.');
      return;
    }

    const params = new URLSearchParams();

    peopleTypeFilters.forEach((type) => params.append('type', type));

    const qs = params.toString();
    const url = qs
      ? `/api/reports/people.csv?${qs}`
      : '/api/reports/people.csv';

    download(url, 'poblacion.csv');
  };

  const clearInventoryFilters = () => {
    setInvQ('');
    setInvStatus([]);
    setInvCategoryIds([]);
    setInvSiteIds([]);
    setInvWarehouseIds([]);
  };

  const clearPeopleFilters = () => {
    setPeopleTypeFilters([]);
  };

  const clearMovementFilters = () => {
    setFrom('');
    setTo('');
    setMovAssetIds([]);
    setMovPersonIds([]);
    setMovAdminIds([]);
    setAssetSearch('');
    setPersonSearch('');
    setAdminSearch('');
  };

  const filteredAssets =
    assetsQ.data?.filter((asset) => {
      const term = assetSearch.trim().toLowerCase();

      if (!term) return true;

      return (
        safeLower(asset.tag).includes(term) ||
        safeLower(asset.name).includes(term)
      );
    }) ?? [];

  const filteredPeople =
    peopleQ.data?.filter((person) => {
      const term = personSearch.trim().toLowerCase();

      if (!term) return true;

      return (
        safeLower(person.fullName).includes(term) ||
        safeLower(person.documentId).includes(term)
      );
    }) ?? [];

  const filteredAdmins =
    usersQ.data?.filter((user) => {
      const term = adminSearch.trim().toLowerCase();

      if (!term) return true;

      return `${user.name || ''} ${user.email || ''} ${user.documentId || ''}`
        .toLowerCase()
        .includes(term);
    }) ?? [];

  const inventorySelectedCount =
    invStatus.length +
    invCategoryIds.length +
    invSiteIds.length +
    invWarehouseIds.length +
    (invQ.trim() ? 1 : 0);

  const movementSelectedCount =
    movAssetIds.length +
    movPersonIds.length +
    movAdminIds.length +
    (from ? 1 : 0) +
    (to ? 1 : 0);



  if (!roleReady) {
    return (
      <Guard>
        <PageShell>
          <SectionCard>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Verificando reportes disponibles…
            </div>
          </SectionCard>
        </PageShell>
      </Guard>
    );
  }

  return (
    <Guard>
      <PageShell>
        <SectionCard title="Reportes" contentClassName="p-0">
          <div className="space-y-5 p-4 sm:p-5">
           

            {canExportInventory && (
              <ReportCard
                title="Inventario"
                description="Exporta activos fijos en CSV con filtros por texto, estado, categoría, sede y bodega asignada."
                icon={<Database className="h-5 w-5" />}
                badge={`${inventorySelectedCount} filtro(s)`}
                footer={
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={clearInventoryFilters}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Limpiar
                    </button>

                    <button
                      type="button"
                      onClick={downloadInventory}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#1B3859] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#132B45]"
                    >
                      <Download className="h-4 w-4" />
                      Descargar inventario
                    </button>
                  </div>
                }
              >
                <SearchBox
                  value={invQ}
                  onChange={setInvQ}
                  placeholder="Buscar por código, nombre, serie o custodio…"
                />

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <CheckboxPanel
                    title="Estado"
                    subtitle="Filtra por estado del activo."
                    options={STATUS_OPTIONS}
                    selected={invStatus}
                    onToggle={(value, checked) =>
                      setInvStatus((prev) => toggleValue(prev, value, checked))
                    }
                  />

                  <CheckboxPanel
                    title="Categoría"
                    subtitle="Filtra por categoría."
                    loading={categoriesQ.isLoading}
                    options={(categoriesQ.data ?? []).map((category) => ({
                      value: category.id,
                      label: category.name,
                      description: category.code || null,
                    }))}
                    selected={invCategoryIds}
                    onToggle={(value, checked) =>
                      setInvCategoryIds((prev) =>
                        toggleValue(prev, value, checked),
                      )
                    }
                  />

                  <CheckboxPanel
                    title="Sede"
                    subtitle="Filtra por sede."
                    loading={sitesQ.isLoading}
                    options={(sitesQ.data ?? []).map((site) => ({
                      value: site.id,
                      label: site.name,
                    }))}
                    selected={invSiteIds}
                    onToggle={(value, checked) =>
                      setInvSiteIds((prev) => toggleValue(prev, value, checked))
                    }
                  />

                  <CheckboxPanel
                    title="Bodega asignada"
                    subtitle="Filtra por ubicación/bodega."
                    loading={locationsQ.isLoading}
                    maxHeight="max-h-56"
                    options={(locationsQ.data ?? []).map((location) => ({
                      value: location.id,
                      label: location.name,
                    }))}
                    selected={invWarehouseIds}
                    onToggle={(value, checked) =>
                      setInvWarehouseIds((prev) =>
                        toggleValue(prev, value, checked),
                      )
                    }
                  />
                </div>
              </ReportCard>
            )}

            {canExportPeople && (
              <ReportCard
                title="Población / custodios"
                description="Exporta la base de pacientes, nómina, OPS o terceros según los tipos seleccionados."
                icon={<Users className="h-5 w-5" />}
                badge={`${peopleTypeFilters.length} tipo(s)`}
                footer={
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={clearPeopleFilters}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Limpiar
                    </button>

                    <button
                      type="button"
                      onClick={downloadPeople}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#1B3859] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#132B45]"
                    >
                      <Download className="h-4 w-4" />
                      Descargar población
                    </button>
                  </div>
                }
              >
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <CheckboxPanel
                    title="Tipo de usuario"
                    subtitle="Sin selección exporta todos los tipos."
                    options={PERSON_TYPES}
                    selected={peopleTypeFilters}
                    onToggle={(value, checked) =>
                      setPeopleTypeFilters((prev) =>
                        toggleValue(prev, value, checked),
                      )
                    }
                  />

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:col-span-1 xl:col-span-3">
                    <div className="flex items-start gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#3C9CD1]/10 text-[#1B3859]">
                        <FileSpreadsheet className="h-5 w-5" />
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-[#1B3859]">
                          Exportación CSV
                        </p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          Este reporte descarga población con los filtros de tipo
                          aplicados. Si no marcas ningún tipo, el archivo sale completo.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </ReportCard>
            )}

            {canExportMovements && (
              <ReportCard
                title="Movimientos"
                description="Exporta historial de movimientos con filtros por fecha, activo, custodio o usuario administrativo."
                icon={<ClipboardList className="h-5 w-5" />}
                badge={`${movementSelectedCount} filtro(s)`}
                footer={
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={clearMovementFilters}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Limpiar
                    </button>

                    <button
                      type="button"
                      onClick={downloadMovements}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#1B3859] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#132B45]"
                    >
                      <Download className="h-4 w-4" />
                      Descargar movimientos
                    </button>
                  </div>
                }
              >
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      <CalendarDays className="h-4 w-4" />
                      Desde
                    </label>

                    <input
                      type="date"
                      className={`${smallInputClass()} mt-2`}
                      value={from}
                      onChange={(event) => setFrom(event.target.value)}
                    />
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      <CalendarDays className="h-4 w-4" />
                      Hasta
                    </label>

                    <input
                      type="date"
                      className={`${smallInputClass()} mt-2`}
                      value={to}
                      onChange={(event) => setTo(event.target.value)}
                    />
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
                    <div className="flex items-start gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#3C9CD1]/10 text-[#1B3859]">
                        <Filter className="h-5 w-5" />
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-[#1B3859]">
                          Filtros combinables
                        </p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          Puedes mezclar fechas, activos, custodios y usuarios administrativos.
                          Si no seleccionas nada, se exporta todo el historial disponible.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 xl:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-start gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#3C9CD1]/10 text-[#1B3859]">
                        <PackageCheck className="h-5 w-5" />
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-[#1B3859]">
                          Activos fijos
                        </p>
                        <p className="text-xs text-slate-500">
                          {movAssetIds.length} seleccionado(s)
                        </p>
                      </div>
                    </div>

                    <input
                      className={smallInputClass()}
                      placeholder="Buscar por código o nombre…"
                      value={assetSearch}
                      onChange={(event) => setAssetSearch(event.target.value)}
                    />

                    <div className="mt-3 max-h-64 space-y-1 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
                      {assetsQ.isLoading ? (
                        <div className="flex items-center gap-2 px-2 py-3 text-xs text-slate-400">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Cargando activos…
                        </div>
                      ) : filteredAssets.length === 0 ? (
                        <p className="px-2 py-3 text-xs text-slate-400">
                          Sin activos para mostrar.
                        </p>
                      ) : (
                        filteredAssets.map((asset) => (
                          <label
                            key={asset.id}
                            className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-700 transition hover:bg-white sm:text-sm"
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5 rounded border-slate-300 text-[#1B3859] focus:ring-[#3C9CD1]"
                              checked={movAssetIds.includes(asset.id)}
                              onChange={(event) =>
                                setMovAssetIds((prev) =>
                                  toggleValue(prev, asset.id, event.target.checked),
                                )
                              }
                            />

                            <span className="min-w-0">
                              <span className="block truncate font-semibold">
                                {asset.tag || 'S/N'}
                              </span>
                              <span className="block truncate text-[11px] text-slate-500">
                                {asset.name || 'Sin nombre'}
                              </span>
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-start gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#54BF5B]/10 text-[#16803A]">
                        <UserRound className="h-5 w-5" />
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-[#1B3859]">
                          Custodios / pacientes
                        </p>
                        <p className="text-xs text-slate-500">
                          {movPersonIds.length} seleccionado(s)
                        </p>
                      </div>
                    </div>

                    <input
                      className={smallInputClass()}
                      placeholder="Buscar por nombre o documento…"
                      value={personSearch}
                      onChange={(event) => setPersonSearch(event.target.value)}
                    />

                    <div className="mt-3 max-h-64 space-y-1 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
                      {peopleQ.isLoading ? (
                        <div className="flex items-center gap-2 px-2 py-3 text-xs text-slate-400">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Cargando custodios…
                        </div>
                      ) : filteredPeople.length === 0 ? (
                        <p className="px-2 py-3 text-xs text-slate-400">
                          Sin custodios para mostrar.
                        </p>
                      ) : (
                        filteredPeople.map((person) => (
                          <label
                            key={person.id}
                            className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-700 transition hover:bg-white sm:text-sm"
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5 rounded border-slate-300 text-[#1B3859] focus:ring-[#3C9CD1]"
                              checked={movPersonIds.includes(person.id)}
                              onChange={(event) =>
                                setMovPersonIds((prev) =>
                                  toggleValue(prev, person.id, event.target.checked),
                                )
                              }
                            />

                            <span className="min-w-0">
                              <span className="block truncate font-semibold">
                                {person.fullName || 'Sin nombre'}
                              </span>
                              {person.documentId && (
                                <span className="block truncate text-[11px] text-slate-500">
                                  {person.documentId}
                                </span>
                              )}
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-start gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-800">
                        <Shield className="h-5 w-5" />
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-[#1B3859]">
                          Usuarios administrativos
                        </p>
                        <p className="text-xs text-slate-500">
                          {movAdminIds.length} seleccionado(s)
                        </p>
                      </div>
                    </div>

                    <input
                      className={smallInputClass()}
                      placeholder="Buscar por nombre, correo o documento…"
                      value={adminSearch}
                      onChange={(event) => setAdminSearch(event.target.value)}
                    />

                    <div className="mt-3 max-h-64 space-y-1 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
                      {usersQ.isLoading ? (
                        <div className="flex items-center gap-2 px-2 py-3 text-xs text-slate-400">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Cargando usuarios…
                        </div>
                      ) : usersQ.isError ? (
                        <p className="px-2 py-3 text-xs text-amber-600">
                          No se pudo cargar este catálogo. Puedes exportar sin este filtro.
                        </p>
                      ) : filteredAdmins.length === 0 ? (
                        <p className="px-2 py-3 text-xs text-slate-400">
                          Sin usuarios para mostrar.
                        </p>
                      ) : (
                        filteredAdmins.map((user) => (
                          <label
                            key={user.id}
                            className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-700 transition hover:bg-white sm:text-sm"
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5 rounded border-slate-300 text-[#1B3859] focus:ring-[#3C9CD1]"
                              checked={movAdminIds.includes(user.id)}
                              onChange={(event) =>
                                setMovAdminIds((prev) =>
                                  toggleValue(prev, user.id, event.target.checked),
                                )
                              }
                            />

                            <span className="min-w-0">
                              <span className="block truncate font-semibold">
                                {user.name || user.email}
                              </span>
                              <span className="block truncate text-[11px] text-slate-500">
                                {user.email}
                              </span>
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </ReportCard>
            )}
          </div>
        </SectionCard>
      </PageShell>
    </Guard>
  );
}