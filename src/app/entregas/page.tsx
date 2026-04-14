'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useEffect, useMemo, useState } from 'react';
import SignaturePad from '@/components/ui/signature-pad';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import Guard from '@/components/auth-guard';

type Person = {
  id: string;
  fullName: string;
  email: string | null;
  documentId?: string | null;
  finalStatus?: string | null;
  inactivityDate?: string | null;
  userType?: string | null;
};

type AssetStatus = 'IN_STOCK' | 'ASSIGNED' | string;

type Asset = {
  id: string;
  tag: string;
  name: string;
  status?: AssetStatus;
  currentCustodianId?: string | null;
  currentCustodian?: { id: string; fullName?: string | null } | null;
  category?: { id: string; name?: string | null } | null;
};

type AppUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  documentId?: string | null;
  role?: string | null;
};

type HandoverType = 'ENTREGA' | 'RECOGIDA';
type Relation =
  | 'HIJA' | 'HIJO' | 'MADRE' | 'PADRE' | 'SOBRINA' | 'SOBRINO' | 'HIJASTRO' | 'HIJASTRA'
  | 'HERMANO' | 'HERMANA' | 'TIA' | 'TIO' | 'COLABORADOR' | 'YERNO' | 'NIETO' | 'NIETA'
  | 'CUÑADO' | 'NUERA' | 'PRIMA' | 'PRIMO' | 'ABUELA' | 'PACIENTE' | 'ESPOSO' | 'ESPOSA'
  | 'TUTORA' | 'TUTOR' | 'CUIDADOR' | 'FAMILIAR';

const RELATIONS: Relation[] = [
  'HIJA', 'HIJO', 'MADRE', 'PADRE', 'SOBRINA', 'SOBRINO', 'HIJASTRO', 'HIJASTRA',
  'HERMANO', 'HERMANA', 'TIA', 'TIO', 'COLABORADOR', 'YERNO', 'NIETO', 'NIETA',
  'CUÑADO', 'NUERA', 'PRIMA', 'PRIMO', 'ABUELA', 'PACIENTE', 'ESPOSO', 'ESPOSA',
  'TUTORA', 'TUTOR', 'CUIDADOR', 'FAMILIAR'
];

type FormState = {
  type: HandoverType;
  personId: string;
  signerName: string;
  signerId: string;
  relation: Relation;
  email: string;
  phone: string;
  notes: string;
  signatureData: string | null;
  assetIds: string[];
  reason: string;
  homeDelivery: boolean;
  driverId?: string | null;
  scheduledDate: string;
};

const DELIVERY_REASONS = [
  'GARANTIZAR ENFERMERÍA Y CUIDADOR',
  'CAMBIO POR CORRECTIVO',
  'INGRESO COLABORADOR',
  'INVENTARIO INICIAL',
  'CAMBIO DE ACTIVO',
  'ORDENAMIENTO MEDICO',
  'HABILITACIÓN SEDE',
  'SOLICITA COORDINACIÓN',
] as const;

const PICKUP_REASONS = [
  'FALLECIDO',
  'EGRESO BARTHEL',
  'SALIDA DE COLABORADOR',
  'EGRESO ADMINISTRATIVO',
  'DESISTIMIENTO DE ACTIVO',
  'CAMBIO POR CORRECTIVO',
  'NO PERTINENCIA',
  'BAJA DEL ACTIVO',
] as const;

function SimplePicker<T extends { id: string; fullName?: string | null; email?: string | null }>(props: {
  items: T[];
  value?: string | null;
  onChange: (id: string) => void;
  disabled?: boolean;
  placeholder?: string;
  subtitleOf?: (it: T) => string | null | undefined;
}) {
  const { items, value, onChange, disabled, placeholder = '— Seleccionar —', subtitleOf } = props;
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (open) setFilter('');
  }, [open]);

  const selected = useMemo(() => items.find((p) => p.id === value) || null, [items, value]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return items;
    return items.filter((p: any) => {
      const name = (p.fullName || '').toLowerCase();
      const mail = (p.email || '').toLowerCase();
      const doc = (p.documentId || '').toLowerCase();
      return name.includes(q) || mail.includes(q) || doc.includes(q);
    });
  }, [items, filter]);

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((s) => !s)}
        className="w-full rounded-xl border px-3 py-2 text-left text-sm bg-white dark:bg-slate-950 disabled:opacity-60 focus:border-sky-600 outline-none"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected ? (selected.fullName || (selected as any).email || '—') : placeholder}
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-xl border bg-white dark:bg-slate-950 shadow-xl">
          <div className="p-2 border-b">
            <input
              autoFocus
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Buscar…"
              className="w-full rounded-lg border px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 outline-none focus:border-sky-600"
            />
          </div>

          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 && <div className="p-3 text-xs text-slate-500">Sin resultados.</div>}
            <ul role="listbox">
              {filtered.map((p: any) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => { onChange(p.id); setOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 ${p.id === value ? 'bg-sky-50 dark:bg-slate-800' : ''}`}
                  >
                    <div className="font-medium truncate">{p.fullName || p.email || '—'}</div>
                    {subtitleOf && <div className="text-[10px] text-slate-500 truncate mt-0.5 font-bold uppercase">{subtitleOf(p) || '—'}</div>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="p-2 border-t flex justify-end bg-slate-50 rounded-b-xl">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border bg-white px-4 py-1.5 text-xs font-bold shadow-sm hover:bg-slate-100">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}

const UserPicker = (props: { people: Person; value?: string; onChange: (id: string) => void; disabled?: boolean; placeholder?: string; } | any) => (
  <SimplePicker
    items={props.people as any}
    value={props.value}
    onChange={props.onChange}
    disabled={props.disabled}
    placeholder={props.placeholder}
    subtitleOf={(p: any) => [p.documentId || '', p.userType || ''].filter(Boolean).join(' - ') || null}
  />
);

const DriverPicker = (props: { drivers: Array<{ id: string; name?: string | null; fullName?: string | null; email?: string | null; documentId?: string | null }>; value?: string | null; onChange: (id: string) => void; disabled?: boolean; placeholder?: string; }) => {
  const items = (props.drivers || []).map((u) => {
    const baseName = (u.name && u.name.trim()) || (u.fullName && u.fullName.trim()) || (u.email && u.email.trim()) || '';
    return { ...u, fullName: [baseName || ''].filter(Boolean).join(' - ') };
  }) as any[];

  return <SimplePicker items={items} value={props.value ?? undefined} onChange={props.onChange} disabled={props.disabled} placeholder={props.placeholder ?? '— Seleccionar conductor —'} subtitleOf={(u: any) => u.email || null} />;
};

type PageSizeOption = 10 | 50 | 100 | 'ALL';

export default function HandoverPage() {
  const qc = useQueryClient();
  const router = useRouter();

  // ESTADO PARA PESTAÑAS (TABS)
  const [activeTab, setActiveTab] = useState<'NEW' | 'HISTORY'>('NEW');
  const [selectedHandover, setSelectedHandover] = useState<any | null>(null);

  const [form, setForm] = useState<FormState>({
    type: 'ENTREGA',
    personId: '',
    signerName: '',
    signerId: '',
    relation: 'PACIENTE',
    email: '',
    phone: '',
    notes: '',
    signatureData: null,
    assetIds: [],
    reason: '',
    homeDelivery: false,
    driverId: null,
    scheduledDate: '',
  });

  const [assetQ, setAssetQ] = useState('');
  const [pageSize, setPageSize] = useState<PageSizeOption>(10);
  const [page, setPage] = useState(1);
  const [showOnlySelected, setShowOnlySelected] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(Date.now());

  // QUERIES
  const peopleQ = useQuery({ queryKey: ['catalog-persons-for-picker'], queryFn: async () => (await api.get<{ items: Person[] }>('/api/catalog/persons', { params: { pageSize: 5000 } })).data.items ?? [] });
  const driversQ = useQuery({ queryKey: ['drivers'], queryFn: async () => (await api.get<{ items: AppUser[] }>('/api/users/drivers')).data.items ?? [] });
  const allAssets = useQuery({ queryKey: ['assets-mini'], queryFn: async () => (await api.get<{ items: Asset[] }>('/api/assets', { params: { pageSize: 10000 } })).data.items ?? [] });
  
  // Query para el Historial
  const handoversQ = useQuery({ 
    queryKey: ['handovers-history'], 
    queryFn: async () => (await api.get<{ items: any[] }>('/api/handover', { params: { pageSize: 100 } })).data.items ?? [] 
  });

  const visiblePeople = useMemo(() => {
    const arr = peopleQ.data ?? [];
    if (form.type !== 'ENTREGA') return arr;
    return arr.filter((p) => !p.inactivityDate && !(p.finalStatus || '').toLowerCase().includes('inactiv'));
  }, [peopleQ.data, form.type]);

  const hasCustodian = (a: Asset) => Boolean(a.currentCustodianId) || Boolean(a.currentCustodian?.id);
  const custodianIdOf = (a: Asset) => a.currentCustodianId ?? a.currentCustodian?.id ?? null;
  const isInStock = (a: Asset) => (a.status || '').toUpperCase() === 'IN_STOCK' || !hasCustodian(a);

  const reasonOptions = useMemo(() => (form.type === 'ENTREGA' ? [...DELIVERY_REASONS] : [...PICKUP_REASONS]), [form.type]);

  const baseVisibleAssets = useMemo(() => {
    const arr = allAssets.data ?? [];
    if (form.type === 'ENTREGA') return arr.filter(isInStock);
    if (!form.personId) return [];
    return arr.filter((a) => custodianIdOf(a) === form.personId);
  }, [allAssets.data, form.type, form.personId]);

  const visibleAssets = useMemo(() => {
    let source = baseVisibleAssets;
    if (showOnlySelected && form.assetIds.length > 0) {
      const idsSet = new Set(form.assetIds);
      source = source.filter((a) => idsSet.has(a.id));
    }
    const q = assetQ.trim().toLowerCase();
    if (!q) return source;
    return source.filter((a) => {
      const name = (a.name || '').toLowerCase();
      const tag = (a.tag || '').toLowerCase();
      const cat = (a.category?.name || '').toLowerCase();
      return name.includes(q) || tag.includes(q) || (!!cat && cat.includes(q));
    });
  }, [baseVisibleAssets, assetQ, showOnlySelected, form.assetIds]);

  useEffect(() => { setForm((f) => ({ ...f, assetIds: [], reason: '' })); }, [form.type, form.personId]);
  useEffect(() => { setShowOnlySelected(false); }, [form.type, form.personId]);
  useEffect(() => {
    if (form.homeDelivery) {
      setForm((f) => ({ ...f, signerName: '', signerId: '', relation: 'PACIENTE', email: '', phone: '', notes: '', signatureData: null }));
    }
  }, [form.homeDelivery]);
  useEffect(() => { setPage(1); }, [assetQ, form.type, form.personId, pageSize, showOnlySelected]);

  const paginatedAssets = useMemo(() => {
    if (pageSize === 'ALL') return visibleAssets;
    const start = (page - 1) * pageSize;
    return visibleAssets.slice(start, start + pageSize);
  }, [visibleAssets, page, pageSize]);

  const toggleAsset = (id: string) => {
    setForm((f) => ({ ...f, assetIds: f.assetIds.includes(id) ? f.assetIds.filter((x) => x !== id) : [...f.assetIds, id] }));
  };

  function buildPayload(f: FormState) {
    const base: any = {
      type: f.type,
      signerName: f.homeDelivery ? null : f.signerName.trim() || null,
      signerId: f.homeDelivery ? null : f.signerId.trim() || null,
      relation: f.homeDelivery ? null : f.relation,
      email: f.homeDelivery ? null : f.email?.trim() || null,
      phone: f.homeDelivery ? null : f.phone?.trim() || null,
      notes: f.homeDelivery ? null : f.notes?.trim() || null,
      signatureData: f.homeDelivery ? null : f.signatureData || null,
      reason: (f.reason || '').trim() || null,
      homeDelivery: !!f.homeDelivery,
      driverId: f.homeDelivery ? f.driverId || null : null,
      scheduledDate: f.type === 'ENTREGA' && f.homeDelivery && f.scheduledDate ? f.scheduledDate : null,
      items: (f.assetIds || []).map((assetId) => ({ assetId, quantity: 1 })),
    };
    return f.type === 'ENTREGA' ? { ...base, personId: f.personId } : base;
  }

  const create = useMutation({
    mutationFn: async (vars: { formState: FormState; fileToUpload: File | null }) => {
      const { formState, fileToUpload } = vars;

      if (!formState.assetIds.length) throw new Error('Selecciona al menos un equipo');
      const allowedValues = (formState.type === 'ENTREGA' ? DELIVERY_REASONS : PICKUP_REASONS) as readonly string[];
      if (!formState.reason || !allowedValues.includes(formState.reason)) {
        throw new Error(`Selecciona un motivo válido para ${formState.type === 'ENTREGA' ? 'ENTREGA' : 'RECOGIDA'}`);
      }
      if (formState.type === 'ENTREGA' && !formState.personId) throw new Error('Selecciona el usuario (custodio) para la entrega');
      if (formState.type === 'RECOGIDA' && formState.personId && baseVisibleAssets.length === 0) throw new Error('Ese usuario no tiene equipos asignados.');
      if (formState.homeDelivery && !formState.driverId) throw new Error('Selecciona el conductor para la ruta a domicilio');
      if (formState.type === 'ENTREGA' && formState.homeDelivery && !formState.scheduledDate) throw new Error('Selecciona la fecha programada de la ruta a domicilio');

      if (!formState.homeDelivery) {
        if (!formState.signerName.trim()) throw new Error('Falta el nombre de quien firma');
        if (!formState.signerId.trim()) throw new Error('Falta la identificación de quien firma');
        if (!formState.relation) throw new Error('Selecciona el parentesco/relación');
        if (!formState.signatureData) throw new Error('La firma en pantalla es obligatoria');
      }

      const payload = buildPayload(formState);
      const formData = new FormData();
      
      Object.entries(payload).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          if (typeof value === 'object') formData.append(key, JSON.stringify(value));
          else formData.append(key, String(value));
        }
      });

      if (fileToUpload) {
        formData.append('attachment', fileToUpload);
      }

      const { data } = await api.post('/api/handover', formData);
      return data;
    },
    onSuccess: (resp, vars) => {
      toast.success(vars.formState.type === 'ENTREGA' ? 'Entrega registrada exitosamente' : 'Recogida registrada exitosamente');

      if (vars.formState.homeDelivery) {
        const routeCode = resp?.routeCode ?? resp?.route?.code ?? null;
        toast.info(routeCode ? `Ruta creada: ${routeCode}` : 'También se creó una ruta programada.', {
          action: { label: 'Ver rutas', onClick: () => router.push('/routes') },
          duration: 6000,
        });
      }

      setForm({
        type: 'ENTREGA', personId: '', signerName: '', signerId: '', relation: 'PACIENTE',
        email: '', phone: '', notes: '', signatureData: null, assetIds: [], reason: '',
        homeDelivery: false, driverId: null, scheduledDate: '',
      });
      setShowOnlySelected(false);
      setAttachment(null);
      setFileKey(Date.now()); 

      qc.invalidateQueries({ queryKey: ['assets-mini'] });
      qc.invalidateQueries({ queryKey: ['routes'] });
      qc.invalidateQueries({ queryKey: ['handovers-history'] });
      setActiveTab('HISTORY');
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.error || e?.response?.data?.details?.message || 'No se pudo registrar.');
    },
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await create.mutateAsync({ formState: form, fileToUpload: attachment });
  };

  return (
    <Guard>
      <section className="space-y-6 font-poppins mx-auto max-w-7xl pb-20">
        
        {/* ENCABEZADO Y TABS */}
        <div className="border-b border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Gestión Logística</h1>
          </div>
          <div className="flex gap-6">
            <button 
              onClick={() => setActiveTab('NEW')} 
              className={`pb-3 text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'NEW' ? 'border-b-4 border-sky-600 text-sky-700' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Nuevo Registro
            </button>
            <button 
              onClick={() => setActiveTab('HISTORY')} 
              className={`pb-3 text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'HISTORY' ? 'border-b-4 border-sky-600 text-sky-700' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Historial de Trámites
            </button>
          </div>
        </div>

        {/* PESTAÑA 1: NUEVO REGISTRO */}
        {activeTab === 'NEW' && (
          <form onSubmit={submit} className="grid gap-6 lg:grid-cols-2">
            
            {/* COLUMNA IZQUIERDA: DATOS GENERALES */}
            <div className="border rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-sm space-y-5">
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b pb-2">1. Datos del Trámite</h2>

              <div className="grid gap-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Tipo de Movimiento</label>
                <select className="rounded-xl border px-3 py-3 text-sm bg-slate-50 dark:bg-slate-950 font-bold text-slate-800 outline-none focus:border-sky-600" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as HandoverType })}>
                  <option value="ENTREGA">ENTREGA DE EQUIPO</option>
                  <option value="RECOGIDA">RECOGIDA DE EQUIPO</option>
                </select>
              </div>

              <div className="grid gap-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Paciente / Custodio</label>
                <UserPicker people={visiblePeople} value={form.personId} onChange={(id: string) => setForm({ ...form, personId: id })} disabled={peopleQ.isLoading} placeholder={peopleQ.isLoading ? 'Cargando…' : '— Seleccionar Paciente —'} />
              </div>

              <div className="grid gap-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Motivo / Razón</label>
                <select className="rounded-xl border px-3 py-3 text-sm bg-white dark:bg-slate-950 outline-none focus:border-sky-600" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}>
                  <option value="">— Seleccionar Motivo —</option>
                  {reasonOptions.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div className="p-4 bg-sky-50 border border-sky-100 rounded-xl space-y-3">
                <div className="flex items-center gap-3">
                  <input id="homeDelivery" type="checkbox" className="h-5 w-5 rounded text-sky-600 focus:ring-sky-600" checked={form.homeDelivery} onChange={(e) => setForm({ ...form, homeDelivery: e.target.checked })} />
                  <label htmlFor="homeDelivery" className="text-sm font-bold text-sky-900 cursor-pointer select-none">Gestionar a través de Ruta (Transporte)</label>
                </div>
                {form.homeDelivery && <p className="text-[10px] text-sky-700 ml-8 leading-relaxed">El inventario y la firma del paciente se procesarán cuando el conductor finalice la ruta en terreno.</p>}
              </div>

              {form.homeDelivery && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-l-4 border-sky-200 pl-4 py-2">
                  <div className="grid gap-1.5">
                    <label className="text-[10px] font-bold text-sky-700 uppercase">Conductor Asignado</label>
                    <DriverPicker drivers={driversQ.data ?? []} value={form.driverId ?? null} onChange={(id: string) => setForm({ ...form, driverId: id })} disabled={driversQ.isLoading} placeholder={driversQ.isLoading ? 'Cargando…' : 'Seleccionar...'} />
                  </div>
                  {form.type === 'ENTREGA' && (
                    <div className="grid gap-1.5">
                      <label className="text-[10px] font-bold text-sky-700 uppercase">Fecha Programada</label>
                      <input type="date" className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950 outline-none focus:border-sky-600" value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} />
                    </div>
                  )}
                </div>
              )}

              {!form.homeDelivery && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Información de Recepción Físico</h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input 
                      className="rounded-xl border px-3 py-3 text-sm bg-slate-50 focus:border-sky-600 outline-none uppercase font-bold" 
                      placeholder="Nombre de quien recibe" 
                      value={form.signerName} 
                      onChange={(e) => setForm({ ...form, signerName: e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '') })} 
                    />
                    <input 
                      inputMode="numeric"
                      className="rounded-xl border px-3 py-3 text-sm bg-slate-50 focus:border-sky-600 outline-none" 
                      placeholder="N° de Cédula" 
                      value={form.signerId} 
                      onChange={(e) => setForm({ ...form, signerId: e.target.value.replace(/\D/g, '') })} 
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <select className="rounded-xl border px-3 py-3 text-sm bg-slate-50 focus:border-sky-600 outline-none" value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value as Relation })}>
                      {RELATIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <input className="rounded-xl border px-3 py-3 text-sm bg-slate-50 focus:border-sky-600 outline-none" placeholder="Teléfono" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })} />
                  </div>

                  <input type="email" className="w-full rounded-xl border px-3 py-3 text-sm bg-slate-50 focus:border-sky-600 outline-none" placeholder="Correo electrónico (Opcional)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  <textarea className="w-full rounded-xl border px-3 py-3 text-sm bg-slate-50 focus:border-sky-600 outline-none" placeholder="Observaciones adicionales..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />

                  <div className="grid gap-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Documento Soporte Adicional (Opcional)</label>
                    <input key={fileKey} type="file" onChange={(e) => setAttachment(e.target.files?.[0] || null)} className="rounded-xl border px-3 py-2 text-xs bg-white file:mr-3 file:rounded-lg file:border-0 file:bg-slate-200 file:px-3 file:py-1.5 file:text-xs file:font-bold hover:file:bg-slate-300 cursor-pointer" accept=".pdf,image/*" />
                  </div>

                  <div className="grid gap-1.5 pt-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex justify-between">
                      Firma de Conformidad
                      {form.signatureData && <button type="button" onClick={() => setForm({ ...form, signatureData: null })} className="text-rose-500 underline">Borrar</button>}
                    </label>
                    <div className="border-2 border-dashed border-slate-300 rounded-xl overflow-hidden bg-white shadow-inner">
                      <SignaturePad value={form.signatureData} onChange={(v) => setForm({ ...form, signatureData: v })} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* COLUMNA DERECHA: SELECCIÓN DE EQUIPOS */}
            <div className="border rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col">
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b pb-2 mb-4">2. Selección de Equipos</h2>
              
              <div className="flex gap-2 mb-4">
                <input value={assetQ} onChange={(e) => setAssetQ(e.target.value)} placeholder="Buscar por Nombre, Tag o Categoría..." className="flex-1 rounded-xl border px-4 py-2 text-sm bg-slate-50 outline-none focus:border-sky-600" />
                <label className="flex items-center gap-2 bg-slate-100 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 cursor-pointer">
                  <input type="checkbox" className="h-4 w-4 rounded" checked={showOnlySelected} onChange={(e) => setShowOnlySelected(e.target.checked)} disabled={form.assetIds.length === 0} />
                  <span>Filtrar Elegidos</span>
                </label>
              </div>

              <div className="flex-1 overflow-y-auto border rounded-xl shadow-inner bg-slate-50/50 min-h-[300px]">
                {paginatedAssets.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-400 font-medium">No se encontraron equipos disponibles.</div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {paginatedAssets.map((a) => {
                      const checked = form.assetIds.includes(a.id);
                      const computedStatus = (a.status || '').toUpperCase() || (hasCustodian(a) ? 'ASSIGNED' : 'IN_STOCK');
                      return (
                        <li key={a.id} onClick={() => toggleAsset(a.id)} className={`p-4 flex items-center justify-between cursor-pointer transition-colors hover:bg-white ${checked ? 'bg-sky-50/50' : ''}`}>
                          <div>
                            <div className={`font-bold text-sm ${checked ? 'text-sky-900' : 'text-slate-700'}`}>{a.tag} <span className="text-[10px] uppercase ml-1 font-medium text-slate-500">• {a.name}</span></div>
                            <div className="text-[10px] font-black tracking-widest mt-1 text-slate-400 uppercase">{computedStatus.replace('_', ' ')}</div>
                          </div>
                          <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${checked ? 'bg-sky-600 border-sky-600 text-white' : 'bg-white border-slate-300'}`}>
                            {checked && '✓'}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="mt-6">
                <button type="submit" disabled={create.isPending} className="w-full rounded-xl bg-slate-900 text-white py-4 text-sm font-black uppercase tracking-[0.2em] shadow-xl hover:bg-black transition-all active:scale-95 disabled:opacity-50">
                  {create.isPending ? 'Procesando...' : 'Confirmar Registro'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* PESTAÑA 2: HISTORIAL DE TRÁMITES RESPONSIVE */}
        {activeTab === 'HISTORY' && (
          <div className="animate-in fade-in duration-300">
            {handoversQ.isLoading ? (
              <div className="p-10 text-center font-bold text-slate-400 uppercase tracking-widest animate-pulse">Cargando Historial...</div>
            ) : (handoversQ.data || []).length === 0 ? (
              <div className="p-10 text-center text-slate-500 border rounded-xl bg-slate-50">No hay trámites registrados aún.</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {(handoversQ.data || []).map((h: any) => (
                  <div key={h.id} className="border border-slate-200 rounded-2xl p-5 bg-white shadow-sm flex flex-col gap-3 transition-shadow hover:shadow-md">
                    <div className="flex justify-between items-center border-b pb-3">
                      <span className={`text-[9px] font-black uppercase px-2 py-1 rounded tracking-widest border ${h.type === 'ENTREGA' ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                        {h.type}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">{new Date(h.createdAt).toLocaleDateString('es-CO')}</span>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Paciente</p>
                      <p className="font-bold text-sm text-slate-800 uppercase truncate" title={h.person?.fullName}>{h.person?.fullName || '—'}</p>
                    </div>
                    <div className="flex justify-between items-end mt-2">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">{h.items?.length || 0} Equipos</p>
                      <button onClick={() => setSelectedHandover(h)} className="text-[10px] font-black text-sky-600 bg-sky-50 px-3 py-1.5 rounded-lg hover:bg-sky-100 uppercase tracking-widest border border-sky-100 transition-colors">
                        Ver Detalles
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MODAL DE DETALLES DEL TRÁMITE COMPLETAMENTE RESPONSIVE */}
        {selectedHandover && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden">
              
              <div className="p-4 sm:p-5 border-b flex justify-between items-center bg-slate-50">
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-800 uppercase tracking-tight">Detalle de Gestión</h2>
                  <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 tracking-widest uppercase mt-1">Registrado el: {new Date(selectedHandover.createdAt).toLocaleString('es-CO')}</p>
                </div>
                <button onClick={() => setSelectedHandover(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 font-bold">✕</button>
              </div>

              <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 sm:space-y-6">
                
                {/* Responsive Grid para info base */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tipo de Movimiento</p>
                    <p className={`text-sm font-black uppercase ${selectedHandover.type === 'ENTREGA' ? 'text-sky-700' : 'text-emerald-700'}`}>{selectedHandover.type}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Autor de Gestión</p>
                    <p className="text-sm font-bold text-slate-700 uppercase truncate">{selectedHandover.createdBy?.name || 'Sistema'}</p>
                  </div>
                </div>

                {/* Info Paciente */}
                <div className="border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3 shadow-sm">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">Información del Paciente</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    <p className="font-bold text-slate-800 uppercase sm:col-span-2">{selectedHandover.person?.fullName || '—'}</p>
                    <p className="text-slate-600 font-medium text-xs">Doc: {selectedHandover.person?.documentId || '—'}</p>
                    <p className="text-slate-600 font-medium text-xs truncate" title={selectedHandover.person?.email || ''}>Email: {selectedHandover.person?.email || '—'}</p>
                  </div>
                </div>

                {/* Inventario */}
                <div className="border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3 shadow-sm">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">Inventario Procesado</h3>
                  <ul className="divide-y">
                    {(selectedHandover.items || []).map((it: any) => (
                      <li key={it.id} className="py-2 flex justify-between items-center gap-2">
                        <span className="font-bold text-sm text-slate-700 uppercase leading-tight">
                          {it.asset?.tag} <span className="font-medium text-slate-400 text-[10px] block sm:inline sm:ml-1">• {it.asset?.name}</span>
                        </span>
                        <span className="text-[10px] font-black bg-slate-100 text-slate-600 px-2 py-1 rounded whitespace-nowrap">Cant: {it.quantity}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Firma Responsiva */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">Validación y Firma</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Receptor Físico</p>
                      <p className="font-bold text-slate-800 uppercase">{selectedHandover.signerName || '—'}</p>
                      <p className="text-xs text-slate-500 font-medium uppercase mt-0.5">{selectedHandover.relation || '—'} • Doc: {selectedHandover.signerId || '—'}</p>
                    </div>
                    <div>
                       <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Trazo de Conformidad</p>
                       {/* ✅ CORRECCIÓN SEGURA: Se verifica que exista antes de usar startsWith */}
                       {selectedHandover.signatureData?.startsWith('data:image') ? (
                         <img src={selectedHandover.signatureData} alt="Firma" className="h-16 border rounded bg-white p-1 object-contain" />
                       ) : (
                         <p className="text-[10px] font-bold italic text-slate-400 uppercase">{selectedHandover.signatureData || 'No disponible'}</p>
                       )}
                    </div>
                  </div>
                  {selectedHandover.notes && (
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Notas Adicionales</p>
                      <p className="text-xs text-slate-600 italic">{selectedHandover.notes}</p>
                    </div>
                  )}
                  {selectedHandover.attachmentPath && (
                     <div className="mt-3 pt-3 border-t border-slate-200 flex justify-end">
                       <a href={selectedHandover.attachmentPath} target="_blank" className="text-[10px] font-black text-sky-600 bg-sky-50 border border-sky-200 px-4 py-2 rounded-lg uppercase tracking-widest hover:bg-sky-100 transition-colors">
                         Ver Soporte Adjunto
                       </a>
                     </div>
                  )}
                </div>

              </div>
              
              <div className="p-4 border-t bg-slate-50 flex justify-end">
                <button onClick={() => setSelectedHandover(null)} className="w-full sm:w-auto px-6 py-3 sm:py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg hover:bg-slate-800 transition-colors">
                  Cerrar Detalles
                </button>
              </div>
            </div>
          </div>
        )}

      </section>
    </Guard>
  );
}