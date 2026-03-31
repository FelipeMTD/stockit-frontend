'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useCategories, useLocations, useSites } from '@/lib/hooks';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

/* ────────────────────────────────────────────────────────────────────────────
   Tipos
──────────────────────────────────────────────────────────────────────────── */
type MaintenanceFrequency = 'ANUAL' | 'SEMESTRAL' | 'TRIMESTRAL' | 'NO_APLICA';

type AssetDetail = {
  id: string;
  tag: string;
  name: string;
  serial?: string | null;
  category?: { id: string; name: string } | null;
  brand?: string | null;
  model?: string | null;
  supplierName?: string | null;
  invoiceNumber?: string | null;
  invimaCode?: string | null;
  purchaseCost?: number | null;
  purchaseDate?: string | null; // ISO
  warrantyUntil?: string | null; // ISO
  acquisitionType?: string | null;
  riskLevel?: string | null;

  maintenanceFrequency?: MaintenanceFrequency | null;

  status: 'IN_STOCK' | 'ASSIGNED' | 'IN_REPAIR' | 'LOST' | 'DISPOSED';
  lifeState?: 'ACTIVE' | 'INACTIVE' | 'RETIRED' | null;
  photoUrl?: string | null;
  notes?: string | null;

  site?: { id: string; name: string } | null;
  currentLocation?: { id: string; name: string } | null;
  assignedWarehouse?: { id: string; name: string } | null;
};

type AssetUpdatePayload = {
  tag?: string;
  name?: string;
  serial?: string | null;
  categoryId?: string | null;
  brand?: string | null;
  model?: string | null;
  supplierName?: string | null;
  invoiceNumber?: string | null;
  invimaCode?: string | null;
  purchaseCost?: number | null;
  purchaseDate?: string | null;
  warrantyUntil?: string | null;
  acquisitionType?: string | null;
  riskLevel?: string | null;

  maintenanceFrequency?: MaintenanceFrequency | null;

  status?: 'IN_STOCK' | 'ASSIGNED' | 'IN_REPAIR' | 'LOST' | 'DISPOSED';
  lifeState?: 'ACTIVE' | 'INACTIVE' | 'RETIRED' | null;
  photoUrl?: string | null;
  notes?: string | null;

  siteId?: string | null;
  currentLocationId?: string | null;
  assignedWarehouseId?: string | null;
};

const ESTADOS_OPERATIVOS = [
  { value: 'IN_STOCK', label: 'En bodega' },
  { value: 'ASSIGNED', label: 'Asignado' },
  { value: 'IN_REPAIR', label: 'En reparación' },
  { value: 'LOST', label: 'Perdido' },
  { value: 'DISPOSED', label: 'De baja (dispuesto)' },
] as const;

const ESTADOS_DE_VIDA = [
  { value: 'ACTIVE', label: 'Activo' },
  { value: 'INACTIVE', label: 'Inactivo' },
  { value: 'RETIRED', label: 'Retirado' },
] as const;

const TIPOS_ADQUISICION = [
  'Compra',
  'Arrendamiento',
  'Donación',
  'Reposición',
  'Otro',
] as const;

const NIVELES_RIESGO = ['I', 'IIA', 'IIB', 'III', 'NO APLICA'] as const;

const FRECUENCIAS_MANTENIMIENTO: Array<{ value: MaintenanceFrequency; label: string }> = [
  { value: 'ANUAL', label: 'Anual' },
  { value: 'SEMESTRAL', label: 'Semestral' },
  { value: 'TRIMESTRAL', label: 'Trimestral' },
  { value: 'NO_APLICA', label: 'No aplica' },
];

/* ────────────────────────────────────────────────────────────────────────────
   Utils
──────────────────────────────────────────────────────────────────────────── */
function toYYYYMMDD(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
function numOrNull(v: string) {
  const n = v.replace(/\./g, '').replace(/,/g, '.');
  return n === '' ? null : Number(n);
}

/* ────────────────────────────────────────────────────────────────────────────
   React Query
──────────────────────────────────────────────────────────────────────────── */
function useAsset(id?: string) {
  return useQuery({
    queryKey: ['asset', id],
    enabled: !!id,
    queryFn: async () => (await api.get<AssetDetail>(`/api/assets/${id}`)).data,
  });
}
function useUpdateAsset(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AssetUpdatePayload) => api.patch(`/api/assets/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asset', id] });
      qc.invalidateQueries({ queryKey: ['assets'] });
    },
  });
}

/* ────────────────────────────────────────────────────────────────────────────
   Página
──────────────────────────────────────────────────────────────────────────── */
export default function EditAssetPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: asset, isLoading } = useAsset(id);
  const cats = useCategories();
  const locs = useLocations(); 
  const sites = useSites(); 

  const upd = useUpdateAsset(String(id));

  const [form, setForm] = useState<any>({
    _init: false,
    tag: '',
    name: '',
    serial: '',
    categoryId: '',
    brand: '',
    model: '',
    supplierName: '',
    invoiceNumber: '',
    invimaCode: '',
    purchaseCost: '',
    purchaseDate: '',
    warrantyUntil: '',
    acquisitionType: '',
    riskLevel: '',
    maintenanceFrequency: 'NO_APLICA',
    status: 'IN_STOCK',
    lifeState: 'ACTIVE',
    photoUrl: '',
    notes: '',
    siteId: '',
    currentLocationId: '',
    assignedWarehouseId: '',
  });

  useEffect(() => {
    if (!asset || form._init) return;

    const mf =
      (asset.maintenanceFrequency as MaintenanceFrequency | null | undefined) ??
      'NO_APLICA';

    setForm({
      _init: true,
      tag: asset.tag || '',
      name: asset.name || '',
      serial: asset.serial || '',
      categoryId: asset.category?.id || '',
      brand: asset.brand || '',
      model: asset.model || '',
      supplierName: asset.supplierName || '',
      invoiceNumber: asset.invoiceNumber || '',
      invimaCode: asset.invimaCode || '',
      purchaseCost: asset.purchaseCost ?? '',
      purchaseDate: toYYYYMMDD(asset.purchaseDate),
      warrantyUntil: toYYYYMMDD(asset.warrantyUntil),
      acquisitionType: asset.acquisitionType || '',
      riskLevel: asset.riskLevel || '',
      maintenanceFrequency: mf || 'NO_APLICA',
      status: asset.status || 'IN_STOCK',
      lifeState: asset.lifeState || 'ACTIVE',
      photoUrl: asset.photoUrl || '',
      notes: asset.notes || '',
      siteId: asset.site?.id || '',
      currentLocationId: asset.currentLocation?.id || '',
      assignedWarehouseId: asset.assignedWarehouse?.id || '',
    });
  }, [asset, form._init]);

  const set = (k: string, v: any) => setForm((s: any) => ({ ...s, [k]: v }));

  const previewSrc = useMemo(() => {
    const url = String(form.photoUrl || '').trim();
    return url.startsWith('http') ? url : '';
  }, [form.photoUrl]);

  const locItemsRaw = (locs.data as any)?.items ?? locs.data ?? [];
  const allLocations: any[] = Array.isArray(locItemsRaw) ? locItemsRaw : [];

  const selectedSiteId = form.siteId || '';

  // 👇 LÓGICA CLAVE AÑADIDA PARA ESTA VISTA
  const selectedCategoryId = form.categoryId || '';
  const selectedCategory = (cats.data as any[])?.find((c: any) => c.id === selectedCategoryId);
  const availableNames = selectedCategory?.allowedNames || [];

  const warehouses = useMemo(() => {
    if (!allLocations.length) return [];
    const hasType = allLocations.some((l) => typeof l?.type === 'string');
    let list = hasType
      ? allLocations.filter((l) => (l?.type || '').toLowerCase() === 'warehouse')
      : allLocations;

    if (selectedSiteId) {
      const hasSiteId = list.some((l) => 'siteId' in l);
      if (hasSiteId) {
        list = list.filter((l) => !l.siteId || l.siteId === selectedSiteId);
      }
    }
    return list;
  }, [allLocations, selectedSiteId]);

  const locationOptions = useMemo(() => {
    if (!allLocations.length) return [];
    if (!selectedSiteId) return allLocations;

    const hasSiteId = allLocations.some((l) => 'siteId' in l);
    if (!hasSiteId) return allLocations;

    return allLocations.filter((l) => !l.siteId || l.siteId === selectedSiteId);
  }, [allLocations, selectedSiteId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('El nombre es obligatorio');
    if (!form.tag.trim()) return toast.error('El código (tag) es obligatorio');

    const shouldDefaultToWarehouse =
      form.status === 'IN_STOCK' &&
      (!form.currentLocationId || form.currentLocationId === '') &&
      !!form.assignedWarehouseId;

    const payload: AssetUpdatePayload = {
      tag: form.tag || undefined,
      name: form.name,
      serial: form.serial || null,
      categoryId: form.categoryId || null,
      brand: form.brand || null,
      model: form.model || null,
      supplierName: form.supplierName || null,
      invoiceNumber: form.invoiceNumber || null,
      invimaCode: form.invimaCode || null,
      purchaseCost:
        form.purchaseCost === '' ? null : numOrNull(String(form.purchaseCost)),
      purchaseDate: form.purchaseDate || null,
      warrantyUntil: form.warrantyUntil || null,
      acquisitionType: form.acquisitionType || null,
      riskLevel: form.riskLevel || null,
      maintenanceFrequency: (form.maintenanceFrequency || null) as MaintenanceFrequency | null,
      status: form.status,
      lifeState: form.lifeState || null,
      photoUrl: form.photoUrl || null,
      notes: form.notes || null,
      siteId: form.siteId || null,
      currentLocationId: shouldDefaultToWarehouse
        ? form.assignedWarehouseId
        : form.currentLocationId || null,
      assignedWarehouseId: form.assignedWarehouseId || null,
    };

    try {
      await upd.mutateAsync(payload);
      toast.success('Activo actualizado con éxito');
      router.push(`/assets/${id}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'No se pudo actualizar el activo');
    }
  }

  if (isLoading || !form._init) return <p className="p-4">Cargando…</p>;
  if (!asset) return <p className="p-4">No encontrado.</p>;

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">Editar activo</h1>

      <form
        onSubmit={onSubmit}
        className="space-y-4 border rounded-2xl bg-white dark:bg-slate-900 p-4"
      >
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <label className="text-sm">
              Código (tag) <span className="text-rose-500">*</span>
            </label>
            <input
              value={form.tag}
              onChange={(e) => set('tag', e.target.value)}
              placeholder="ACT-0001"
              className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
            />
          </div>

          {/* 👇 CAMBIO: Selector de Categoría AHORA ESTÁ AQUÍ */}
          <div className="grid gap-1.5">
            <label className="text-sm">Categoría</label>
            <select
              value={form.categoryId}
              onChange={(e) => {
                set('categoryId', e.target.value);
                set('name', ''); // Limpiamos nombre cuando cambia la categoría
              }}
              className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
            >
              <option value="">—</option>
              {cats.data?.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* 👇 CAMBIO: Nombre del activo (Dependiente) */}
          <div className="grid gap-1.5">
            <label className="text-sm">
              Nombre del activo <span className="text-rose-500">*</span>
            </label>
            <select
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              disabled={!form.categoryId}
              className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">
                {!form.categoryId ? '← Elija categoría primero' : 'Seleccione nombre...'}
              </option>
              {availableNames.map((n: any) => (
                <option key={n.id} value={n.name}>
                  {n.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1.5">
            <label className="text-sm">Serie</label>
            <input
              value={form.serial}
              onChange={(e) => set('serial', e.target.value)}
              placeholder="SN-ABC-123"
              className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
            />
          </div>
        </div>

        {/* Sede & Bodega asignada & Ubicación actual */}
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="grid gap-1.5">
            <label className="text-sm">Sede</label>
            <select
              value={form.siteId || ''}
              onChange={(e) => {
                const newSiteId = e.target.value;
                set('siteId', newSiteId);
                // Al cambiar de sede, limpiamos bodega y ubicación
                set('assignedWarehouseId', '');
                set('currentLocationId', '');
              }}
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

          <div className="grid gap-1.5">
            <label className="text-sm">Bodega asignada</label>
            <select
              value={form.assignedWarehouseId || ''}
              onChange={(e) => set('assignedWarehouseId', e.target.value)}
              className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
            >
              <option value="">—</option>
              {warehouses.map((l: any) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500">
              Si el activo está <b>En bodega</b> y no indicas ubicación actual, se
              usará esta bodega.
            </p>
          </div>

          <div className="grid gap-1.5">
            <label className="text-sm">Ubicación actual</label>
            <select
              value={form.currentLocationId || ''}
              onChange={(e) => set('currentLocationId', e.target.value)}
              className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
            >
              <option value="">—</option>
              {locationOptions.map((l: any) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Atributos técnicos */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <label className="text-sm">Marca</label>
            <input
              value={form.brand}
              onChange={(e) => set('brand', e.target.value)}
              placeholder="Dell"
              className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
            />
          </div>
          <div className="grid gap-1.5">
            <label className="text-sm">Modelo</label>
            <input
              value={form.model}
              onChange={(e) => set('model', e.target.value)}
              placeholder="Latitude 5440"
              className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
            />
          </div>
        </div>

        {/* Proveedor / Factura / Invima */}
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="grid gap-1.5">
            <label className="text-sm">Proveedor</label>
            <input
              value={form.supplierName}
              onChange={(e) => set('supplierName', e.target.value)}
              placeholder="Acme S.A."
              className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
            />
          </div>
          <div className="grid gap-1.5">
            <label className="text-sm">Factura</label>
            <input
              value={form.invoiceNumber}
              onChange={(e) => set('invoiceNumber', e.target.value)}
              placeholder="FV-12345"
              className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
            />
          </div>
          <div className="grid gap-1.5">
            <label className="text-sm">Invima</label>
            <input
              value={form.invimaCode}
              onChange={(e) => set('invimaCode', e.target.value)}
              placeholder="INV-0000"
              className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
            />
          </div>
        </div>

        {/* Costos / Fechas */}
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="grid gap-1.5">
            <label className="text-sm">Valor (COP)</label>
            <input
              inputMode="decimal"
              value={form.purchaseCost}
              onChange={(e) => set('purchaseCost', e.target.value)}
              placeholder="2500000"
              className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
            />
          </div>
          <div className="grid gap-1.5">
            <label className="text-sm">Fecha de compra</label>
            <input
              type="date"
              value={form.purchaseDate}
              onChange={(e) => set('purchaseDate', e.target.value)}
              className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
            />
          </div>
          <div className="grid gap-1.5">
            <label className="text-sm">Garantía hasta</label>
            <input
              type="date"
              value={form.warrantyUntil}
              onChange={(e) => set('warrantyUntil', e.target.value)}
              className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
            />
          </div>
        </div>

        {/* Clasificaciones */}
        <div className="grid sm:grid-cols-4 gap-3">
          <div className="grid gap-1.5">
            <label className="text-sm">Tipo de adquisición</label>
            <select
              value={form.acquisitionType}
              onChange={(e) => set('acquisitionType', e.target.value)}
              className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
            >
              <option value="">—</option>
              {TIPOS_ADQUISICION.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1.5">
            <label className="text-sm">Nivel de riesgo</label>
            <select
              value={form.riskLevel}
              onChange={(e) => set('riskLevel', e.target.value)}
              className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
            >
              <option value="">—</option>
              {NIVELES_RIESGO.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1.5">
            <label className="text-sm">Frecuencia mantenimiento</label>
            <select
              value={form.maintenanceFrequency || 'NO_APLICA'}
              onChange={(e) => set('maintenanceFrequency', e.target.value)}
              className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
            >
              {FRECUENCIAS_MANTENIMIENTO.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1.5">
            <label className="text-sm">Estado operativo</label>
            <select
              value={form.status}
              onChange={(e) => set('status', e.target.value)}
              className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
            >
              {ESTADOS_OPERATIVOS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Estado de vida & Foto */}
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="grid gap-1.5">
            <label className="text-sm">Estado del activo</label>
            <select
              value={form.lifeState}
              onChange={(e) => set('lifeState', e.target.value)}
              className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
            >
              {ESTADOS_DE_VIDA.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1.5 sm:col-span-2">
            <label className="text-sm">Foto (URL)</label>
            <input
              value={form.photoUrl}
              onChange={(e) => set('photoUrl', e.target.value)}
              placeholder="https://tu-cdn.com/fotos/mi-activo.jpg"
              className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
            />
            {previewSrc && (
              <div className="mt-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewSrc}
                  alt="Vista previa"
                  className="h-28 w-auto rounded-lg border object-cover"
                />
              </div>
            )}
          </div>
        </div>

        {/* Notas */}
        <div className="grid gap-1.5">
          <label className="text-sm">Notas</label>
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Observaciones, mantenimientos, comentarios…"
            className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
            rows={3}
          />
        </div>

        {/* Acciones */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="text-sm px-3 py-2 rounded-lg border hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={upd.isPending}
            className="rounded-xl bg-lime-500 from-brand to-accent text-white px-4 py-2 text-sm hover:bg-sky-900 disabled:opacity-60"
          >
            {upd.isPending ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </section>
  );
}