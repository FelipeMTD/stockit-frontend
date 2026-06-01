'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  Building2,
  ImageIcon,
  Loader2,
  MapPin,
  Save,
  Settings2,
  Wrench,
} from 'lucide-react';
import { toast } from 'sonner';

import { useCategories, useLocations, useSites } from '@/lib/hooks';

export type MaintenanceFrequency =
  | 'ANUAL'
  | 'SEMESTRAL'
  | 'TRIMESTRAL'
  | 'NO_APLICA';

export type AssetOperationalStatus =
  | 'IN_STOCK'
  | 'ASSIGNED'
  | 'IN_REPAIR'
  | 'LOST'
  | 'DISPOSED';

export type AssetLifeState = 'ACTIVE' | 'INACTIVE' | 'RETIRED';

export type AssetFormValue = {
  tag: string;
  name: string;
  serial: string;
  categoryId: string;
  brand: string;
  model: string;
  supplierName: string;
  invoiceNumber: string;
  invimaCode: string;
  purchaseCost: string | number;
  purchaseDate: string;
  warrantyUntil: string;
  acquisitionType: string;
  riskLevel: string;
  maintenanceFrequency: MaintenanceFrequency;
  status: AssetOperationalStatus;
  lifeState: AssetLifeState;
  photoUrl: string;
  notes: string;
  siteId: string;
  currentLocationId: string;
  assignedWarehouseId: string;
    currentCustodianName: string;
  currentCustodianDocumentId: string;
};

export type AssetFormPayload = {
  tag: string;
  name: string;
  serial: string | null;
  categoryId: string | null;
  brand: string | null;
  model: string | null;
  supplierName: string | null;
  invoiceNumber: string | null;
  invimaCode: string | null;
  purchaseCost: number | null;
  purchaseDate: string;
  warrantyUntil: string | null;
  acquisitionType: string | null;
  riskLevel: string | null;
  maintenanceFrequency: MaintenanceFrequency | null;
  status: AssetOperationalStatus;
  lifeState: AssetLifeState | null;
  photoUrl: string | null;
  notes: string | null;
  siteId: string | null;
  currentLocationId: string | null;
  assignedWarehouseId: string | null;
};

type AssetFormProps = {
  mode: 'create' | 'edit';
  initialValue?: Partial<AssetFormValue>;
  isSubmitting?: boolean;
  onSubmit: (payload: AssetFormPayload) => Promise<void> | void;
  onCancel: () => void;
};

const ESTADOS_OPERATIVOS: Array<{
  value: AssetOperationalStatus;
  label: string;
}> = [
  { value: 'IN_STOCK', label: 'En bodega' },
  { value: 'ASSIGNED', label: 'Asignado' },
  { value: 'IN_REPAIR', label: 'En reparación' },
  { value: 'LOST', label: 'Perdido' },
  { value: 'DISPOSED', label: 'De baja' },
];

const ESTADOS_DE_VIDA: Array<{
  value: AssetLifeState;
  label: string;
}> = [
  { value: 'ACTIVE', label: 'Activo' },
  { value: 'INACTIVE', label: 'Inactivo' },
  { value: 'RETIRED', label: 'Retirado' },
];

const TIPOS_ADQUISICION = [
  { value: '', label: 'Sin definir' },
  { value: 'PURCHASE', label: 'Compra' },
  { value: 'LEASE', label: 'Arrendamiento' },
  { value: 'DONATION', label: 'Donación' },
  { value: 'INTERNAL', label: 'Reposición / Interna' },
  { value: 'OTHER', label: 'Otro' },
];

const NIVELES_RIESGO = [
  { value: '', label: 'Sin definir' },
  { value: 'I', label: 'I' },
  { value: 'IIA', label: 'IIA' },
  { value: 'IIB', label: 'IIB' },
  { value: 'III', label: 'III' },
  { value: 'NO APLICA', label: 'No aplica' },
];

const FRECUENCIAS_MANTENIMIENTO: Array<{
  value: MaintenanceFrequency;
  label: string;
}> = [
  { value: 'ANUAL', label: 'Anual' },
  { value: 'SEMESTRAL', label: 'Semestral' },
  { value: 'TRIMESTRAL', label: 'Trimestral' },
  { value: 'NO_APLICA', label: 'No aplica' },
];

export function emptyAssetFormValue(): AssetFormValue {
  return {
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
        currentCustodianName: '',
    currentCustodianDocumentId: '',
  };
}

function normalizeFormValue(
  initialValue?: Partial<AssetFormValue>,
): AssetFormValue {
  return {
    ...emptyAssetFormValue(),
    ...initialValue,
    purchaseCost: initialValue?.purchaseCost ?? '',
    maintenanceFrequency: initialValue?.maintenanceFrequency ?? 'NO_APLICA',
    status: initialValue?.status ?? 'IN_STOCK',
    lifeState: initialValue?.lifeState ?? 'ACTIVE',
  };
}

function numOrNull(value: string) {
  const normalized = value.replace(/\./g, '').replace(/,/g, '.').trim();

  if (normalized === '') return null;

  const parsed = Number(normalized);

  if (Number.isNaN(parsed)) return Number.NaN;

  return parsed;
}

function normalizeAllowedNames(raw: any[]) {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item, index) => {
      if (typeof item === 'string') {
        return {
          id: `${item}-${index}`,
          name: item,
        };
      }

      return {
        id: item?.id ?? `${item?.name ?? 'item'}-${index}`,
        name: item?.name ?? '',
      };
    })
    .filter((item) => item.name);
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>

      {children}

      {hint && <p className="text-xs leading-5 text-slate-500">{hint}</p>}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  required,
  type = 'text',
  inputMode,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}) {
  return (
    <input
      type={type}
      required={required}
      value={value}
      inputMode={inputMode}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      autoComplete="off"
className="h-10 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#3C9CD1] focus:ring-4 focus:ring-[#3C9CD1]/10"    />
  );
}

function SelectInput({
  value,
  onChange,
  children,
  disabled,
  required,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
  required?: boolean;
}) {
  return (
    <select
      value={value}
      required={required}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
className="h-10 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-[#3C9CD1] focus:ring-4 focus:ring-[#3C9CD1]/10 disabled:cursor-not-allowed disabled:opacity-50"    >
      {children}
    </select>
  );
}

function ReadOnlyBox({
  value,
  placeholder = 'Sin registro',
}: {
  value?: string | null;
  placeholder?: string;
}) {
  return (
    <div className="flex min-h-10 w-full min-w-0 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">
      <span className="truncate">{value || placeholder}</span>
    </div>
  );
}

export default function AssetForm({
  mode,
  initialValue,
  isSubmitting,
  onSubmit,
  onCancel,
}: AssetFormProps) {
  const cats = useCategories();
  const locs = useLocations();
  const sites = useSites();

  const [form, setForm] = useState<AssetFormValue>(() =>
    normalizeFormValue(initialValue),
  );

  useEffect(() => {
    setForm(normalizeFormValue(initialValue));
  }, [initialValue]);

  const set = <K extends keyof AssetFormValue>(
    key: K,
    value: AssetFormValue[K],
  ) => {
    setForm((state) => ({
      ...state,
      [key]: value,
    }));
  };

  const categoryItemsRaw = (cats.data as any)?.items ?? cats.data ?? [];
  const categoryItems: any[] = Array.isArray(categoryItemsRaw)
    ? categoryItemsRaw
    : [];

  const locItemsRaw = (locs.data as any)?.items ?? locs.data ?? [];
  const allLocations: any[] = Array.isArray(locItemsRaw) ? locItemsRaw : [];

  const siteItemsRaw = (sites.data as any)?.items ?? sites.data ?? [];
  const siteItems: any[] = Array.isArray(siteItemsRaw) ? siteItemsRaw : [];

  const selectedCategory = categoryItems.find(
    (category: any) => category.id === form.categoryId,
  );

  const availableNamesRaw = normalizeAllowedNames(
    selectedCategory?.allowedNames ?? selectedCategory?.assetNames ?? [],
  );

  const currentNameExists = availableNamesRaw.some(
    (item) => item.name === form.name,
  );

  const availableNames =
    form.name && !currentNameExists
      ? [{ id: `current-${form.name}`, name: form.name }, ...availableNamesRaw]
      : availableNamesRaw;

  const selectedSiteId = form.siteId || '';

const selectedSite = siteItems.find((site: any) => site.id === form.siteId);

const selectedWarehouse = allLocations.find(
  (location: any) => location.id === form.assignedWarehouseId,
);

const selectedCurrentLocation = allLocations.find(
  (location: any) => location.id === form.currentLocationId,
);

const currentLocationLabel = (() => {
  const custodianName = form.currentCustodianName?.trim();
  const custodianDocument = form.currentCustodianDocumentId?.trim();

  if (form.status === 'ASSIGNED') {
    if (custodianName) {
      return custodianDocument
        ? `Custodio: ${custodianName} - Doc. ${custodianDocument}`
        : `Custodio: ${custodianName}`;
    }

    return 'Asignado a custodio';
  }

  if (form.currentLocationId && selectedCurrentLocation?.name) {
    return selectedCurrentLocation.name;
  }

  if (form.status === 'IN_STOCK' && selectedWarehouse?.name) {
    return selectedWarehouse.name;
  }

  return 'Sin ubicación actual registrada';
})();

  const warehouses = useMemo(() => {
    if (!allLocations.length) return [];

    const hasType = allLocations.some(
      (location) => typeof location?.type === 'string',
    );

    let list = hasType
      ? allLocations.filter(
          (location) =>
            String(location?.type || '').toLowerCase() === 'warehouse',
        )
      : allLocations;

    if (selectedSiteId) {
      const hasSiteId = list.some((location) => 'siteId' in location);

      if (hasSiteId) {
        list = list.filter(
          (location) => !location.siteId || location.siteId === selectedSiteId,
        );
      }
    }

    return list;
  }, [allLocations, selectedSiteId]);

  const locationOptions = useMemo(() => {
    if (!allLocations.length) return [];
    if (!selectedSiteId) return allLocations;

    const hasSiteId = allLocations.some((location) => 'siteId' in location);

    if (!hasSiteId) return allLocations;

    return allLocations.filter(
      (location) => !location.siteId || location.siteId === selectedSiteId,
    );
  }, [allLocations, selectedSiteId]);

  const previewSrc = useMemo(() => {
    const url = String(form.photoUrl || '').trim();

    if (!url) return '';

    return url;
  }, [form.photoUrl]);

  const isBusy =
    isSubmitting || cats.isLoading || locs.isLoading || sites.isLoading;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const tag = form.tag.trim();
    const name = form.name.trim();
    const categoryId = form.categoryId.trim();
    const purchaseDate = form.purchaseDate.trim();

    if (!tag) {
      toast.error('El código es obligatorio.');
      return;
    }

    if (!name) {
      toast.error('El nombre es obligatorio.');
      return;
    }

    if (!categoryId) {
      toast.error('La categoría es obligatoria.');
      return;
    }

    if (!purchaseDate) {
      toast.error('La fecha de compra es obligatoria.');
      return;
    }

    const purchaseCost =
      String(form.purchaseCost ?? '').trim() === ''
        ? null
        : numOrNull(String(form.purchaseCost));

    if (Number.isNaN(purchaseCost)) {
      toast.error('El valor del activo debe ser numérico.');
      return;
    }

    const shouldDefaultToWarehouse =
  mode === 'create' &&
  form.status === 'IN_STOCK' &&
  (!form.currentLocationId || form.currentLocationId === '') &&
  !!form.assignedWarehouseId;

    const payload: AssetFormPayload = {
      tag,
      name,
      serial: form.serial.trim() || null,
      categoryId: categoryId || null,
      brand: form.brand.trim() || null,
      model: form.model.trim() || null,
      supplierName: form.supplierName.trim() || null,
      invoiceNumber: form.invoiceNumber.trim() || null,
      invimaCode: form.invimaCode.trim() || null,
      purchaseCost,
      purchaseDate,
      warrantyUntil: form.warrantyUntil || null,
      acquisitionType: form.acquisitionType || null,
      riskLevel: form.riskLevel || null,
      maintenanceFrequency: form.maintenanceFrequency || null,
      status: form.status,
      lifeState: form.lifeState || null,
      photoUrl: form.photoUrl.trim() || null,
      notes: form.notes.trim() || null,
      siteId: form.siteId || null,
      currentLocationId: shouldDefaultToWarehouse
        ? form.assignedWarehouseId
        : form.currentLocationId || null,
      assignedWarehouseId: form.assignedWarehouseId || null,
    };

    await onSubmit(payload);
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid gap-0 lg:grid-cols-[1fr_330px]">
        <div className="space-y-6 p-4 sm:p-5">
          <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="mb-4 flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#3C9CD1]/10 text-[#1B3859]">
                <Boxes className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-sm font-semibold text-[#1B3859]">
                  Identificación
                </h2>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Código / Tag" required>
                <TextInput
                  value={form.tag}
                  onChange={(value) => set('tag', value)}
                  placeholder="ACT-0001"
                  required
                />
              </Field>

              <Field label="Categoría" required>
                <SelectInput
                  value={form.categoryId}
                  onChange={(value) => {
                    set('categoryId', value);
                    set('name', '');
                  }}
                  required
                >
                  <option value="">Selecciona…</option>

                  {categoryItems.map((category: any) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </SelectInput>
              </Field>

              <Field label="Nombre del activo" required>
                {availableNames.length > 0 ? (
                  <SelectInput
                    value={form.name}
                    onChange={(value) => set('name', value)}
                    disabled={!form.categoryId}
                    required
                  >
                    <option value="">
                      {!form.categoryId
                        ? 'Selecciona categoría primero'
                        : 'Selecciona nombre…'}
                    </option>

                    {availableNames.map((item) => (
                      <option key={item.id} value={item.name}>
                        {item.name}
                      </option>
                    ))}
                  </SelectInput>
                ) : (
                  <TextInput
                    value={form.name}
                    onChange={(value) => set('name', value)}
                    placeholder={
                      form.categoryId
                        ? 'Nombre del activo'
                        : 'Selecciona categoría primero'
                    }
                    required
                  />
                )}
              </Field>

              <Field label="Serial">
                <TextInput
                  value={form.serial}
                  onChange={(value) => set('serial', value)}
                  placeholder="SN-ABC-123"
                />
              </Field>
            </div>
          </section>

                              <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-4 flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#54BF5B]/10 text-[#16803A]">
                <Building2 className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-[#1B3859]">
                  {mode === 'edit'
                    ? 'Ubicación y custodia'
                    : 'Ubicación inicial y estado'}
                </h2>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {mode === 'edit'
                    ? 'La ubicación, bodega, custodio y estado operativo se actualizan mediante movimientos.'
                    : 'Define la ubicación inicial del activo al momento de crearlo.'}
                </p>
              </div>
            </div>

            {mode === 'edit' && (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                Para cambiar bodega, custodio, ubicación actual o estado
                operativo, registra un movimiento del activo. Esta pantalla solo
                permite editar datos administrativos y técnicos.
              </div>
            )}

            {mode === 'create' && (
              <div className="mb-4 rounded-2xl border border-[#3C9CD1]/20 bg-[#3C9CD1]/5 p-3 text-xs leading-5 text-slate-600">
                <p>
                  <span className="font-semibold text-[#1B3859]">
                    Bodega base / retorno:
                  </span>{' '}
                  bodega principal a la que vuelve el activo cuando se recoge.
                </p>

                <p className="mt-1">
                  <span className="font-semibold text-[#1B3859]">
                    Ubicación física actual:
                  </span>{' '}
                  úsala solo si el activo está físicamente en un lugar distinto
                  a su bodega base.
                </p>
              </div>
            )}

            <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Field label="Sede">
                {mode === 'edit' ? (
                  <ReadOnlyBox value={selectedSite?.name} placeholder="Sin sede" />
                ) : (
                  <SelectInput
                    value={form.siteId || ''}
                    onChange={(value) => {
                      set('siteId', value);
                      set('assignedWarehouseId', '');
                      set('currentLocationId', '');
                    }}
                  >
                    <option value="">Sin sede</option>

                    {siteItems.map((site: any) => (
                      <option key={site.id} value={site.id}>
                        {site.name}
                      </option>
                    ))}
                  </SelectInput>
                )}
              </Field>

              <Field label="Bodega base / retorno">
                {mode === 'edit' ? (
                  <ReadOnlyBox
                    value={selectedWarehouse?.name}
                    placeholder="Sin bodega base"
                  />
                ) : (
                  <SelectInput
                    value={form.assignedWarehouseId || ''}
                    onChange={(value) => set('assignedWarehouseId', value)}
                  >
                    <option value="">Sin bodega base</option>

                    {warehouses.map((location: any) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </SelectInput>
                )}
              </Field>

              <Field label="Ubicación actual">
                {mode === 'edit' ? (
                  <ReadOnlyBox
                    value={currentLocationLabel}
                    placeholder="Sin ubicación actual registrada"
                  />
                ) : (
                  <SelectInput
                    value={form.currentLocationId || ''}
                    onChange={(value) => set('currentLocationId', value)}
                  >
                    <option value="">Sin ubicación específica</option>

                    {locationOptions.map((location: any) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </SelectInput>
                )}
              </Field>
            </div>

            <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-2">
              <Field label="Estado operativo">
                {mode === 'edit' ? (
                  <ReadOnlyBox
                    value={
                      ESTADOS_OPERATIVOS.find(
                        (status) => status.value === form.status,
                      )?.label || form.status
                    }
                    placeholder="Sin estado operativo"
                  />
                ) : (
                  <SelectInput
                    value={form.status}
                    onChange={(value) =>
                      set('status', value as AssetOperationalStatus)
                    }
                  >
                    {ESTADOS_OPERATIVOS.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </SelectInput>
                )}
              </Field>

              <Field label="Estado del activo">
                <SelectInput
                  value={form.lifeState}
                  onChange={(value) => set('lifeState', value as AssetLifeState)}
                >
                  {ESTADOS_DE_VIDA.map((state) => (
                    <option key={state.value} value={state.value}>
                      {state.label}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-4 flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#3C9CD1]/10 text-[#1B3859]">
                <Settings2 className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-sm font-semibold text-[#1B3859]">
                  Datos técnicos y compra
                </h2>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Marca">
                <TextInput
                  value={form.brand}
                  onChange={(value) => set('brand', value)}
                  placeholder="Dell"
                />
              </Field>

              <Field label="Modelo">
                <TextInput
                  value={form.model}
                  onChange={(value) => set('model', value)}
                  placeholder="Latitude 5440"
                />
              </Field>

              <Field label="Proveedor">
                <TextInput
                  value={form.supplierName}
                  onChange={(value) => set('supplierName', value)}
                  placeholder="Proveedor"
                />
              </Field>

              <Field label="Factura">
                <TextInput
                  value={form.invoiceNumber}
                  onChange={(value) => set('invoiceNumber', value)}
                  placeholder="FV-12345"
                />
              </Field>

              <Field label="Invima">
                <TextInput
                  value={form.invimaCode}
                  onChange={(value) => set('invimaCode', value)}
                  placeholder="INV-0000"
                />
              </Field>

              <Field label="Valor">
                <TextInput
                  value={String(form.purchaseCost ?? '')}
                  onChange={(value) => set('purchaseCost', value)}
                  placeholder="2500000"
                  inputMode="decimal"
                />
              </Field>

              <Field label="Fecha de compra" required>
                <TextInput
                  type="date"
                  value={form.purchaseDate}
                  onChange={(value) => set('purchaseDate', value)}
                  required
                />
              </Field>

              <Field label="Garantía hasta">
                <TextInput
                  type="date"
                  value={form.warrantyUntil}
                  onChange={(value) => set('warrantyUntil', value)}
                />
              </Field>

              <Field label="Tipo de compra">
                <SelectInput
                  value={form.acquisitionType}
                  onChange={(value) => set('acquisitionType', value)}
                >
                  {TIPOS_ADQUISICION.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </SelectInput>
              </Field>

              <Field label="Nivel de riesgo">
                <SelectInput
                  value={form.riskLevel}
                  onChange={(value) => set('riskLevel', value)}
                >
                  {NIVELES_RIESGO.map((level) => (
                    <option key={level.value} value={level.value}>
                      {level.label}
                    </option>
                  ))}
                </SelectInput>
              </Field>

              <Field label="Frecuencia mantenimiento">
                <SelectInput
                  value={form.maintenanceFrequency || 'NO_APLICA'}
                  onChange={(value) =>
                    set('maintenanceFrequency', value as MaintenanceFrequency)
                  }
                >
                  {FRECUENCIAS_MANTENIMIENTO.map((frequency) => (
                    <option key={frequency.value} value={frequency.value}>
                      {frequency.label}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-4 flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#A7C349]/15 text-[#5D711D]">
                <ImageIcon className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-sm font-semibold text-[#1B3859]">
                  Foto y observaciones
                </h2>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-2">
                <Field label="Foto URL">
                  <TextInput
                    value={form.photoUrl}
                    onChange={(value) => set('photoUrl', value)}
                    placeholder="https://..."
                  />
                </Field>
              </div>

              {previewSrc && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewSrc}
                    alt="Vista previa"
                    className="h-28 w-full rounded-xl object-cover"
                  />
                </div>
              )}
            </div>

            <div className="mt-4">
              <Field label="Notas">
                <textarea
                  value={form.notes}
                  onChange={(event) => set('notes', event.target.value)}
                  placeholder="Observaciones, mantenimientos, comentarios…"
                  className="min-h-28 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#3C9CD1] focus:ring-4 focus:ring-[#3C9CD1]/10"
                />
              </Field>
            </div>
          </section>
        </div>

        <aside className="border-t border-slate-200 bg-slate-50/70 p-4 sm:p-5 lg:border-l lg:border-t-0">
          <div className="sticky top-36 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-[#1B3859]">
                Campos obligatorios
              </p>

              <ul className="mt-3 space-y-2 text-xs text-slate-600">
                <li>• Código / Tag</li>
                <li>• Nombre</li>
                <li>• Categoría</li>
                <li>• Fecha de compra</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#54BF5B]/10 text-[#16803A]">
                  <MapPin className="h-5 w-5" />
                </div>

                <div>
                  <p className="text-sm font-semibold text-[#1B3859]">
                    Regla de bodega
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Si el activo queda <b>En bodega</b> y no indicas ubicación
                    actual, se usará la bodega asignada.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="submit"
                disabled={isBusy}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1B3859] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#132B45] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isBusy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Guardando…
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    {mode === 'create' ? 'Crear activo' : 'Guardar cambios'}
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onCancel}
                disabled={isBusy}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancelar
              </button>
            </div>
          </div>
        </aside>
      </div>
    </form>
  );
}