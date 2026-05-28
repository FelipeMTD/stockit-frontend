'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRightLeft, FileUp, Plus, X } from 'lucide-react';

import AssetTable from '@/components/assets/asset-table';
import ImportAssetsModal from '@/components/assets/import-assets-modal';
import Guard from '@/components/auth-guard';

import { PageShell } from '@/components/common/page-shell';
import { SectionCard } from '@/components/common/section-card';
import { api } from '@/lib/api';
import { useRbacSession } from '@/lib/rbac-session';

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

  const { role, caps, isAuthenticated } = useRbacSession();

  const [showImport, setShowImport] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);

  const canViewAssets = caps.viewInventory;
  const canManageAssets = caps.editInventory;
  const isDriver = role === 'CONDUCTOR';

  useEffect(() => {
    if (isDriver) {
      router.replace('/routes');
    }
  }, [isDriver, router]);

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

    return (
      status === 'IN_STOCK' ||
      status === 'EN_BODEGA' ||
      status === 'EN BODEGA'
    );
  });

  const normalizedSearch = assetSearch.trim().toLowerCase();

  const visibleAssets = transferableAssets.filter((asset) => {
    if (!normalizedSearch) return true;

    const tag = String(asset.tag || '').toLowerCase();
    const name = String(asset.name || '').toLowerCase();

    return tag.includes(normalizedSearch) || name.includes(normalizedSearch);
  });

  const selectedAssets = assets.filter((asset) =>
    selectedAssetIds.includes(asset.id),
  );

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
  const removeSelectedAsset = (id: string) => {
    setSelectedAssetIds((prev) => prev.filter((item) => item !== id));
  };

  const clearSelectedAssets = () => {
    setSelectedAssetIds([]);
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

  const handleTransferSubmit = async (event: FormEvent) => {
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
      {isDriver ? (
        <PageShell>
          <SectionCard>
            <p className="text-sm text-slate-500">Redirigiendo a rutas…</p>
          </SectionCard>
        </PageShell>
      ) : !isAuthenticated ? (
        <PageShell>
          <SectionCard>
            <p className="text-sm text-slate-500">Verificando sesión…</p>
          </SectionCard>
        </PageShell>
      ) : !canViewAssets ? (
        <PageShell>
          <SectionCard>
            <p className="text-sm text-slate-600">
              No tienes permisos para ver inventario.
            </p>
          </SectionCard>
        </PageShell>
      ) : (
        <PageShell>
          <SectionCard
            title="Listado de activos"
            contentClassName="p-4 sm:p-5"
            actions={
              canManageAssets ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShowTransfer(true)}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-[#1B3859] transition hover:bg-slate-50"
                  >
                    <ArrowRightLeft className="h-4 w-4" />
                    Traslados
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowImport(true)}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-[#1B3859] transition hover:bg-slate-50"
                  >
                    <FileUp className="h-4 w-4" />
                    Importar CSV
                  </button>

                  <Link
                    href="/assets/new"
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#1B3859] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#132B45]"
                  >
                    <Plus className="h-4 w-4" />
                    Crear activo
                  </Link>
                </>
              ) : null
            }
          >
            <Suspense
  fallback={
    <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white text-sm text-slate-500">
      Cargando listado de activos…
    </div>
  }
>
  <Suspense
  fallback={
    <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white text-sm text-slate-500">
      Cargando listado de activos…
    </div>
  }
>
  <AssetTable />
</Suspense>
</Suspense>
          </SectionCard>

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
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 px-3 py-6 backdrop-blur-sm">
              <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
                  <div>
                   

                    <h2 className="mt-1 text-lg font-semibold text-[#1B3859]">
                      Traslado de activos
                    </h2>

                  
                  </div>

                  <button
                    type="button"
                    onClick={handleCloseTransfer}
                    className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                    aria-label="Cerrar traslado"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <form
                  onSubmit={handleTransferSubmit}
                  className="flex flex-1 flex-col overflow-hidden text-sm"
                >
                  <div className="grid flex-1 gap-5 overflow-y-auto px-5 py-5 md:grid-cols-2">
                    <div>
                      <h3 className="mb-1 text-sm font-semibold text-[#1B3859]">
                        Activos en bodega
                      </h3>

                      <p className="mb-3 text-xs leading-5 text-slate-500">
                        Solo se listan activos que están EN BODEGA
                      </p>

                      <input
                        type="text"
                        placeholder="Buscar por código o nombre…"
                        value={assetSearch}
                        onChange={(event) => setAssetSearch(event.target.value)}
                        className="stock-input mb-3 h-9 text-xs"
                      />

                      {loadingTransferData && (
                        <p className="text-xs text-slate-500">Cargando activos…</p>
                      )}

                      {transferError && (
                        <p className="text-xs font-medium text-red-600">
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

                      <div className="mt-3 max-h-72 space-y-1 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50/70 p-2">
                        {visibleAssets.map((asset) => (
                          <label
                            key={asset.id}
                            className={[
                              'flex cursor-pointer items-center gap-2 rounded-xl px-2 py-2 text-xs transition',
                              selectedAssetIds.includes(asset.id)
                                ? 'bg-[#54BF5B]/10 ring-1 ring-[#54BF5B]/30'
                                : 'hover:bg-white',
                            ].join(' ')}
                          >
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-slate-300 accent-[#1B3859]"
                              checked={selectedAssetIds.includes(asset.id)}
                              onChange={() => toggleAsset(asset.id)}
                            />

                            <span className="min-w-0 truncate text-slate-600">
                              <b className="text-[#1B3859]">{asset.tag}</b> —{' '}
                              {asset.name}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Sede destino opcional
                        </label>

                        <select
                          className="stock-select"
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
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Bodega / ubicación destino
                        </label>

                        <select
                          className="stock-select"
                          value={targetLocationId}
                          onChange={(event) => setTargetLocationId(event.target.value)}
                          required
                        >
                          <option value="">Selecciona…</option>

                          {filteredLocations.map((location) => (
                            <option key={location.id} value={location.id}>
                              {location.name}
                              {location.code ? ` (${location.code})` : ''}
                              {location.site?.name ? ` — ${location.site.name}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                              Activos seleccionados
                            </p>

                            <p className="mt-1 text-sm text-slate-600">
                              Total:{' '}
                              <b className="text-[#1B3859]">{selectedAssets.length}</b>
                            </p>
                          </div>

                          {selectedAssets.length > 0 && (
                            <button
                              type="button"
                              onClick={clearSelectedAssets}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                            >
                              Limpiar
                            </button>
                          )}
                        </div>

                        {selectedAssets.length === 0 ? (
                          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center">
                            <p className="text-xs text-slate-500">
                              Aún no has seleccionado activos.
                            </p>
                          </div>
                        ) : (
                          <div className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
                            {selectedAssets.map((asset) => (
                              <div
                                key={asset.id}
                                className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2"
                              >
                                <div className="min-w-0">
                                  <p
                                    className="truncate text-xs font-bold text-[#1B3859]"
                                    title={asset.tag}
                                  >
                                    {asset.tag}
                                  </p>

                                  <p
                                    className="mt-0.5 line-clamp-2 text-xs leading-5 text-slate-500"
                                    title={asset.name}
                                  >
                                    {asset.name}
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => removeSelectedAsset(asset.id)}
                                  className="grid h-7 w-7 shrink-0 place-items-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                                  aria-label={`Quitar ${asset.tag}`}
                                  title="Quitar seleccionado"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-5 py-4 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={handleCloseTransfer}
                      disabled={savingTransfer}
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Cancelar
                    </button>

                    <button
                      type="submit"
                      disabled={savingTransfer || loadingTransferData}
                      className="inline-flex h-10 items-center justify-center rounded-xl bg-[#1B3859] px-4 text-sm font-semibold text-white transition hover:bg-[#132B45] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingTransfer ? 'Guardando…' : 'Guardar traslado'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </PageShell>
      )}
    </Guard>
  );
}