'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import Guard from '@/components/auth-guard';
import SignaturePad from '@/components/ui/signature-pad';
import { PageShell } from '@/components/common/page-shell';
import { SectionCard } from '@/components/common/section-card';
import { api } from '@/lib/api';
import { normalizeRole, type AppRole } from '@/lib/roles';

type Person = {
  id: string;
  fullName: string;
  email: string | null;
  phone?: string | null;
  documentId?: string | null;
  finalStatus?: string | null;
  inactivityDate?: string | null;
  userType?: string | null;
  type?: string | null;
};

type Asset = {
  id: string;
  tag: string;
  name: string;
  status?: string | null;
  currentCustodianId?: string | null;
  currentCustodian?: {
    id: string;
    fullName?: string | null;
  } | null;
  category?: {
    id: string;
    name?: string | null;
  } | null;
};

type AppUser = {
  id: string;
  name?: string | null;
  fullName?: string | null;
  email?: string | null;
  documentId?: string | null;
  role?: string | null;
};

type HandoverItem = {
  id: string;
  quantity: number;
  asset?: Asset | null;
};

type HandoverType = 'ENTREGA' | 'RECOGIDA';

type Handover = {
  id: string;
  type: HandoverType;
  createdAt: string;
  signerName?: string | null;
  signerId?: string | null;
  relation?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  reason?: string | null;
  signatureData?: string | null;

  attachmentPath?: string | null;
  attachmentName?: string | null;
  attachmentMime?: string | null;

  comodatoPath?: string | null;
  comodatoUrl?: string | null;
  comodatoDownloadUrl?: string | null;
  attachmentUrl?: string | null;
  attachmentDownloadUrl?: string | null;

  person?: Person | null;
  items?: HandoverItem[];
  createdBy?: {
    id: string;
    name?: string | null;
    email?: string | null;
  } | null;
};

type PreviewFile = {
  url: string;
  name: string;
  isImage: boolean;
  objectUrl?: boolean;
};

type Relation =
  | 'HIJA'
  | 'HIJO'
  | 'MADRE'
  | 'PADRE'
  | 'SOBRINA'
  | 'SOBRINO'
  | 'HIJASTRO'
  | 'HIJASTRA'
  | 'HERMANO'
  | 'HERMANA'
  | 'TIA'
  | 'TIO'
  | 'COLABORADOR'
  | 'YERNO'
  | 'NIETO'
  | 'NIETA'
  | 'CUÑADO'
  | 'NUERA'
  | 'PRIMA'
  | 'PRIMO'
  | 'ABUELA'
  | 'PACIENTE'
  | 'ESPOSO'
  | 'ESPOSA'
  | 'TUTORA'
  | 'TUTOR'
  | 'CUIDADOR'
  | 'FAMILIAR';

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
  driverId: string | null;
  scheduledDate: string;
};

type PageSizeOption = 10 | 50 | 100 | 'ALL';
type HistoryPageSizeOption = 6 | 12 | 24 | 'ALL';

const RELATIONS: Relation[] = [
  'HIJA',
  'HIJO',
  'MADRE',
  'PADRE',
  'SOBRINA',
  'SOBRINO',
  'HIJASTRO',
  'HIJASTRA',
  'HERMANO',
  'HERMANA',
  'TIA',
  'TIO',
  'COLABORADOR',
  'YERNO',
  'NIETO',
  'NIETA',
  'CUÑADO',
  'NUERA',
  'PRIMA',
  'PRIMO',
  'ABUELA',
  'PACIENTE',
  'ESPOSO',
  'ESPOSA',
  'TUTORA',
  'TUTOR',
  'CUIDADOR',
  'FAMILIAR',
];

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

function getApiBase() {
  const raw =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    'http://localhost:4000';

  return raw.replace(/\/+$/, '');
}

function getStoredRole(): AppRole | null {
  if (typeof window === 'undefined') return null;

  return normalizeRole(localStorage.getItem('user_role'));
}

function canUseHandoverRole(role: AppRole | null) {
  return (
    role === 'SUPER_ADMIN' ||
    role === 'ACTIVOS_FIJOS' ||
    role === 'INVENTARIO'
  );
}

function emptyForm(): FormState {
  return {
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
  };
}

function normalizeFinalStatus(value?: string | null) {
  const normalized = String(value || '').trim().toUpperCase();

  if (
    normalized === 'INACTIVO' ||
    normalized === 'INACTIVE' ||
    normalized === '0' ||
    normalized.includes('INACT')
  ) {
    return 'INACTIVO';
  }

  return 'ACTIVO';
}

function isActivePerson(person: Person) {
  if (person.inactivityDate) return false;

  return normalizeFinalStatus(person.finalStatus) === 'ACTIVO';
}

function assetSearchMatch(asset: Asset, q: string) {
  const term = q.trim().toLowerCase();

  if (!term) return true;

  return (
    String(asset.tag || '').toLowerCase().includes(term) ||
    String(asset.name || '').toLowerCase().includes(term) ||
    String(asset.category?.name || '').toLowerCase().includes(term)
  );
}

function handoverSearchMatch(handover: Handover, q: string) {
  const term = q.trim().toLowerCase();

  if (!term) return true;

  const personName = String(handover.person?.fullName || '').toLowerCase();
  const personDoc = String(handover.person?.documentId || '').toLowerCase();
  const reason = String(handover.reason || '').toLowerCase();
  const type = String(handover.type || '').toLowerCase();
  const signerName = String(handover.signerName || '').toLowerCase();
  const signerId = String(handover.signerId || '').toLowerCase();

  const assetsText = (handover.items || [])
    .map((item) =>
      [
        item.asset?.tag || '',
        item.asset?.name || '',
        item.asset?.category?.name || '',
      ]
        .join(' ')
        .toLowerCase(),
    )
    .join(' ');

  return (
    personName.includes(term) ||
    personDoc.includes(term) ||
    reason.includes(term) ||
    type.includes(term) ||
    signerName.includes(term) ||
    signerId.includes(term) ||
    assetsText.includes(term)
  );
}

function getSecureUrl(rawPath: string) {
  if (!rawPath) return '';

  let clean = rawPath;

  if (clean.startsWith('http')) {
    try {
      clean = new URL(clean).pathname;
    } catch {
      // Conserva el valor original.
    }
  }

  const uploadIndex = clean.indexOf('/uploads/');

  if (uploadIndex !== -1) {
    clean = clean.substring(uploadIndex);
  }

  return encodeURI(`${getApiBase()}/${clean.replace(/^\/+/, '')}`);
}

function toAbsoluteApiUrl(url?: string | null) {
  if (!url) return '';

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  return `${getApiBase()}${url.startsWith('/') ? url : `/${url}`}`;
}

function getHandoverComodatoUrl(handover?: Handover | null) {
  if (!handover) return null;

  if (handover.comodatoUrl) {
    return handover.comodatoUrl;
  }

  return `/api/handover/${handover.id}/comodato?inline=1`;
}

function getHandoverComodatoDownloadUrl(handover?: Handover | null) {
  if (!handover) return null;

  if (handover.comodatoDownloadUrl) {
    return handover.comodatoDownloadUrl;
  }

  return `/api/handover/${handover.id}/comodato`;
}

function getHandoverAttachmentUrl(handover?: Handover | null) {
  if (!handover) return null;

  if (handover.attachmentUrl) {
    return handover.attachmentUrl;
  }

  if (handover.attachmentPath) {
    return `/api/handover/${handover.id}/attachment?inline=1`;
  }

  return null;
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleString('es-CO');
}

function Field({
  label,
  children,
  hint,
  required,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>

      {children}

      {hint && <p className="text-xs leading-5 text-slate-500">{hint}</p>}
    </div>
  );
}

const inputClassName =
  'h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#3C9CD1] focus:ring-4 focus:ring-[#3C9CD1]/10';

const selectClassName =
  'h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-[#3C9CD1] focus:ring-4 focus:ring-[#3C9CD1]/10';

const textAreaClassName =
  'min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#3C9CD1] focus:ring-4 focus:ring-[#3C9CD1]/10';

function SimplePicker<
  T extends {
    id: string;
    fullName?: string | null;
    email?: string | null;
    documentId?: string | null;
  },
>(props: {
  items: T[];
  value?: string | null;
  onChange: (id: string) => void;
  disabled?: boolean;
  placeholder?: string;
  subtitleOf?: (item: T) => string | null | undefined;
}) {
  const {
    items,
    value,
    onChange,
    disabled,
    placeholder = 'Seleccionar…',
    subtitleOf,
  } = props;

  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (open) setFilter('');
  }, [open]);

  const selected = useMemo(
    () => items.find((item) => item.id === value) || null,
    [items, value],
  );

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();

    if (!q) return items;

    return items.filter((item) => {
      const name = String(item.fullName || '').toLowerCase();
      const email = String(item.email || '').toLowerCase();
      const doc = String(item.documentId || '').toLowerCase();

      return name.includes(q) || email.includes(q) || doc.includes(q);
    });
  }, [items, filter]);

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((state) => !state)}
        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-left text-sm text-slate-800 shadow-sm outline-none transition hover:bg-slate-50 focus:border-[#3C9CD1] focus:ring-4 focus:ring-[#3C9CD1]/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="block truncate">
          {selected ? selected.fullName || selected.email || '—' : placeholder}
        </span>
      </button>

      {open && (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-200 p-2">
            <input
              autoFocus
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Buscar…"
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none transition focus:border-[#3C9CD1] focus:ring-4 focus:ring-[#3C9CD1]/10"
            />
          </div>

          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 && (
              <div className="p-4 text-sm text-slate-500">Sin resultados.</div>
            )}

            <ul className="divide-y divide-slate-100">
              {filtered.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(item.id);
                      setOpen(false);
                    }}
                    className={[
                      'w-full px-3 py-2.5 text-left text-sm transition hover:bg-slate-50',
                      item.id === value ? 'bg-[#3C9CD1]/10' : '',
                    ].join(' ')}
                  >
                    <div className="truncate font-semibold text-[#111827]">
                      {item.fullName || item.email || '—'}
                    </div>

                    {subtitleOf && (
                      <div className="mt-0.5 truncate text-xs text-slate-500">
                        {subtitleOf(item) || '—'}
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex justify-end border-t border-slate-200 bg-slate-50 p-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-8 items-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function UserPicker(props: {
  people: Person[];
  value?: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <SimplePicker
      items={props.people}
      value={props.value}
      onChange={props.onChange}
      disabled={props.disabled}
      placeholder={props.placeholder}
      subtitleOf={(person) =>
        [person.documentId || '', person.userType || person.type || '']
          .filter(Boolean)
          .join(' - ') || null
      }
    />
  );
}

function DriverPicker(props: {
  drivers: AppUser[];
  value?: string | null;
  onChange: (id: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const items = (props.drivers || []).map((user) => {
    const baseName =
      user.name?.trim() ||
      user.fullName?.trim() ||
      user.email?.trim() ||
      '';

    return {
      ...user,
      fullName: baseName,
    };
  });

  return (
    <SimplePicker
      items={items}
      value={props.value ?? undefined}
      onChange={props.onChange}
      disabled={props.disabled}
      placeholder={props.placeholder ?? 'Seleccionar conductor'}
      subtitleOf={(user) => user.email || null}
    />
  );
}

export default function HandoverPage() {
  const qc = useQueryClient();
  const router = useRouter();

  const [role, setRole] = useState<AppRole | null>(null);
  const [roleReady, setRoleReady] = useState(false);

  const [activeTab, setActiveTab] = useState<'NEW' | 'HISTORY'>('NEW');
  const [selectedHandover, setSelectedHandover] =
    useState<Handover | null>(null);
  const [previewFile, setPreviewFile] = useState<PreviewFile | null>(null);

  const [historyQ, setHistoryQ] = useState('');
  const [historyType, setHistoryType] = useState<'ALL' | HandoverType>('ALL');
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] =
    useState<HistoryPageSizeOption>(6);

  const [form, setForm] = useState<FormState>(emptyForm());
  const [assetQ, setAssetQ] = useState('');
  const [pageSize, setPageSize] = useState<PageSizeOption>(10);
  const [page, setPage] = useState(1);
  const [showOnlySelected, setShowOnlySelected] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(Date.now());

  useEffect(() => {
    setRole(getStoredRole());
    setRoleReady(true);
  }, []);

  const canUseHandover = canUseHandoverRole(role);

  useEffect(() => {
    if (!roleReady) return;

    if (!canUseHandover) {
      router.replace('/assets');
    }
  }, [roleReady, canUseHandover, router]);

  const peopleQ = useQuery<Person[]>({
    queryKey: ['catalog-persons-for-picker'],
    enabled: roleReady && canUseHandover,
    queryFn: async (): Promise<Person[]> => {
      const res = await api.get<{ items: Person[] }>('/api/catalog/persons', {
        params: {
          pageSize: 5000,
        },
      });

      return res.data.items ?? [];
    },
  });

  const driversQ = useQuery<AppUser[]>({
    queryKey: ['drivers-for-handover'],
    enabled: roleReady && canUseHandover,
    queryFn: async (): Promise<AppUser[]> => {
      const res = await api.get<{ items: AppUser[] }>('/api/users/drivers');

      return res.data.items ?? [];
    },
  });

  const availableAssetsQ = useQuery<Asset[]>({
    queryKey: ['handover-available-assets'],
    enabled: roleReady && canUseHandover && form.type === 'ENTREGA',
    queryFn: async (): Promise<Asset[]> => {
      const res = await api.get<{ items: Asset[] }>(
        '/api/handover/available-assets',
        {
          params: {
            pageSize: 5000,
          },
        },
      );

      return res.data.items ?? [];
    },
  });

  const assignedAssetsQ = useQuery<Asset[]>({
    queryKey: ['handover-assets-by-person', form.personId],
    enabled:
      roleReady &&
      canUseHandover &&
      form.type === 'RECOGIDA' &&
      Boolean(form.personId),
    queryFn: async (): Promise<Asset[]> => {
      const res = await api.get<{ items: Asset[] }>(
        `/api/handover/assets-by-person/${form.personId}`,
      );

      return res.data.items ?? [];
    },
  });

  const handoversQ = useQuery<Handover[]>({
    queryKey: ['handovers-history'],
    enabled: roleReady && canUseHandover,
    queryFn: async (): Promise<Handover[]> => {
      const res = await api.get<{ items: Handover[] }>('/api/handover', {
        params: {
          pageSize: 500,
        },
      });

      return res.data.items ?? [];
    },
  });

  const handovers = handoversQ.data ?? [];

  const filteredHandovers = useMemo(() => {
    let source = handovers;

    if (historyType !== 'ALL') {
      source = source.filter((handover) => handover.type === historyType);
    }

    source = source.filter((handover) =>
      handoverSearchMatch(handover, historyQ),
    );

    return source;
  }, [handovers, historyType, historyQ]);

  const historyTotal = handovers.length;

  const historyEntregaTotal = handovers.filter(
    (handover) => handover.type === 'ENTREGA',
  ).length;

  const historyRecogidaTotal = handovers.filter(
    (handover) => handover.type === 'RECOGIDA',
  ).length;

  const historyTotalPages =
    historyPageSize === 'ALL'
      ? 1
      : Math.max(1, Math.ceil(filteredHandovers.length / historyPageSize));

  const paginatedHandovers = useMemo(() => {
    if (historyPageSize === 'ALL') return filteredHandovers;

    const start = (historyPage - 1) * historyPageSize;

    return filteredHandovers.slice(start, start + historyPageSize);
  }, [filteredHandovers, historyPage, historyPageSize]);

  const historyStart =
    filteredHandovers.length === 0
      ? 0
      : historyPageSize === 'ALL'
        ? 1
        : (historyPage - 1) * historyPageSize + 1;

  const historyEnd =
    filteredHandovers.length === 0
      ? 0
      : historyPageSize === 'ALL'
        ? filteredHandovers.length
        : Math.min(filteredHandovers.length, historyPage * historyPageSize);

  const visiblePeople = useMemo(() => {
    const arr = peopleQ.data ?? [];

    if (form.type !== 'ENTREGA') return arr;

    return arr.filter(isActivePerson);
  }, [peopleQ.data, form.type]);

  const reasonOptions = useMemo(() => {
    return form.type === 'ENTREGA'
      ? [...DELIVERY_REASONS]
      : [...PICKUP_REASONS];
  }, [form.type]);

  const baseVisibleAssets = useMemo(() => {
    if (form.type === 'ENTREGA') {
      return availableAssetsQ.data ?? [];
    }

    if (!form.personId) {
      return [];
    }

    return assignedAssetsQ.data ?? [];
  }, [availableAssetsQ.data, assignedAssetsQ.data, form.type, form.personId]);

  const visibleAssets = useMemo(() => {
    let source = baseVisibleAssets;

    if (showOnlySelected && form.assetIds.length > 0) {
      const selected = new Set(form.assetIds);
      source = source.filter((asset) => selected.has(asset.id));
    }

    source = source.filter((asset) => assetSearchMatch(asset, assetQ));

    return source;
  }, [baseVisibleAssets, assetQ, showOnlySelected, form.assetIds]);

  const totalPages =
    pageSize === 'ALL'
      ? 1
      : Math.max(1, Math.ceil(visibleAssets.length / pageSize));

  const paginatedAssets = useMemo(() => {
    if (pageSize === 'ALL') return visibleAssets;

    const start = (page - 1) * pageSize;

    return visibleAssets.slice(start, start + pageSize);
  }, [visibleAssets, page, pageSize]);

  const selectedAssets = useMemo(() => {
    const selected = new Set(form.assetIds);

    return baseVisibleAssets.filter((asset) => selected.has(asset.id));
  }, [baseVisibleAssets, form.assetIds]);

  useEffect(() => {
    setShowOnlySelected(false);
    setPage(1);
  }, [form.type, form.personId]);

  useEffect(() => {
    setPage(1);
  }, [assetQ, pageSize, showOnlySelected]);

  useEffect(() => {
    setHistoryPage(1);
  }, [historyQ, historyType, historyPageSize]);

  useEffect(() => {
    if (historyPage > historyTotalPages) {
      setHistoryPage(historyTotalPages);
    }
  }, [historyPage, historyTotalPages]);

  useEffect(() => {
    if (!form.homeDelivery) return;

    setForm((state) => ({
      ...state,
      signerName: '',
      signerId: '',
      relation: 'PACIENTE',
      email: '',
      phone: '',
      notes: '',
      signatureData: null,
    }));
  }, [form.homeDelivery]);

  function handleTypeChange(nextType: HandoverType) {
    setForm({
      ...emptyForm(),
      type: nextType,
    });

    setAssetQ('');
    setShowOnlySelected(false);
    setPage(1);
  }

  function toggleAsset(id: string) {
    setForm((state) => ({
      ...state,
      assetIds: state.assetIds.includes(id)
        ? state.assetIds.filter((item) => item !== id)
        : [...state.assetIds, id],
    }));
  }

  function buildPayload(state: FormState) {
    const base = {
      type: state.type,
      signerName: state.homeDelivery ? null : state.signerName.trim() || null,
      signerId: state.homeDelivery ? null : state.signerId.trim() || null,
      relation: state.homeDelivery ? null : state.relation,
      email: state.homeDelivery ? null : state.email.trim() || null,
      phone: state.homeDelivery ? null : state.phone.trim() || null,
      notes: state.homeDelivery ? null : state.notes.trim() || null,
      signatureData: state.homeDelivery ? null : state.signatureData || null,
      reason: state.reason.trim() || null,
      homeDelivery: state.homeDelivery,
      driverId: state.homeDelivery ? state.driverId || null : null,
      scheduledDate:
        state.homeDelivery && state.scheduledDate
          ? state.scheduledDate
          : null,
      personId: state.personId,
      items: state.assetIds.map((assetId) => ({
        assetId,
        quantity: 1,
      })),
    };

    return base;
  }

  const create = useMutation({
    mutationFn: async (vars: {
      formState: FormState;
      fileToUpload: File | null;
    }) => {
      if (!canUseHandover) {
        throw new Error(
          'No tienes permisos para gestionar entregas y recogidas.',
        );
      }

      const { formState, fileToUpload } = vars;

      if (!formState.assetIds.length) {
        throw new Error('Selecciona al menos un equipo.');
      }

      const allowedValues =
        formState.type === 'ENTREGA' ? DELIVERY_REASONS : PICKUP_REASONS;

      if (
        !formState.reason ||
        !allowedValues.includes(formState.reason as any)
      ) {
        throw new Error(
          `Selecciona un motivo válido para ${
            formState.type === 'ENTREGA' ? 'ENTREGA' : 'RECOGIDA'
          }.`,
        );
      }

      if (formState.type === 'ENTREGA' && !formState.personId) {
        throw new Error('Selecciona el usuario/custodio para la entrega.');
      }

      if (formState.type === 'RECOGIDA' && !formState.personId) {
        throw new Error('Selecciona el usuario/custodio para la recogida.');
      }

      if (formState.type === 'RECOGIDA' && baseVisibleAssets.length === 0) {
        throw new Error('Ese usuario no tiene equipos asignados.');
      }

      if (formState.homeDelivery && !formState.driverId) {
        throw new Error('Selecciona el conductor para la ruta a domicilio.');
      }

      if (formState.homeDelivery && !formState.scheduledDate) {
        throw new Error(
          'Selecciona la fecha programada de la ruta a domicilio.',
        );
      }

      if (!formState.homeDelivery) {
        if (!formState.signerName.trim()) {
          throw new Error('Falta el nombre de quien firma.');
        }

        if (!formState.signerId.trim()) {
          throw new Error('Falta la identificación de quien firma.');
        }

        if (!formState.relation) {
          throw new Error('Selecciona el parentesco/relación.');
        }

        if (!formState.email.trim()) {
          throw new Error('Falta el correo electrónico.');
        }

        if (!formState.phone.trim()) {
          throw new Error('Falta el teléfono.');
        }

        if (!formState.signatureData) {
          throw new Error('La firma en pantalla es obligatoria.');
        }
      }

      const payload = buildPayload(formState);
      const formData = new FormData();

      Object.entries(payload).forEach(([key, value]) => {
        if (value === null || typeof value === 'undefined') return;

        if (typeof value === 'object') {
          formData.append(key, JSON.stringify(value));
          return;
        }

        formData.append(key, String(value));
      });

      if (fileToUpload) {
        formData.append('attachment', fileToUpload);
      }

      const res = await api.post('/api/handover', formData);

      return res.data;
    },
    onSuccess: (_resp, vars) => {
      toast.success(
        vars.formState.type === 'ENTREGA'
          ? 'Entrega registrada exitosamente.'
          : 'Recogida registrada exitosamente.',
      );

      if (vars.formState.homeDelivery) {
        toast.info('También se creó una ruta programada.', {
          action: {
            label: 'Ver rutas',
            onClick: () => router.push('/routes'),
          },
          duration: 6000,
        });
      }

      setForm(emptyForm());
      setShowOnlySelected(false);
      setAssetQ('');
      setAttachment(null);
      setFileKey(Date.now());
      setActiveTab('HISTORY');

      qc.invalidateQueries({
        queryKey: ['handover-available-assets'],
      });
      qc.invalidateQueries({
        queryKey: ['handover-assets-by-person'],
      });
      qc.invalidateQueries({
        queryKey: ['handovers-history'],
      });
      qc.invalidateQueries({
        queryKey: ['routes'],
      });
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.error ||
          error?.response?.data?.details?.message ||
          error?.message ||
          'No se pudo registrar.',
      );
    },
  });

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    await create.mutateAsync({
      formState: form,
      fileToUpload: attachment,
    });
  }

  const handlePreviewApiFile = async (url: string, name: string) => {
    try {
      if (previewFile?.objectUrl) {
        window.URL.revokeObjectURL(previewFile.url);
      }

      const res = await api.get(url, {
        responseType: 'blob',
      });

      const mime = res.headers?.['content-type'] || 'application/pdf';

      const blob = new Blob([res.data], {
        type: mime,
      });

      const objectUrl = window.URL.createObjectURL(blob);

      setPreviewFile({
        url: objectUrl,
        name,
        isImage: mime.startsWith('image/'),
        objectUrl: true,
      });
    } catch (error: any) {
      console.error('Error abriendo archivo del trámite:', error?.response ?? error);

      toast.error(
        error?.response?.data?.error ||
          error?.message ||
          'No se pudo abrir el archivo.',
      );
    }
  };

  const handleClosePreview = () => {
    if (previewFile?.objectUrl) {
      window.URL.revokeObjectURL(previewFile.url);
    }

    setPreviewFile(null);
  };

  if (!roleReady) {
    return (
      <Guard>
        <PageShell>
          <SectionCard>
            <p className="text-sm text-slate-500">Verificando permisos…</p>
          </SectionCard>
        </PageShell>
      </Guard>
    );
  }

  if (!canUseHandover) {
    return (
      <Guard>
        <PageShell>
          <SectionCard>
            <p className="text-sm text-slate-600">
              No tienes permisos para gestionar entregas y recogidas.
            </p>
          </SectionCard>
        </PageShell>
      </Guard>
    );
  }

  return (
    <Guard>
      <PageShell>
        <SectionCard
          title="Entregas y recogidas"
          contentClassName="p-0"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('NEW')}
                className={[
                  'inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold transition',
                  activeTab === 'NEW'
                    ? 'bg-[#1B3859] text-white shadow-sm hover:bg-[#132B45]'
                    : 'border border-slate-200 bg-white text-[#1B3859] hover:bg-slate-50',
                ].join(' ')}
              >
                Nuevo registro
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('HISTORY')}
                className={[
                  'inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold transition',
                  activeTab === 'HISTORY'
                    ? 'bg-[#1B3859] text-white shadow-sm hover:bg-[#132B45]'
                    : 'border border-slate-200 bg-white text-[#1B3859] hover:bg-slate-50',
                ].join(' ')}
              >
                Historial
              </button>
            </div>
          }
        >
          <div className="p-4 sm:p-5">
            {activeTab === 'NEW' && (
              <form onSubmit={submit} className="grid gap-6 xl:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="mb-5 border-b border-slate-200 pb-4">
                    <h2 className="text-sm font-semibold text-[#1B3859]">
                      Datos del trámite
                    </h2>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Define el tipo de movimiento, custodio, motivo y datos de
                      recepción.
                    </p>
                  </div>

                  <div className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Tipo de movimiento" required>
                        <select
                          className={selectClassName}
                          value={form.type}
                          onChange={(event) =>
                            handleTypeChange(event.target.value as HandoverType)
                          }
                        >
                          <option value="ENTREGA">Entrega de equipo</option>
                          <option value="RECOGIDA">Recogida de equipo</option>
                        </select>
                      </Field>

                      <Field label="Usuario / custodio" required>
                        <UserPicker
                          people={visiblePeople}
                          value={form.personId}
                          onChange={(id) =>
                            setForm((state) => ({
                              ...state,
                              personId: id,
                              assetIds: [],
                            }))
                          }
                          placeholder={
                            form.type === 'ENTREGA'
                              ? 'Seleccione usuario que recibirá'
                              : 'Seleccione usuario para recoger equipos'
                          }
                        />
                      </Field>
                    </div>

                    <Field label="Motivo" required>
                      <select
                        className={selectClassName}
                        value={form.reason}
                        onChange={(event) =>
                          setForm((state) => ({
                            ...state,
                            reason: event.target.value,
                          }))
                        }
                      >
                        <option value="">Seleccione motivo…</option>

                        {reasonOptions.map((reason) => (
                          <option key={reason} value={reason}>
                            {reason}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <div
                      className={[
                        'rounded-2xl border p-4 transition',
                        form.homeDelivery
                          ? 'border-[#3C9CD1]/30 bg-[#3C9CD1]/10'
                          : 'border-slate-200 bg-slate-50',
                      ].join(' ')}
                    >
                      <label
                        htmlFor="homeDelivery"
                        className="flex cursor-pointer items-start gap-3"
                      >
                        <input
                          id="homeDelivery"
                          type="checkbox"
                          className="mt-0.5 h-5 w-5 rounded border-slate-300 accent-[#1B3859]"
                          checked={form.homeDelivery}
                          onChange={(event) =>
                            setForm((state) => ({
                              ...state,
                              homeDelivery: event.target.checked,
                            }))
                          }
                        />

                        <span>
                          <span className="block text-sm font-semibold text-[#1B3859]">
                            Gestionar a través de ruta / transporte
                          </span>

                          <span className="mt-1 block text-xs leading-5 text-slate-500">
                            El inventario y la firma del paciente se procesarán
                            cuando el conductor finalice la ruta en terreno.
                          </span>
                        </span>
                      </label>
                    </div>

                    {form.homeDelivery && (
                      <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-2">
                        <Field label="Conductor" required>
                          <DriverPicker
                            drivers={driversQ.data ?? []}
                            value={form.driverId}
                            onChange={(id) =>
                              setForm((state) => ({
                                ...state,
                                driverId: id,
                              }))
                            }
                          />
                        </Field>

                        <Field label="Fecha programada" required>
                          <input
                            required
                            type="date"
                            className={inputClassName}
                            value={form.scheduledDate}
                            onChange={(event) =>
                              setForm((state) => ({
                                ...state,
                                scheduledDate: event.target.value,
                              }))
                            }
                          />
                        </Field>
                      </div>
                    )}

                    {!form.homeDelivery && (
                      <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                        <div>
                          <h3 className="text-sm font-semibold text-[#1B3859]">
                            Información de recepción física
                          </h3>

                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            Datos de la persona que recibe o entrega físicamente
                            el equipo.
                          </p>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <Field label="Nombre de quien firma" required>
                            <input
                              required
                              className={inputClassName}
                              placeholder="Nombre de quien recibe"
                              value={form.signerName}
                              onChange={(event) =>
                                setForm((state) => ({
                                  ...state,
                                  signerName: event.target.value.replace(
                                    /[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g,
                                    '',
                                  ),
                                }))
                              }
                            />
                          </Field>

                          <Field label="Identificación" required>
                            <input
                              required
                              inputMode="numeric"
                              className={inputClassName}
                              placeholder="N° de cédula"
                              value={form.signerId}
                              onChange={(event) =>
                                setForm((state) => ({
                                  ...state,
                                  signerId: event.target.value.replace(/\D/g, ''),
                                }))
                              }
                            />
                          </Field>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <Field label="Relación / parentesco" required>
                            <select
                              required
                              className={selectClassName}
                              value={form.relation}
                              onChange={(event) =>
                                setForm((state) => ({
                                  ...state,
                                  relation: event.target.value as Relation,
                                }))
                              }
                            >
                              {RELATIONS.map((relation) => (
                                <option key={relation} value={relation}>
                                  {relation}
                                </option>
                              ))}
                            </select>
                          </Field>

                          <Field label="Teléfono" required>
                            <input
                              required
                              inputMode="numeric"
                              className={inputClassName}
                              placeholder="Teléfono"
                              value={form.phone}
                              onChange={(event) =>
                                setForm((state) => ({
                                  ...state,
                                  phone: event.target.value.replace(/\D/g, ''),
                                }))
                              }
                            />
                          </Field>
                        </div>

                        <Field label="Correo electrónico" required>
                          <input
                            required
                            type="email"
                            className={inputClassName}
                            placeholder="Correo electrónico"
                            value={form.email}
                            onChange={(event) =>
                              setForm((state) => ({
                                ...state,
                                email: event.target.value,
                              }))
                            }
                          />
                        </Field>

                        <Field label="Observaciones adicionales">
                          <textarea
                            className={textAreaClassName}
                            placeholder="Observaciones adicionales…"
                            value={form.notes}
                            onChange={(event) =>
                              setForm((state) => ({
                                ...state,
                                notes: event.target.value,
                              }))
                            }
                            rows={2}
                          />
                        </Field>

                        <Field label="Documento soporte adicional">
                          <input
                            key={fileKey}
                            type="file"
                            onChange={(event) =>
                              setAttachment(event.target.files?.[0] || null)
                            }
                            className="block w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-600 hover:file:bg-slate-200"
                            accept=".pdf,image/jpeg,image/png,image/webp"
                          />
                        </Field>

                        <div className="grid gap-1.5 pt-2">
                          <div className="flex items-center justify-between gap-3">
                            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                              Firma de conformidad
                              <span className="ml-1 text-red-500">*</span>
                            </label>

                            {form.signatureData && (
                              <button
                                type="button"
                                onClick={() =>
                                  setForm((state) => ({
                                    ...state,
                                    signatureData: null,
                                  }))
                                }
                                className="text-xs font-semibold text-red-600 transition hover:text-red-700"
                              >
                                Borrar firma
                              </button>
                            )}
                          </div>

                          <div className="overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-white shadow-inner">
                            <SignaturePad
                              value={form.signatureData}
                              onChange={(value) =>
                                setForm((state) => ({
                                  ...state,
                                  signatureData: value,
                                }))
                              }
                              height={220}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="mb-5 flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
                    <div>
                      <h2 className="text-sm font-semibold text-[#1B3859]">
                        Selección de equipos
                        <span className="ml-1 text-red-500">*</span>
                      </h2>

                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Busca y selecciona los equipos que harán parte de la
                        entrega o recogida.
                      </p>
                    </div>

                    <span className="inline-flex h-8 items-center rounded-full bg-slate-100 px-3 text-xs font-semibold text-slate-600">
                      {form.assetIds.length} seleccionado
                      {form.assetIds.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-1 gap-2 2xl:grid-cols-[minmax(0,1fr)_auto_auto] 2xl:items-center">
                      <input
                        value={assetQ}
                        onChange={(event) => setAssetQ(event.target.value)}
                        placeholder="Buscar por nombre, código/tag o categoría…"
                        className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#3C9CD1] focus:ring-4 focus:ring-[#3C9CD1]/10"
                      />

                      <label
                        className={[
                          'inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-medium transition',
                          showOnlySelected
                            ? 'border-[#3C9CD1]/30 bg-[#3C9CD1]/10 text-[#1B3859]'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                          form.assetIds.length === 0
                            ? 'cursor-not-allowed opacity-60'
                            : '',
                        ].join(' ')}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 accent-[#1B3859]"
                          checked={showOnlySelected}
                          onChange={(event) =>
                            setShowOnlySelected(event.target.checked)
                          }
                          disabled={form.assetIds.length === 0}
                        />

                        <span>Ver seleccionados</span>
                      </label>

                      <div className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-xs text-slate-500 shadow-sm">
                        <span>Mostrar</span>

                        <select
                          className="h-8 rounded-xl border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 outline-none focus:border-[#3C9CD1] focus:ring-2 focus:ring-[#3C9CD1]/10"
                          value={pageSize === 'ALL' ? 'ALL' : String(pageSize)}
                          onChange={(event) => {
                            const value = event.target.value;

                            setPageSize(
                              value === 'ALL'
                                ? 'ALL'
                                : (Number(value) as PageSizeOption),
                            );
                          }}
                        >
                          <option value="10">10</option>
                          <option value="50">50</option>
                          <option value="100">100</option>
                          <option value="ALL">Todos</option>
                        </select>

                        <span>por página</span>
                      </div>
                    </div>

                    {form.assetIds.length > 0 && (
                      <div className="rounded-2xl border border-[#54BF5B]/30 bg-[#54BF5B]/10 px-3 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-[#1B3859]">
                            Equipos seleccionados: {form.assetIds.length}
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              setForm((state) => ({
                                ...state,
                                assetIds: [],
                              }))
                            }
                            className="ml-auto rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                          >
                            Limpiar selección
                          </button>
                        </div>

                        {selectedAssets.length > 0 && (
                          <div className="mt-3 flex max-h-32 flex-wrap gap-2 overflow-y-auto">
                            {selectedAssets.map((asset) => (
                              <button
                                key={asset.id}
                                type="button"
                                onClick={() => toggleAsset(asset.id)}
                                className="inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                              >
                                <span className="truncate">
                                  <b className="text-[#1B3859]">{asset.tag}</b>{' '}
                                  — {asset.name}
                                </span>
                                <span className="text-slate-400">×</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="min-h-[360px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70">
                      {(availableAssetsQ.isLoading ||
                        assignedAssetsQ.isLoading) && (
                        <div className="flex min-h-[320px] items-center justify-center text-sm text-slate-500">
                          Cargando equipos…
                        </div>
                      )}

                      {!availableAssetsQ.isLoading &&
                        !assignedAssetsQ.isLoading &&
                        paginatedAssets.length === 0 && (
                          <div className="flex min-h-[320px] flex-col items-center justify-center px-4 text-center">
                            <p className="text-sm font-semibold text-slate-700">
                              No se encontraron equipos
                            </p>

                            <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
                              Ajusta la búsqueda, cambia el usuario/custodio o
                              revisa si el movimiento corresponde a entrega o
                              recogida.
                            </p>
                          </div>
                        )}

                      {paginatedAssets.length > 0 && (
                        <ul className="divide-y divide-slate-100">
                          {paginatedAssets.map((asset) => {
                            const checked = form.assetIds.includes(asset.id);

                            return (
                              <li key={asset.id}>
                                <button
                                  type="button"
                                  onClick={() => toggleAsset(asset.id)}
                                  className={[
                                    'flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition',
                                    checked
                                      ? 'bg-[#54BF5B]/10 hover:bg-[#54BF5B]/15'
                                      : 'bg-white hover:bg-slate-50',
                                  ].join(' ')}
                                >
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span
                                        className="truncate text-sm font-bold text-[#111827]"
                                        title={asset.tag}
                                      >
                                        {asset.tag}
                                      </span>

                                      {asset.category?.name && (
                                        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                                          {asset.category.name}
                                        </span>
                                      )}
                                    </div>

                                    <p
                                      className="mt-1 truncate text-sm font-medium text-slate-700"
                                      title={asset.name}
                                    >
                                      {asset.name}
                                    </p>

                                    {asset.currentCustodian?.fullName && (
                                      <p className="mt-1 truncate text-xs text-slate-500">
                                        Custodio actual:{' '}
                                        <b className="font-semibold text-slate-700">
                                          {asset.currentCustodian.fullName}
                                        </b>
                                      </p>
                                    )}
                                  </div>

                                  <span
                                    className={[
                                      'grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-bold',
                                      checked
                                        ? 'border-[#54BF5B] bg-[#54BF5B] text-white'
                                        : 'border-slate-300 bg-white text-slate-400',
                                    ].join(' ')}
                                  >
                                    {checked ? '✓' : '+'}
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>

                    <div className="flex flex-col gap-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                      <span>
                        {visibleAssets.length === 0
                          ? 'Sin equipos para mostrar.'
                          : pageSize === 'ALL'
                            ? `Mostrando ${visibleAssets.length} equipo${
                                visibleAssets.length === 1 ? '' : 's'
                              }`
                            : `Página ${page} de ${totalPages} · ${
                                visibleAssets.length
                              } resultado${
                                visibleAssets.length === 1 ? '' : 's'
                              }`}
                      </span>

                      {pageSize !== 'ALL' && totalPages > 1 && (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setPage((current) => Math.max(1, current - 1))
                            }
                            disabled={page <= 1}
                            className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Anterior
                          </button>

                          <span className="rounded-xl bg-white px-3 py-2 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                            {page} / {totalPages}
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              setPage((current) =>
                                Math.min(totalPages, current + 1),
                              )
                            }
                            disabled={page >= totalPages}
                            className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Siguiente
                          </button>
                        </div>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={create.isPending}
                      className="mt-3 inline-flex h-12 w-full items-center justify-center rounded-xl bg-[#1B3859] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#132B45] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {create.isPending
                        ? 'Procesando…'
                        : 'Confirmar registro'}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {activeTab === 'HISTORY' && (
              <div className="space-y-5">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                      <h2 className="text-sm font-semibold text-[#1B3859]">
                        Historial de trámites
                      </h2>

                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Consulta entregas y recogidas registradas en el sistema.
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2">
                        <p className="font-semibold text-slate-500">Total</p>
                        <p className="mt-1 text-base font-bold text-[#111827]">
                          {historyTotal}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-[#3C9CD1]/30 bg-[#3C9CD1]/10 px-4 py-2">
                        <p className="font-semibold text-[#1B3859]">
                          Entregas
                        </p>
                        <p className="mt-1 text-base font-bold text-[#1B3859]">
                          {historyEntregaTotal}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-[#54BF5B]/30 bg-[#54BF5B]/10 px-4 py-2">
                        <p className="font-semibold text-[#16803A]">
                          Recogidas
                        </p>
                        <p className="mt-1 text-base font-bold text-[#16803A]">
                          {historyRecogidaTotal}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto_auto_auto] xl:items-center">
                    <input
                      value={historyQ}
                      onChange={(event) => setHistoryQ(event.target.value)}
                      placeholder="Buscar por usuario, documento, motivo, código o equipo…"
                      className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#3C9CD1] focus:ring-4 focus:ring-[#3C9CD1]/10"
                    />

                    <select
                      value={historyType}
                      onChange={(event) =>
                        setHistoryType(event.target.value as 'ALL' | HandoverType)
                      }
                      className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm outline-none transition focus:border-[#3C9CD1] focus:ring-4 focus:ring-[#3C9CD1]/10"
                    >
                      <option value="ALL">Todos los tipos</option>
                      <option value="ENTREGA">Solo entregas</option>
                      <option value="RECOGIDA">Solo recogidas</option>
                    </select>

                    <div className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-xs text-slate-500 shadow-sm">
                      <span>Mostrar</span>

                      <select
                        className="h-8 rounded-xl border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 outline-none focus:border-[#3C9CD1] focus:ring-2 focus:ring-[#3C9CD1]/10"
                        value={
                          historyPageSize === 'ALL'
                            ? 'ALL'
                            : String(historyPageSize)
                        }
                        onChange={(event) => {
                          const value = event.target.value;

                          setHistoryPageSize(
                            value === 'ALL'
                              ? 'ALL'
                              : (Number(value) as HistoryPageSizeOption),
                          );
                        }}
                      >
                        <option value="6">6</option>
                        <option value="12">12</option>
                        <option value="24">24</option>
                        <option value="ALL">Todos</option>
                      </select>

                      <span>por página</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setHistoryQ('');
                        setHistoryType('ALL');
                        setHistoryPage(1);
                      }}
                      className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-[#1B3859] shadow-sm transition hover:bg-slate-50"
                    >
                      Limpiar
                    </button>
                  </div>
                </div>

                {handoversQ.isLoading ? (
                  <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
                    Cargando historial…
                  </div>
                ) : handovers.length === 0 ? (
                  <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm text-slate-500">
                    No hay trámites registrados aún.
                  </div>
                ) : filteredHandovers.length === 0 ? (
                  <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center">
                    <p className="text-sm font-semibold text-slate-700">
                      Sin resultados para los filtros actuales
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Ajusta la búsqueda o cambia el tipo de trámite.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {paginatedHandovers.map((handover) => {
                        const isDelivery = handover.type === 'ENTREGA';
                        const itemsCount = handover.items?.length || 0;
                        const firstAssets = (handover.items || []).slice(0, 3);
                        const remainingAssets = Math.max(
                          0,
                          itemsCount - firstAssets.length,
                        );

                        return (
                          <article
                            key={handover.id}
                            className="flex min-h-[245px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-[#3C9CD1]/40 hover:shadow-md"
                          >
                            <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                              <span
                                className={[
                                  'inline-flex h-7 items-center rounded-full border px-3 text-xs font-semibold',
                                  isDelivery
                                    ? 'border-[#3C9CD1]/30 bg-[#3C9CD1]/10 text-[#1B3859]'
                                    : 'border-[#54BF5B]/30 bg-[#54BF5B]/10 text-[#16803A]',
                                ].join(' ')}
                              >
                                {isDelivery ? 'Entrega' : 'Recogida'}
                              </span>

                              <span className="text-right text-xs font-medium text-slate-500">
                                {formatDateTime(handover.createdAt)}
                              </span>
                            </div>

                            <div className="flex flex-1 flex-col gap-4 p-4">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                                  Usuario / custodio
                                </p>

                                <p
                                  className="mt-1 truncate text-sm font-semibold text-[#111827]"
                                  title={handover.person?.fullName || ''}
                                >
                                  {handover.person?.fullName || 'Sin custodio'}
                                </p>

                                {handover.person?.documentId && (
                                  <p className="mt-1 text-xs text-slate-500">
                                    Documento: {handover.person.documentId}
                                  </p>
                                )}
                              </div>

                              <div className="grid gap-3 text-xs text-slate-600 sm:grid-cols-2">
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                                  <p className="font-semibold text-slate-500">
                                    Motivo
                                  </p>
                                  <p className="mt-1 max-h-10 overflow-hidden font-medium text-slate-700">
                                    {handover.reason || '—'}
                                  </p>
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                                  <p className="font-semibold text-slate-500">
                                    Equipos
                                  </p>
                                  <p className="mt-1 text-base font-bold text-[#111827]">
                                    {itemsCount}
                                  </p>
                                </div>
                              </div>

                              {itemsCount > 0 && (
                                <div className="space-y-1">
                                  {firstAssets.map((item) => (
                                    <div
                                      key={item.id}
                                      className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                                    >
                                      <span
                                        className="truncate font-semibold text-[#1B3859]"
                                        title={item.asset?.tag || ''}
                                      >
                                        {item.asset?.tag || '—'}
                                      </span>

                                      <span
                                        className="truncate text-slate-500"
                                        title={item.asset?.name || ''}
                                      >
                                        {item.asset?.name || 'Sin nombre'}
                                      </span>
                                    </div>
                                  ))}

                                  {remainingAssets > 0 && (
                                    <p className="pt-1 text-xs font-medium text-slate-500">
                                      +{remainingAssets} equipo
                                      {remainingAssets === 1 ? '' : 's'} más
                                    </p>
                                  )}
                                </div>
                              )}

                              <button
  type="button"
  onClick={() => setSelectedHandover(handover)}
  className="mt-auto inline-flex h-10 w-full items-center justify-center rounded-xl bg-[#1B3859] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#132B45]"
>
  Ver detalle
</button>
                            </div>
                          </article>
                        );
                      })}
                    </div>

                    {filteredHandovers.length > 0 && (
                      <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                        <span>
                          {historyPageSize === 'ALL'
                            ? `Mostrando ${filteredHandovers.length} trámite${
                                filteredHandovers.length === 1 ? '' : 's'
                              }`
                            : `Mostrando ${historyStart}-${historyEnd} de ${
                                filteredHandovers.length
                              } trámite${
                                filteredHandovers.length === 1 ? '' : 's'
                              }`}
                        </span>

                        {historyPageSize !== 'ALL' &&
                          historyTotalPages > 1 && (
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setHistoryPage((current) =>
                                    Math.max(1, current - 1),
                                  )
                                }
                                disabled={historyPage <= 1}
                                className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                Anterior
                              </button>

                              <span className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                                Página {historyPage} de {historyTotalPages}
                              </span>

                              <button
                                type="button"
                                onClick={() =>
                                  setHistoryPage((current) =>
                                    Math.min(historyTotalPages, current + 1),
                                  )
                                }
                                disabled={historyPage >= historyTotalPages}
                                className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                Siguiente
                              </button>
                            </div>
                          )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </SectionCard>

        {selectedHandover && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-3 py-6 backdrop-blur-sm">
            <div className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-[#1B3859]">
                    Detalle del trámite
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    {selectedHandover.type} ·{' '}
                    {formatDateTime(selectedHandover.createdAt)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedHandover(null)}
                  className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                  aria-label="Cerrar"
                >
                  ×
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Custodio / usuario
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#111827]">
                      {selectedHandover.person?.fullName || '—'}
                    </p>
                    {selectedHandover.person?.documentId && (
                      <p className="mt-1 text-xs text-slate-500">
                        Documento: {selectedHandover.person.documentId}
                      </p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Motivo
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#111827]">
                      {selectedHandover.reason || '—'}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Firmante
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      {selectedHandover.signerName || '—'}
                    </p>
                    {selectedHandover.signerId && (
                      <p className="mt-1 text-xs text-slate-500">
                        ID: {selectedHandover.signerId}
                      </p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Contacto
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      {selectedHandover.email || '—'}
                    </p>
                    {selectedHandover.phone && (
                      <p className="mt-1 text-xs text-slate-500">
                        Tel: {selectedHandover.phone}
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-[#1B3859]">
                    Equipos incluidos
                  </p>

                  {!selectedHandover.items?.length ? (
                    <p className="mt-3 text-sm text-slate-500">
                      Sin equipos registrados.
                    </p>
                  ) : (
                    <ul className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200">
                      {selectedHandover.items.map((item) => (
                        <li
                          key={item.id}
                          className="bg-slate-50 px-3 py-3 text-sm"
                        >
                          <p className="font-semibold text-[#111827]">
                            {item.asset?.tag || '—'}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.asset?.name || 'Sin nombre'}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {selectedHandover.notes && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-sm font-semibold text-[#1B3859]">
                      Observaciones
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                      {selectedHandover.notes}
                    </p>
                  </div>
                )}

                {selectedHandover.signatureData && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-sm font-semibold text-[#1B3859]">
                      Firma
                    </p>

                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedHandover.signatureData}
                      alt="Firma"
                      className="mt-3 max-h-44 rounded-2xl border border-slate-200 bg-white object-contain"
                    />
                  </div>
                )}

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-[#1B3859]">
                    Comodato / soporte del trámite
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        handlePreviewApiFile(
                          getHandoverComodatoUrl(selectedHandover)!,
                          `Comodato_${selectedHandover.id}.pdf`,
                        )
                      }
                      className="inline-flex h-10 items-center justify-center rounded-xl bg-[#1B3859] px-4 text-sm font-semibold text-white transition hover:bg-[#132B45]"
                    >
                      Ver comodato
                    </button>

                    <a
                      href={toAbsoluteApiUrl(
                        getHandoverComodatoDownloadUrl(selectedHandover),
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-[#1B3859] transition hover:bg-slate-50"
                    >
                      Descargar comodato
                    </a>

                    {getHandoverAttachmentUrl(selectedHandover) && (
                      <button
                        type="button"
                        onClick={() =>
                          handlePreviewApiFile(
                            getHandoverAttachmentUrl(selectedHandover)!,
                            selectedHandover.attachmentName || 'Soporte adicional',
                          )
                        }
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-[#1B3859] transition hover:bg-slate-50"
                      >
                        Ver soporte adicional
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {previewFile && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 px-3 py-6 backdrop-blur-sm">
            <div className="flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
                <p className="truncate text-sm font-semibold text-[#1B3859]">
                  {previewFile.name}
                </p>

                <button
                  type="button"
                  onClick={handleClosePreview}
                  className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                  aria-label="Cerrar vista previa"
                >
                  ×
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-3">
                {previewFile.isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewFile.url}
                    alt={previewFile.name}
                    className="mx-auto max-h-[78dvh] rounded-2xl object-contain"
                  />
                ) : (
                  <iframe
                    src={previewFile.url}
                    title={previewFile.name}
                    className="h-[78dvh] w-full rounded-2xl border border-slate-200 bg-white"
                  />
                )}
              </div>
            </div>
          </div>
        )}

      </PageShell>
    </Guard>
  );
}