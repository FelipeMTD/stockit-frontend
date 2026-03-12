'use client';

import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useCategories, useLocations, usePersons, useSites } from '@/lib/hooks';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * Normaliza enums desde inputs típicos:
 * - "NO APLICA" / "NO_APLICA" / "NA" / "N/A" => "NO_APLICA"
 */
const zRiskLevel = z.preprocess((val) => {
  if (val == null) return val;
  const raw = String(val).trim();
  if (!raw) return null;

  const up = raw.toUpperCase();
  if (up === 'NO APLICA' || up === 'NO_APLICA' || up === 'NA' || up === 'N/A') {
    return 'NO_APLICA';
  }
  return up;
}, z.enum(['I', 'IIA', 'IIB', 'III', 'NO_APLICA']));

const zMaintenanceFrequency = z.preprocess((val) => {
  if (val == null) return val;
  const raw = String(val).trim();
  if (!raw) return null;

  const up = raw.toUpperCase();
  if (up === 'NO APLICA' || up === 'NO_APLICA' || up === 'NA' || up === 'N/A') {
    return 'NO_APLICA';
  }
  return up;
}, z.enum(['ANUAL', 'SEMESTRAL', 'TRIMESTRAL', 'NO_APLICA']));

const Schema = z.object({
  tag: z.string().min(1, 'El código es obligatorio'),
  name: z.string().min(1, 'El nombre es obligatorio'),

  brand: z.string().optional(),
  model: z.string().optional(),
  serial: z.string().optional(),
  categoryId: z.string().optional().nullable(),

  siteId: z.string().optional().nullable(),
  assignedWarehouseId: z.string().optional().nullable(),

  // OJO: esto ya lo tenías así; lo dejo igual para no cambiar comportamiento
  purchaseDate: z.coerce.date().optional().nullable(),
  purchaseCost: z.coerce.number().optional().nullable(),

  acquisitionType: z
    .enum(['PURCHASE', 'LEASE', 'DONATION', 'INTERNAL', 'OTHER'])
    .optional()
    .nullable(),
  supplierName: z.string().optional(),
  invoiceNumber: z.string().optional(),
  invimaCode: z.string().optional(),

  // ✅ Ajustado a nuevo enum
  riskLevel: zRiskLevel.optional().nullable(),

  // ✅ NUEVO campo
  maintenanceFrequency: zMaintenanceFrequency.optional().nullable().default('NO_APLICA'),

  warrantyUntil: z.coerce.date().optional().nullable(),

  lifeState: z.enum(['ACTIVE', 'INACTIVE', 'RETIRED']).optional().default('ACTIVE'),

  locationId: z.string().optional().nullable(),
  custodianId: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof Schema>;

export default function AssetForm() {
  const router = useRouter();
  const cats = useCategories();
  const locs = useLocations();
  const pers = usePersons();
  const sites = useSites();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<FormValues>({
      resolver: zodResolver(Schema),
      defaultValues: {
      lifeState: 'ACTIVE',
      siteId: null,
      assignedWarehouseId: null,
      locationId: null,
      custodianId: null,

      // ✅ default razonable
      maintenanceFrequency: 'NO_APLICA',
      riskLevel: null,
    },
  });

  // Normalizamos locations (puede venir como {items} o array)
  const locItemsRaw = (locs.data as any)?.items ?? locs.data ?? [];
  const allLocations: any[] = Array.isArray(locItemsRaw) ? locItemsRaw : [];

  const selectedSiteId = watch('siteId') || '';

  // Bodegas filtradas por sede
  const warehouses = allLocations.filter((l: any) => {
    const t = String(l?.type ?? '').toLowerCase();
    const isWarehouse = t === 'warehouse' || t.includes('bodega');
    if (!isWarehouse) return false;

    if (!selectedSiteId) return true;
    if (!('siteId' in l)) return true;
    return !l.siteId || l.siteId === selectedSiteId;
  });

  // Ubicaciones filtradas por sede (para locationId)
  const locationOptions = allLocations.filter((l: any) => {
    if (!selectedSiteId) return true;
    if (!('siteId' in l)) return true;
    return !l.siteId || l.siteId === selectedSiteId;
  });

  const onSubmit = async (values: FormValues) => {
    try {
      const payload = {
        ...values,
        categoryId: values.categoryId || null,
        siteId: values.siteId || null,
        assignedWarehouseId: values.assignedWarehouseId || null,
        locationId: values.locationId || null,
        custodianId: values.custodianId || null,

        // Asegura que si viene vacío quede como null (no basura)
        riskLevel: values.riskLevel || null,
        maintenanceFrequency: values.maintenanceFrequency || 'NO_APLICA',
      };

      const res = await api.post('/api/assets', payload);
      toast.success('Activo creado');
      router.push(`/assets/${res.data.id}`);
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.log('POST /api/assets error', e?.response?.data || e);
      toast.error(e?.response?.data?.error ?? 'No se pudo crear el activo');
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 border rounded-2xl bg-white dark:bg-slate-900 p-4 shadow-sm"
    >
      <div className="grid md:grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label>Código de activo *</Label>
          <Input placeholder="ACT-0001" {...register('tag')} />
          {errors.tag && <p className="text-xs text-rose-500">{errors.tag.message}</p>}
        </div>

        <div className="grid gap-1.5">
          <Label>Nombre *</Label>
          <Input placeholder="Portátil Dell" {...register('name')} />
          {errors.name && <p className="text-xs text-rose-500">{errors.name.message}</p>}
        </div>

        <div className="grid gap-1.5">
          <Label>Marca</Label>
          <Input placeholder="Dell / HP / Lenovo" {...register('brand')} />
        </div>

        <div className="grid gap-1.5">
          <Label>Modelo</Label>
          <Input placeholder="Latitude 5420" {...register('model')} />
        </div>

        <div className="grid gap-1.5">
          <Label>Serie</Label>
          <Input placeholder="SN-ABC-123" {...register('serial')} />
        </div>

        <div className="grid gap-1.5">
          <Label>Categoría</Label>
          <Select
            value={watch('categoryId') ?? ''}
            onValueChange={(v) => setValue('categoryId', v || null, { shouldDirty: true })}
          >
            <SelectTrigger>
              <SelectValue placeholder={cats.isLoading ? 'Cargando...' : 'Selecciona categoría'} />
            </SelectTrigger>
            <SelectContent>
              {cats.data?.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Sede */}
        <div className="grid gap-1.5">
          <Label>Sede</Label>
          <Select
            value={watch('siteId') ?? ''}
            onValueChange={(v) => {
              setValue('siteId', v || null, { shouldDirty: true });
              // Al cambiar la sede, limpiamos bodega y ubicación
              setValue('assignedWarehouseId', null, { shouldDirty: true });
              setValue('locationId', null, { shouldDirty: true });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={sites.isLoading ? 'Cargando...' : 'Selecciona sede'} />
            </SelectTrigger>
            <SelectContent>
              {sites.data?.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Bodega asignada */}
        <div className="grid gap-1.5">
          <Label>Bodega asignada</Label>
          <Select
            value={watch('assignedWarehouseId') ?? ''}
            onValueChange={(v) =>
              setValue('assignedWarehouseId', v || null, { shouldDirty: true })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder={locs.isLoading ? 'Cargando...' : 'Selecciona bodega'} />
            </SelectTrigger>
            <SelectContent>
              {warehouses.map((w: any) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-slate-500">
            Cuando el activo esté disponible (IN_STOCK), su ubicación actual puede sincronizarse con esta bodega.
          </p>
        </div>

        <div className="grid gap-1.5">
          <Label>Fecha de compra</Label>
          <Input type="date" {...register('purchaseDate')} />
        </div>

        <div className="grid gap-1.5">
          <Label>Valor</Label>
          <Input
            type="number"
            step="0.01"
            placeholder="0.00"
            {...register('purchaseCost', { valueAsNumber: true })}
          />
        </div>

        <div className="grid gap-1.5">
          <Label>Tipo de adquisición</Label>
          <Select
            value={watch('acquisitionType') ?? ''}
            onValueChange={(v) =>
              setValue('acquisitionType', (v as any) || null, { shouldDirty: true })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PURCHASE">Compra</SelectItem>
              <SelectItem value="LEASE">Arrendamiento</SelectItem>
              <SelectItem value="DONATION">Donación</SelectItem>
              <SelectItem value="INTERNAL">Fabricación interna</SelectItem>
              <SelectItem value="OTHER">Otra</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label>Proveedor</Label>
          <Input placeholder="Proveedor S.A.S." {...register('supplierName')} />
        </div>

        <div className="grid gap-1.5">
          <Label>Factura</Label>
          <Input placeholder="FAC-12345" {...register('invoiceNumber')} />
        </div>

        <div className="grid gap-1.5">
          <Label>Invima</Label>
          <Input placeholder="2019DM-0012345" {...register('invimaCode')} />
        </div>

        {/* ✅ NUEVO riskLevel */}
        <div className="grid gap-1.5">
          <Label>Nivel de riesgo</Label>
          <Select
            value={watch('riskLevel') ?? ''}
            onValueChange={(v) =>
              setValue('riskLevel', (v as any) || null, { shouldDirty: true })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="I">I</SelectItem>
              <SelectItem value="IIA">IIA</SelectItem>
              <SelectItem value="IIB">IIB</SelectItem>
              <SelectItem value="III">III</SelectItem>
              <SelectItem value="NO_APLICA">No aplica</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* ✅ NUEVO maintenanceFrequency */}
        <div className="grid gap-1.5">
          <Label>Frecuencia de mantenimiento</Label>
          <Select
            value={watch('maintenanceFrequency') ?? 'NO_APLICA'}
            onValueChange={(v) =>
              setValue('maintenanceFrequency', (v as any) || 'NO_APLICA', { shouldDirty: true })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ANUAL">Anual</SelectItem>
              <SelectItem value="SEMESTRAL">Semestral</SelectItem>
              <SelectItem value="TRIMESTRAL">Trimestral</SelectItem>
              <SelectItem value="NO_APLICA">No aplica</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label>Garantía (vence)</Label>
          <Input type="date" {...register('warrantyUntil')} />
        </div>

        <div className="grid gap-1.5">
          <Label>Estado del activo</Label>
          <Select
            value={watch('lifeState') ?? 'ACTIVE'}
            onValueChange={(v) => setValue('lifeState', v as any, { shouldDirty: true })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Activo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ACTIVE">Activo</SelectItem>
              <SelectItem value="INACTIVE">Inactivo</SelectItem>
              <SelectItem value="RETIRED">Baja</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label>Ubicación inicial (opcional)</Label>
          <Select
            value={watch('locationId') ?? ''}
            onValueChange={(v) => setValue('locationId', v || null, { shouldDirty: true })}
          >
            <SelectTrigger>
              <SelectValue placeholder={locs.isLoading ? 'Cargando...' : 'Selecciona ubicación'} />
            </SelectTrigger>
            <SelectContent>
              {locationOptions.map((l: any) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-slate-500">
            Si eliges custodio, se ignora la ubicación (se asigna a la persona).
          </p>
        </div>

        <div className="grid gap-1.5">
          <Label>Persona asignada (opcional)</Label>
          <Select
            value={watch('custodianId') ?? ''}
            onValueChange={(v) => setValue('custodianId', v || null, { shouldDirty: true })}
          >
            <SelectTrigger>
              <SelectValue placeholder={pers.isLoading ? 'Cargando...' : 'Selecciona persona'} />
            </SelectTrigger>
            <SelectContent>
              {pers.data?.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          className="rounded-xl bg-lime-500 from-brand to-accent text-white px-4 py-2 text-sm hover:bg-sky-900 disabled:opacity-60"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </form>
  );
}