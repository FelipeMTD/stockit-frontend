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

const Schema = z.object({
  tag: z.string().min(1, 'El código es obligatorio'),
  name: z.string().min(1, 'El nombre es obligatorio'),

  brand: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  serial: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),

  siteId: z.string().optional().nullable(),
  assignedWarehouseId: z.string().optional().nullable(),

  purchaseDate: z.string().optional().nullable(),
  purchaseCost: z.number().or(z.nan()).optional().nullable(),

  acquisitionType: z
    .enum(['PURCHASE', 'LEASE', 'DONATION', 'INTERNAL', 'OTHER'])
    .optional()
    .nullable(),
  supplierName: z.string().optional().nullable(),
  invoiceNumber: z.string().optional().nullable(),
  invimaCode: z.string().optional().nullable(),

  riskLevel: z.enum(['I', 'IIA', 'IIB', 'III', 'NO_APLICA']).optional().nullable(),
  maintenanceFrequency: z.enum(['ANUAL', 'SEMESTRAL', 'TRIMESTRAL', 'NO_APLICA']).optional().nullable(),
  warrantyUntil: z.string().optional().nullable(),
  
  lifeState: z.enum(['ACTIVE', 'INACTIVE', 'RETIRED']).optional().nullable(),

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
      maintenanceFrequency: 'NO_APLICA',
      riskLevel: null,
    },
  });

  const locItemsRaw = (locs.data as any)?.items ?? locs.data ?? [];
  const allLocations: any[] = Array.isArray(locItemsRaw) ? locItemsRaw : [];

  const selectedSiteId = watch('siteId') || '';
  const selectedCategoryId = watch('categoryId') || '';
  
  const selectedCategory = (cats.data as any[])?.find((c) => c.id === selectedCategoryId);
  const availableNames = selectedCategory?.allowedNames || [];

  const warehouses = allLocations.filter((l: any) => {
    const t = String(l?.type ?? '').toLowerCase();
    const isWarehouse = t === 'warehouse' || t.includes('bodega');
    if (!isWarehouse) return false;
    if (!selectedSiteId) return true;
    if (!('siteId' in l)) return true;
    return !l.siteId || l.siteId === selectedSiteId;
  });

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
        riskLevel: values.riskLevel || null,
        maintenanceFrequency: values.maintenanceFrequency || 'NO_APLICA',
        lifeState: values.lifeState || 'ACTIVE',
        
        purchaseDate: values.purchaseDate ? new Date(values.purchaseDate).toISOString() : null,
        warrantyUntil: values.warrantyUntil ? new Date(values.warrantyUntil).toISOString() : null,
        purchaseCost: Number.isNaN(values.purchaseCost) ? null : values.purchaseCost,
      };

      const res = await api.post('/api/assets', payload);
      toast.success('Activo guardado');
      router.push(`/assets/${res.data.id}`);
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'No se pudo guardar el activo');
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
          <Label>Categoría</Label>
          <Select
            value={selectedCategoryId}
            onValueChange={(v) => {
              setValue('categoryId', v || null, { shouldDirty: true });
              setValue('name', '', { shouldDirty: true }); 
            }}
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

        <div className="grid gap-1.5">
          <Label>Nombre del activo *</Label>
          <Select
            value={watch('name') ?? ''}
            onValueChange={(v) => setValue('name', v, { shouldDirty: true, shouldValidate: true })}
            disabled={!selectedCategoryId}
          >
            <SelectTrigger className={errors.name ? 'border-rose-500' : ''}>
              <SelectValue placeholder={!selectedCategoryId ? "← Elija categoría primero" : "Seleccione nombre..."} />
            </SelectTrigger>
            <SelectContent>
              {availableNames.map((n: any) => (
                <SelectItem key={n.id} value={n.name}>
                  {n.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          <Label>Sede</Label>
          <Select
            value={selectedSiteId}
            onValueChange={(v) => {
              setValue('siteId', v || null, { shouldDirty: true });
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