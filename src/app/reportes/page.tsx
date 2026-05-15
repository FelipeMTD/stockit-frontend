'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import Guard from '@/components/auth-guard';
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

const STATUS_OPTIONS = [
  { value: 'IN_STOCK', label: 'En bodega' },
  { value: 'ASSIGNED', label: 'Asignado' },
  { value: 'IN_REPAIR', label: 'En reparación' },
  { value: 'LOST', label: 'Perdido' },
  { value: 'DISPOSED', label: 'De baja' },
];

const PERSON_TYPES = [
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
      const res = await api.get<{ items: Asset[] }>('/api/assets', {
        params: {
          pageSize: BIG_PAGE_SIZE,
        },
      });

      return res.data.items;
    },
  });

  const usersQ = useQuery<User[]>({
    queryKey: ['users-mini-for-reports'],
    enabled: roleReady && needsMovementCatalogs,
    queryFn: async (): Promise<User[]> => {
      /**
       * No usar /api/users aquí.
       * /api/users queda reservado para gestión completa de usuarios.
       * /api/users/mini es el catálogo liviano permitido para filtros.
       */
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
      const res = await api.get<{ items: Category[] }>(
        '/api/catalog/categories',
        {
          params: {
            pageSize: 1000,
          },
        },
      );

      return res.data.items;
    },
  });

  const sitesQ = useQuery<Site[]>({
    queryKey: ['sites-mini-for-reports'],
    enabled: roleReady && needsInventoryCatalogs,
    queryFn: async (): Promise<Site[]> => {
      const res = await api.get<{ items: Site[] }>('/api/sites', {
        params: {
          pageSize: 500,
        },
      });

      return res.data.items;
    },
  });

  const locationsQ = useQuery<Location[]>({
    queryKey: ['locations-mini-for-reports'],
    enabled: roleReady && needsInventoryCatalogs,
    queryFn: async (): Promise<Location[]> => {
      const res = await api.get<{ items: Location[] }>(
        '/api/catalog/locations',
        {
          params: {
            pageSize: 2000,
          },
        },
      );

      return res.data.items;
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
    if (from && to && from > to) {
      toast.error('La fecha inicial no puede ser mayor que la fecha final.');
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

  const hasAnyReport =
    canExportInventory || canExportMovements || canExportPeople;

  return (
    <Guard>
      <section className="space-y-6">
        <div>
          <h1 className="text-lg font-semibold">Reportes</h1>
          <p className="mt-1 text-sm text-slate-500">
            Exportación controlada según permisos del rol.
          </p>
        </div>

        {roleReady && !hasAnyReport && (
          <div className="rounded-xl border bg-white p-4 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">
            No tienes reportes disponibles para exportar.
          </div>
        )}

        {canExportInventory && (
          <div className="border rounded-xl bg-white dark:bg-slate-900 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h2 className="font-medium">Inventario (CSV)</h2>
              <p className="text-xs text-slate-500">
                Filtros multiselección por estado, categoría, sede y bodega.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="text-xs text-slate-500">Buscar</label>
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  value={invQ}
                  onChange={(event) => setInvQ(event.target.value)}
                  placeholder="código / nombre / serie / custodio"
                />
              </div>

              <div>
                <label className="text-xs text-slate-500 block mb-1">
                  Estado (multi)
                </label>

                <div className="border rounded-lg px-3 py-2 max-h-40 overflow-auto space-y-1">
                  {STATUS_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className="flex items-center gap-2 text-xs sm:text-sm"
                    >
                      <input
                        type="checkbox"
                        className="rounded border"
                        checked={invStatus.includes(option.value)}
                        onChange={(event) =>
                          setInvStatus((prev) =>
                            toggleValue(
                              prev,
                              option.value,
                              event.target.checked,
                            ),
                          )
                        }
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-500 block mb-1">
                  Categoría (multi)
                </label>

                <div className="border rounded-lg px-3 py-2 max-h-40 overflow-auto space-y-1">
                  {categoriesQ.isLoading && (
                    <p className="text-xs text-slate-400">
                      Cargando categorías…
                    </p>
                  )}

                  {categoriesQ.data?.map((category) => (
                    <label
                      key={category.id}
                      className="flex items-center gap-2 text-xs sm:text-sm"
                    >
                      <input
                        type="checkbox"
                        className="rounded border"
                        checked={invCategoryIds.includes(category.id)}
                        onChange={(event) =>
                          setInvCategoryIds((prev) =>
                            toggleValue(
                              prev,
                              category.id,
                              event.target.checked,
                            ),
                          )
                        }
                      />
                      <span>
                        {category.name}
                        {category.code ? ` (${category.code})` : ''}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-500 block mb-1">
                  Sede (multi)
                </label>

                <div className="border rounded-lg px-3 py-2 max-h-40 overflow-auto space-y-1">
                  {sitesQ.isLoading && (
                    <p className="text-xs text-slate-400">Cargando sedes…</p>
                  )}

                  {sitesQ.data?.map((site) => (
                    <label
                      key={site.id}
                      className="flex items-center gap-2 text-xs sm:text-sm"
                    >
                      <input
                        type="checkbox"
                        className="rounded border"
                        checked={invSiteIds.includes(site.id)}
                        onChange={(event) =>
                          setInvSiteIds((prev) =>
                            toggleValue(prev, site.id, event.target.checked),
                          )
                        }
                      />
                      <span>{site.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="md:col-span-2 lg:col-span-4">
                <label className="text-xs text-slate-500 block mb-1">
                  Bodega asignada (multi)
                </label>

                <div className="border rounded-lg px-3 py-2 max-h-48 overflow-auto space-y-1">
                  {locationsQ.isLoading && (
                    <p className="text-xs text-slate-400">Cargando bodegas…</p>
                  )}

                  {locationsQ.data?.map((location) => (
                    <label
                      key={location.id}
                      className="flex items-center gap-2 text-xs sm:text-sm"
                    >
                      <input
                        type="checkbox"
                        className="rounded border"
                        checked={invWarehouseIds.includes(location.id)}
                        onChange={(event) =>
                          setInvWarehouseIds((prev) =>
                            toggleValue(
                              prev,
                              location.id,
                              event.target.checked,
                            ),
                          )
                        }
                      />
                      <span>{location.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm hover:opacity-90"
                onClick={downloadInventory}
              >
                Descargar inventario
              </button>
            </div>
          </div>
        )}

        {canExportPeople && (
          <div className="border rounded-xl bg-white dark:bg-slate-900 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h2 className="font-medium">Población / Custodios (CSV)</h2>
              <p className="text-xs text-slate-500">
                Descarga la base de Pacientes, Nómina, OPS o Terceros.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-1 lg:grid-cols-4">
              <div>
                <label className="text-xs text-slate-500 block mb-1">
                  Tipo de usuario
                </label>

                <div className="border rounded-lg px-3 py-2 max-h-40 overflow-auto space-y-1">
                  {PERSON_TYPES.map((option) => (
                    <label
                      key={option.value}
                      className="flex items-center gap-2 text-xs sm:text-sm"
                    >
                      <input
                        type="checkbox"
                        className="rounded border"
                        checked={peopleTypeFilters.includes(option.value)}
                        onChange={(event) =>
                          setPeopleTypeFilters((prev) =>
                            toggleValue(
                              prev,
                              option.value,
                              event.target.checked,
                            ),
                          )
                        }
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                className="rounded-lg bg-sky-600 text-white px-4 py-2 text-sm hover:opacity-90"
                onClick={downloadPeople}
              >
                Descargar población
              </button>
            </div>
          </div>
        )}

        {canExportMovements && (
          <div className="border rounded-xl bg-white dark:bg-slate-900 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h2 className="font-medium">Movimientos (CSV)</h2>
              <p className="text-xs text-slate-500">
                Filtra por activos, custodios y usuarios administrativos.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="text-xs text-slate-500">Desde</label>
                <input
                  type="date"
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                />
              </div>

              <div>
                <label className="text-xs text-slate-500">Hasta</label>
                <input
                  type="date"
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-1 lg:grid-cols-3">
              <div className="border rounded-lg p-3 flex flex-col gap-2">
                <p className="text-sm font-medium">Activos fijos</p>

                <input
                  className="w-full rounded-lg border px-3 py-1.5 text-xs mb-2"
                  placeholder="Buscar por código / nombre"
                  value={assetSearch}
                  onChange={(event) => setAssetSearch(event.target.value)}
                />

                <div className="border rounded-lg px-3 py-2 max-h-60 overflow-auto space-y-1">
                  {assetsQ.isLoading && (
                    <p className="text-xs text-slate-400">Cargando activos…</p>
                  )}

                  {filteredAssets.map((asset) => (
                    <label
                      key={asset.id}
                      className="flex items-center gap-2 text-xs sm:text-sm"
                    >
                      <input
                        type="checkbox"
                        className="rounded border"
                        checked={movAssetIds.includes(asset.id)}
                        onChange={(event) =>
                          setMovAssetIds((prev) =>
                            toggleValue(prev, asset.id, event.target.checked),
                          )
                        }
                      />
                      <span>
                        {asset.tag} — {asset.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="border rounded-lg p-3 flex flex-col gap-2">
                <p className="text-sm font-medium">Usuarios custodios</p>

                <input
                  className="w-full rounded-lg border px-3 py-1.5 text-xs mb-2"
                  placeholder="Buscar por nombre / documento"
                  value={personSearch}
                  onChange={(event) => setPersonSearch(event.target.value)}
                />

                <div className="border rounded-lg px-3 py-2 max-h-60 overflow-auto space-y-1">
                  {peopleQ.isLoading && (
                    <p className="text-xs text-slate-400">Cargando custodios…</p>
                  )}

                  {filteredPeople.map((person) => (
                    <label
                      key={person.id}
                      className="flex items-center gap-2 text-xs sm:text-sm"
                    >
                      <input
                        type="checkbox"
                        className="rounded border"
                        checked={movPersonIds.includes(person.id)}
                        onChange={(event) =>
                          setMovPersonIds((prev) =>
                            toggleValue(prev, person.id, event.target.checked),
                          )
                        }
                      />
                      <span>
                        {person.fullName}
                        {person.documentId ? ` — ${person.documentId}` : ''}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="border rounded-lg p-3 flex flex-col gap-2">
                <p className="text-sm font-medium">Usuarios administrativos</p>

                <input
                  className="w-full rounded-lg border px-3 py-1.5 text-xs mb-2"
                  placeholder="Buscar por nombre / correo"
                  value={adminSearch}
                  onChange={(event) => setAdminSearch(event.target.value)}
                />

                <div className="border rounded-lg px-3 py-2 max-h-60 overflow-auto space-y-1">
                  {usersQ.isLoading && (
                    <p className="text-xs text-slate-400">
                      Cargando usuarios administrativos…
                    </p>
                  )}

                  {usersQ.isError && (
                    <p className="text-xs text-amber-600">
                      No se pudo cargar el catálogo de administradores. Puedes
                      exportar movimientos sin este filtro.
                    </p>
                  )}

                  {filteredAdmins.map((user) => (
                    <label
                      key={user.id}
                      className="flex items-center gap-2 text-xs sm:text-sm"
                    >
                      <input
                        type="checkbox"
                        className="rounded border"
                        checked={movAdminIds.includes(user.id)}
                        onChange={(event) =>
                          setMovAdminIds((prev) =>
                            toggleValue(prev, user.id, event.target.checked),
                          )
                        }
                      />
                      <span>{user.name || user.email}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm hover:opacity-90"
                onClick={downloadMovements}
              >
                Descargar movimientos
              </button>
            </div>
          </div>
        )}
      </section>
    </Guard>
  );
}