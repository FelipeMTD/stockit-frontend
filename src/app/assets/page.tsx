'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import AssetTable from '@/components/assets/asset-table';
import ImportAssetsModal from '@/components/assets/import-assets-modal';
import Guard from '@/components/auth-guard';
import { api, type AuthUser } from '@/lib/api';
import { capsFor, normalizeRole, type AppRole } from '@/lib/roles';

type AssetSummary = {
  id: string;
  tag: string;
  name: string;
  status?: string | null;
};

type Site = {
  id: string;
  name: string;
  code?: string | null;
};

type Location = {
  id: string;
  name: string;
  code?: string | null;
  siteId?: string | null;
  site?: {
    id: string;
    name: string;
    code?: string | null;
  } | null;
};

export default function AssetsPage() {
  const router = useRouter();
  const qc = useQueryClient();

  const [showImport, setShowImport] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);

  const [me, setMe] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadMe() {
      try {
        setAuthError(null);

        const res = await api.get('/api/auth/me');
        if (!active) return;

        const user = res.data as AuthUser;
        const normalizedRole = normalizeRole(user.role);

        if (typeof window !== 'undefined') {
          if (normalizedRole) {
            localStorage.setItem('user_role', normalizedRole);
          } else {
            localStorage.removeItem('user_role');
          }
        }

        setMe({
          ...user,
          role: normalizedRole ?? user.role,
        });

        setRole(normalizedRole);
      } catch (err) {
        console.error('Error cargando /api/auth/me', err);

        if (!active) return;

        setMe(null);
        setRole(null);
        setAuthError('No se pudo validar la sesión del usuario.');
      } finally {
        if (active) setAuthLoading(false);
      }
    }

    loadMe();

    return () => {
      active = false;
    };
  }, []);

  const caps = useMemo(() => capsFor(role), [role]);

  const canViewAssets = caps.viewInventory;
  const canManageAssets = caps.editInventory;
  const isDriver = role === 'CONDUCTOR';

  useEffect(() => {
    if (!authLoading && isDriver) {
      router.replace('/routes');
    }
  }, [authLoading, isDriver, router]);

  useEffect(() => {
    if (!authLoading && role && !canViewAssets) {
      router.replace('/assets');
    }
  }, [authLoading, role, canViewAssets, router]);

  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [targetSiteId, setTargetSiteId] = useState('');
  const [targetLocationId, setTargetLocationId] = useState('');

  const [loadingTransferData, setLoadingTransferData] = useState(false);
  const [savingTransfer, setSavingTransfer] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  const [assetSearch, setAssetSearch] = useState('');

  const transferableAssets = assets.filter((asset) => {
    const status = String(asset.status || '').trim().toUpperCase();
    return status === 'IN_STOCK' || status === 'EN_BODEGA' || status === 'EN BODEGA';
  });

  const normalizedSearch = assetSearch.trim().toLowerCase();

  const visibleAssets = transferableAssets.filter((asset) => {
    if (!normalizedSearch) return true;

    const tag = String(asset.tag || '').toLowerCase();
    const name = String(asset.name || '').toLowerCase();

    return tag.includes(normalizedSearch) || name.includes(normalizedSearch);
  });

  useEffect(() => {
    if (!showTransfer || !canManageAssets) return;

    const loadData = async () => {
      setLoadingTransferData(true);
      setTransferError(null);

      try {
        const [resAssets, resSites, resLocations] = await Promise.all([
          api.get('/api/assets', {
            params: {
              pageSize: 10000,
            },
          }),
          api.get('/api/sites', {
            params: {
              pageSize: 1000,
            },
          }),
          api.get('/api/catalog/locations', {
            params: {
              pageSize: 2000,
            },
          }),
        ]);

        setAssets((resAssets.data?.items ?? []) as AssetSummary[]);
        setSites((resSites.data?.items ?? []) as Site[]);
        setLocations((resLocations.data?.items ?? []) as Location[]);
      } catch (err) {
        console.error(err);
        setTransferError('No se pudieron cargar datos para el traslado.');
      } finally {
        setLoadingTransferData(false);
      }
    };

    loadData();
  }, [showTransfer, canManageAssets]);

  const toggleAsset = (id: string) => {
    setSelectedAssetIds((prev) =>
      prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id],
    );
  };

  const filteredLocations = locations.filter((location) => {
    if (targetSiteId && location.siteId) {
      return location.siteId === targetSiteId;
    }

    return true;
  });

  const resetTransferForm = () => {
    setSelectedAssetIds([]);
    setTargetSiteId('');
    setTargetLocationId('');
    setAssetSearch('');
    setTransferError(null);
  };

  const handleTransferSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!canManageAssets) {
      alert('No tienes permisos para realizar traslados.');
      return;
    }

    if (!selectedAssetIds.length) {
      alert('Selecciona al menos un activo.');
      return;
    }

    if (!targetLocationId) {
      alert('Selecciona la bodega / ubicación destino.');
      return;
    }

    setSavingTransfer(true);

    try {
      await api.post('/api/movements/bulk-transfer', {
        assetIds: selectedAssetIds,
        toLocationId: targetLocationId,
        ...(targetSiteId ? { siteId: targetSiteId } : {}),
      });

      setShowTransfer(false);
      resetTransferForm();

      qc.invalidateQueries({
        queryKey: ['assets'],
      });
    } catch (err) {
      console.error(err);
      alert('No se pudo registrar el traslado.');
    } finally {
      setSavingTransfer(false);
    }
  };

  const handleCloseTransfer = () => {
    setShowTransfer(false);
    resetTransferForm();
  };

  return (
    <Guard>
      {authLoading || isDriver ? (
        <div className="p-4 text-sm text-slate-500">
          {authLoading ? 'Verificando usuario…' : 'Redirigiendo a rutas…'}
        </div>
      ) : authError ? (
        <div className="rounded-xl border bg-white p-4 text-sm text-red-600 dark:bg-slate-900">
          {authError}
        </div>
      ) : !canViewAssets ? (
        <div className="rounded-xl border bg-white p-4 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">
          No tienes permisos para ver inventario.
        </div>
      ) : (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold">Activos</h1>

              {me?.role && (
                <p className="mt-1 text-xs text-slate-500">
                  Rol: {me.role}
                </p>
              )}
            </div>

            {canManageAssets && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setShowTransfer(true)}
                  className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Traslados
                </button>

                <button
                  onClick={() => setShowImport(true)}
                  className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Importar CSV
                </button>

                <Link
                  href="/assets/new"
                  className="rounded-xl bg-lime-500 px-4 py-2 text-sm text-white hover:bg-lime-600"
                >
                  Crear activo
                </Link>
              </div>
            )}
          </div>

          <AssetTable />

          {canManageAssets && (
            <ImportAssetsModal
              open={showImport}
              onOpenChange={setShowImport}
              onImported={() =>
                qc.invalidateQueries({
                  queryKey: ['assets'],
                })
              }
            />
          )}

          {canManageAssets && showTransfer && (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-3">
              <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white p-4 shadow-lg dark:bg-slate-900">
                <h2 className="mb-3 text-base font-semibold">
                  Traslado de activos
                </h2>

                <form
                  onSubmit={handleTransferSubmit}
                  className="flex flex-1 flex-col gap-3 text-sm"
                >
                  <div className="grid max-h-[60vh] gap-4 overflow-y-auto pr-1 md:grid-cols-2">
                    <div>
                      <h3 className="mb-2 text-sm font-medium">
                        Activos en bodega
                      </h3>

                      <p className="mb-2 text-xs text-slate-500">
                        Solo se listan activos que están EN BODEGA / IN_STOCK.
                      </p>

                      <input
                        type="text"
                        placeholder="Buscar por código o nombre…"
                        value={assetSearch}
                        onChange={(event) => setAssetSearch(event.target.value)}
                        className="mb-2 w-full rounded border bg-white px-2 py-1 text-xs dark:bg-slate-950"
                      />

                      {loadingTransferData && (
                        <p className="text-xs text-slate-500">
                          Cargando activos…
                        </p>
                      )}

                      {transferError && (
                        <p className="text-xs text-red-500">
                          {transferError}
                        </p>
                      )}

                      {!loadingTransferData && !transferableAssets.length && (
                        <p className="text-xs text-slate-500">
                          No hay activos en bodega disponibles para traslado.
                        </p>
                      )}

                      {!loadingTransferData &&
                        transferableAssets.length > 0 &&
                        !visibleAssets.length && (
                          <p className="text-xs text-slate-500">
                            No hay activos que coincidan con la búsqueda.
                          </p>
                        )}

                      <div className="max-h-64 space-y-1 overflow-y-auto rounded border bg-white p-2 dark:bg-slate-950">
                        {visibleAssets.map((asset) => (
                          <label
                            key={asset.id}
                            className="flex cursor-pointer items-center gap-2 text-xs"
                          >
                            <input
                              type="checkbox"
                              className="h-3 w-3"
                              checked={selectedAssetIds.includes(asset.id)}
                              onChange={() => toggleAsset(asset.id)}
                            />

                            <span className="truncate">
                              <b>{asset.tag}</b> — {asset.name}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="mb-1 block text-xs text-slate-500">
                          Sede destino opcional
                        </label>

                        <select
                          className="w-full rounded border bg-white px-2 py-1.5 text-sm dark:bg-slate-950"
                          value={targetSiteId}
                          onChange={(event) => {
                            setTargetSiteId(event.target.value);
                            setTargetLocationId('');
                          }}
                        >
                          <option value="">Selecciona…</option>

                          {sites.map((site) => (
                            <option key={site.id} value={site.id}>
                              {site.name}
                              {site.code ? ` (${site.code})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs text-slate-500">
                          Bodega / ubicación destino
                        </label>

                        <select
                          className="w-full rounded border bg-white px-2 py-1.5 text-sm dark:bg-slate-950"
                          value={targetLocationId}
                          onChange={(event) =>
                            setTargetLocationId(event.target.value)
                          }
                          required
                        >
                          <option value="">Selecciona…</option>

                          {filteredLocations.map((location) => (
                            <option key={location.id} value={location.id}>
                              {location.name}
                              {location.code ? ` (${location.code})` : ''}
                              {location.site?.name
                                ? ` — ${location.site.name}`
                                : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleCloseTransfer}
                      className="rounded-lg border px-3 py-1.5 text-xs"
                      disabled={savingTransfer}
                    >
                      Cancelar
                    </button>

                    <button
                      type="submit"
                      disabled={savingTransfer || loadingTransferData}
                      className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
                    >
                      {savingTransfer ? 'Guardando…' : 'Guardar traslado'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </section>
      )}
    </Guard>
  );
}