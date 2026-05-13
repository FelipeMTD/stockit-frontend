'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import Guard from '@/components/auth-guard';
import ImportPeopleModal from '@/components/people/import-people-modal';
import { api, type AuthUser } from '@/lib/api';
import { capsFor, normalizeRole, type AppRole } from '@/lib/roles';

type PersonType = 'NOMINA' | 'OPS' | 'PACIENTE' | 'TERCERO';
type PageSizeOption = 10 | 50 | 100 | 'ALL';

type Person = {
  id: string;
  documentId: string | null;
  fullName: string;
  type: PersonType;
  area?: string | null;
  eps: string | null;
  department: string | null;
  municipality: string | null;
  address: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  finalStatus: string | null;
  inactivityType: string | null;
  inactivityDate: string | null;
};

type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
};

const TYPE_LABEL: Record<PersonType, string> = {
  NOMINA: 'Nómina',
  OPS: 'OPS',
  PACIENTE: 'Paciente',
  TERCERO: 'Tercero',
};

const PERSON_TYPES: Array<{ value: PersonType; label: string }> = [
  { value: 'PACIENTE', label: 'Paciente' },
  { value: 'NOMINA', label: 'Nómina' },
  { value: 'OPS', label: 'OPS' },
  { value: 'TERCERO', label: 'Tercero' },
];

const AREA_OPTIONS = [
  'TALENTO HUMANO',
  'EDUCACIÓN',
  'SISTEMAS',
  'ADMINISTRATIVA',
  'CONTABLE',
  'FACTURACION',
  'E&C',
  'SST - CALIDAD',
  'AUTORIZACIONES',
  'DIRECCION GENERAL',
  'SERVICIO PBS',
  'FINANCIERA',
  'ACTIVOS FIJOS',
  'FARMACIA',
  'JURIDICA',
  'COMPRAS',
  'CLINICA DE HERIDAS',
  'COMUNICACIONES',
  'NUTRIDOM',
  'DIRECCION MEDICA',
  'PHD',
  'SERVICIOS ESPECIALES',
] as const;

const EPS_OPTIONS = [
  'CAJA DE COMPENSACION FAMILIAR DEL VALLE DEL CAUCA - COMFENALCO VALLE DELAGENTE',
  'NUEVA EMPRESA PROMOTORA DE SALUD S.A - NUEVA EPS.',
  'ENTIDAD PROMOTORA DE SALUD SANITAS S.A.S.',
  'SALUD TOTAL EPS-S S.A',
  'COOSALUD ENTIDAD PROMOTORA DE SALUD S.A.',
  'PARTICULAR',
  'EPS SURAMERICANA S.A',
  'CAJA DE COMPENSACION FAMILIAR COMPENSAR',
  'ENTIDAD PROMOTORA DE SALUD SERVICIO OCCIDENTAL DE SALUD S.A. S.O.S.',
  'COOMEVA ENTIDAD PROMOTORA DE SALUD S.A.',
  'EMSSANAR E.S.S',
  'ASOCIACION MUTUAL LA ESPERANZA - ASMET SALUD',
  'FIDEICOMISOS PATRIMONIOS AUTONOMOS FIDUCIARIA LA PREVISORA S.A',
  'POSITIVA COMPAÑIA DE SEGUROS S.A.',
] as const;

const CO_DEPARTMENTS = [
  'AMAZONAS',
  'ANTIOQUIA',
  'ARAUCA',
  'ATLÁNTICO',
  'BOGOTÁ, D. C.',
  'BOLÍVAR',
  'BOYACÁ',
  'CALDAS',
  'CAQUETÁ',
  'CASANARE',
  'CAUCA',
  'CESAR',
  'CHOCÓ',
  'CÓRDOBA',
  'CUNDINAMARCA',
  'GUAINÍA',
  'GUAVIARE',
  'HUILA',
  'LA GUAJIRA',
  'MAGDALENA',
  'META',
  'NARIÑO',
  'NORTE DE SANTANDER',
  'PUTUMAYO',
  'QUINDÍO',
  'RISARALDA',
  'SANTANDER',
  'SUCRE',
  'TOLIMA',
  'VALLE DEL CAUCA',
  'VAUPÉS',
  'VICHADA',
] as const;

const INACTIVITY_TYPES = [
  'FALLECIDO',
  'EGRESO BARTHEL',
  'CAMBIO DE PRESTADOR',
  'SALIDA COLABORADOR',
  'EGRESO ADMINISTRATIVO',
] as const;

function normalizeType(value?: string | null): PersonType {
  const normalized = String(value || '').trim().toUpperCase();

  if (
    normalized === 'NOMINA' ||
    normalized === 'OPS' ||
    normalized === 'PACIENTE' ||
    normalized === 'TERCERO'
  ) {
    return normalized;
  }

  return 'PACIENTE';
}

function normalizeFinalStatus(value?: string | null): 'ACTIVO' | 'INACTIVO' {
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

function labelFinalStatus(value?: string | null) {
  return normalizeFinalStatus(value) === 'INACTIVO' ? 'Inactivo' : 'Activo';
}

function emptyForm(): Partial<Person> {
  return {
    documentId: '',
    fullName: '',
    type: 'PACIENTE',
    area: null,
    eps: null,
    department: null,
    municipality: null,
    address: '',
    email: '',
    phone: '',
    notes: '',
    finalStatus: 'ACTIVO',
    inactivityType: null,
    inactivityDate: null,
  };
}

function useDebounced<T>(value: T, delay = 350) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);

  return debounced;
}

export default function PeoplePage() {
  const router = useRouter();
  const qc = useQueryClient();

  const [role, setRole] = useState<AppRole | null>(null);
  const [checkingRole, setCheckingRole] = useState(true);
  const [roleError, setRoleError] = useState<string | null>(null);

  const caps = useMemo(() => capsFor(role), [role]);

  const canViewPeople = caps.viewPeople;
  const canEditPeople = caps.editPeople;

  const [q, setQ] = useState('');
  const debouncedQ = useDebounced(q.trim(), 350);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSizeOption>(10);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Person>>(emptyForm());
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadMe() {
      try {
        setRoleError(null);

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

        setRole(normalizedRole);
      } catch (error) {
        console.error('Error validando permisos en población:', error);

        if (!active) return;

        setRole(null);
        setRoleError('No se pudo validar la sesión del usuario.');
      } finally {
        if (active) {
          setCheckingRole(false);
        }
      }
    }

    loadMe();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (checkingRole) return;

    if (role === 'CONDUCTOR') {
      router.replace('/routes');
      return;
    }

    if (!canViewPeople) {
      router.replace('/assets');
    }
  }, [checkingRole, role, canViewPeople, router]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, pageSize]);

  const people = useQuery<Paginated<Person>>({
    queryKey: ['people', { q: debouncedQ, page, pageSize }],
    enabled: !checkingRole && canViewPeople,
    queryFn: async (): Promise<Paginated<Person>> => {
      const res = await api.get<Paginated<Person>>('/api/people', {
        params: {
          q: debouncedQ || undefined,
          page,
          pageSize: pageSize === 'ALL' ? 10000 : pageSize,
        },
      });

      return res.data;
    },
    placeholderData: (previousData) => previousData,
    staleTime: 30_000,
  });

  const createPerson = useMutation({
    mutationFn: async (payload: Partial<Person>) => {
      const res = await api.post<Person>('/api/people', payload);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['people'] });
      setForm(emptyForm());
      setEditingId(null);
      toast.success('Usuario creado');
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.error ?? 'No se pudo crear el usuario.',
      );
    },
  });

  const updatePerson = useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<Person>;
    }) => {
      const res = await api.patch<Person>(`/api/people/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['people'] });
      setForm(emptyForm());
      setEditingId(null);
      toast.success('Usuario actualizado');
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.error ?? 'No se pudo actualizar el usuario.',
      );
    },
  });

  const deletePerson = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/people/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['people'] });
      toast.success('Usuario eliminado');
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.error ?? 'No se pudo eliminar el usuario.',
      );
    },
  });

  const isInactive = normalizeFinalStatus(form.finalStatus) === 'INACTIVO';
  const isNomina = normalizeType(form.type) === 'NOMINA';

  function startEdit(person: Person) {
    const type = normalizeType(person.type);
    const finalStatus = normalizeFinalStatus(person.finalStatus);

    setEditingId(person.id);

    setForm({
      id: person.id,
      documentId: person.documentId ?? '',
      fullName: person.fullName ?? '',
      type,
      area: type === 'NOMINA' ? person.area ?? null : null,
      eps: person.eps ?? null,
      department: person.department ?? null,
      municipality: person.municipality ?? null,
      address: person.address ?? '',
      email: person.email ?? '',
      phone: person.phone ?? '',
      notes: person.notes ?? '',
      finalStatus,
      inactivityType:
        finalStatus === 'INACTIVO' ? person.inactivityType ?? null : null,
      inactivityDate:
        finalStatus === 'INACTIVO' && person.inactivityDate
          ? person.inactivityDate.slice(0, 10)
          : null,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm());
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    if (!canEditPeople) {
      toast.error('No tienes permisos para gestionar población.');
      return;
    }

    const type = normalizeType(form.type);
    const finalStatus = normalizeFinalStatus(form.finalStatus);

    const payload: Partial<Person> = {
      documentId: form.documentId?.trim() || null,
      fullName: form.fullName?.trim() || '',
      type,
      area: type === 'NOMINA' ? form.area?.trim() || null : null,
      eps: form.eps?.trim() || null,
      department: form.department?.trim() || null,
      municipality: form.municipality?.trim() || null,
      address: form.address?.trim() || null,
      email: form.email?.trim() || null,
      phone: form.phone?.trim() || null,
      notes: form.notes?.trim() || null,
      finalStatus,
      inactivityType:
        finalStatus === 'INACTIVO'
          ? form.inactivityType?.trim() || null
          : null,
      inactivityDate:
        finalStatus === 'INACTIVO' ? form.inactivityDate || null : null,
    };

    if (!payload.fullName) {
      toast.error('El nombre es obligatorio.');
      return;
    }

    if (editingId) {
      await updatePerson.mutateAsync({
        id: editingId,
        payload,
      });
    } else {
      await createPerson.mutateAsync(payload);
    }
  }

  const totalItems = people.data?.total ?? 0;
  const totalPages = pageSize === 'ALL' ? 1 : people.data?.pages ?? 1;
  const currentPage = people.data?.page ?? page;
  const items = people.data?.items ?? [];

  return (
    <Guard>
      {checkingRole ? (
        <div className="rounded-xl border bg-white p-4 text-sm text-slate-500 dark:bg-slate-900 dark:text-slate-300">
          Verificando permisos…
        </div>
      ) : roleError ? (
        <div className="rounded-xl border bg-white p-4 text-sm text-red-600 dark:bg-slate-900">
          {roleError}
        </div>
      ) : !canViewPeople ? (
        <div className="rounded-xl border bg-white p-4 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">
          No tienes permisos para ver población.
        </div>
      ) : (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-lg font-semibold">Población</h1>
              <p className="mt-1 text-sm text-slate-500">
                Gestión de pacientes, nómina, OPS y terceros.
              </p>
            </div>

            {canEditPeople && (
              <button
                onClick={() => setShowImport(true)}
                className="rounded-xl bg-sky-700 text-white px-4 py-2 text-sm hover:bg-sky-800"
              >
                Importar
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Buscar por nombre, documento, EPS, área o municipio…"
                className="w-full rounded-full border px-10 py-2 text-sm bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-sky-300 dark:focus:ring-sky-700"
              />

              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {canEditPeople && (
              <form
                onSubmit={submit}
                className="border rounded-xl bg-white dark:bg-slate-900 p-4 space-y-3"
              >
                <h2 className="font-medium">
                  {editingId ? 'Editar usuario' : 'Nuevo usuario'}
                </h2>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <label className="text-sm">Documento</label>
                    <input
                      className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
                      value={form.documentId || ''}
                      onChange={(event) =>
                        setForm((state) => ({
                          ...state,
                          documentId: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <label className="text-sm">Tipo de usuario</label>
                    <select
                      className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
                      value={normalizeType(form.type)}
                      onChange={(event) => {
                        const nextType = normalizeType(event.target.value);

                        setForm((state) => ({
                          ...state,
                          type: nextType,
                          area:
                            nextType === 'NOMINA'
                              ? state.area ?? null
                              : null,
                        }));
                      }}
                    >
                      {PERSON_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {isNomina && (
                    <div className="grid gap-1.5 sm:col-span-2">
                      <label className="text-sm">Área</label>
                      <select
                        className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
                        value={form.area || ''}
                        onChange={(event) =>
                          setForm((state) => ({
                            ...state,
                            area: event.target.value || null,
                          }))
                        }
                      >
                        <option value="">—</option>
                        {AREA_OPTIONS.map((area) => (
                          <option key={area} value={area}>
                            {area}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="grid gap-1.5 sm:col-span-2">
                    <label className="text-sm">
                      Nombre <span className="text-rose-500">*</span>
                    </label>
                    <input
                      className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
                      value={form.fullName || ''}
                      onChange={(event) =>
                        setForm((state) => ({
                          ...state,
                          fullName: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <label className="text-sm">EPS</label>
                    <select
                      className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
                      value={form.eps || ''}
                      onChange={(event) =>
                        setForm((state) => ({
                          ...state,
                          eps: event.target.value || null,
                        }))
                      }
                    >
                      <option value="">—</option>

                      {form.eps && !EPS_OPTIONS.includes(form.eps as any) && (
                        <option value={form.eps}>{form.eps}</option>
                      )}

                      {EPS_OPTIONS.map((eps) => (
                        <option key={eps} value={eps}>
                          {eps}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-1.5">
                    <label className="text-sm">Departamento</label>
                    <select
                      className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
                      value={form.department || ''}
                      onChange={(event) =>
                        setForm((state) => ({
                          ...state,
                          department: event.target.value || null,
                          municipality: null,
                        }))
                      }
                    >
                      <option value="">—</option>

                      {form.department &&
                        !CO_DEPARTMENTS.includes(form.department as any) && (
                          <option value={form.department}>
                            {form.department}
                          </option>
                        )}

                      {CO_DEPARTMENTS.map((department) => (
                        <option key={department} value={department}>
                          {department}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-1.5">
                    <label className="text-sm">Municipio</label>
                    <input
                      className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
                      value={form.municipality || ''}
                      onChange={(event) =>
                        setForm((state) => ({
                          ...state,
                          municipality: event.target.value,
                        }))
                      }
                      placeholder="Ej: CÚCUTA"
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <label className="text-sm">Teléfono</label>
                    <input
                      className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
                      value={form.phone || ''}
                      onChange={(event) =>
                        setForm((state) => ({
                          ...state,
                          phone: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="grid gap-1.5 sm:col-span-2">
                    <label className="text-sm">Dirección</label>
                    <input
                      className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
                      value={form.address || ''}
                      onChange={(event) =>
                        setForm((state) => ({
                          ...state,
                          address: event.target.value,
                        }))
                      }
                      placeholder="Carrera 10 # 20-30"
                    />
                  </div>

                  <div className="grid gap-1.5 sm:col-span-2">
                    <label className="text-sm">Correo</label>
                    <input
                      type="email"
                      className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
                      value={form.email || ''}
                      onChange={(event) =>
                        setForm((state) => ({
                          ...state,
                          email: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <label className="text-sm">Estado final</label>
                    <select
                      className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
                      value={normalizeFinalStatus(form.finalStatus)}
                      onChange={(event) => {
                        const next = normalizeFinalStatus(event.target.value);

                        setForm((state) => ({
                          ...state,
                          finalStatus: next,
                          inactivityType:
                            next === 'ACTIVO' ? null : state.inactivityType,
                          inactivityDate:
                            next === 'ACTIVO' ? null : state.inactivityDate,
                        }));
                      }}
                    >
                      <option value="ACTIVO">Activo</option>
                      <option value="INACTIVO">Inactivo</option>
                    </select>
                  </div>

                  {isInactive && (
                    <>
                      <div className="grid gap-1.5">
                        <label className="text-sm">
                          Tipo de inactivación
                        </label>
                        <select
                          className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
                          value={form.inactivityType || ''}
                          onChange={(event) =>
                            setForm((state) => ({
                              ...state,
                              inactivityType: event.target.value || null,
                            }))
                          }
                        >
                          <option value="">Seleccione…</option>
                          {INACTIVITY_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid gap-1.5">
                        <label className="text-sm">
                          Fecha inactividad
                        </label>
                        <input
                          type="date"
                          className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
                          value={form.inactivityDate || ''}
                          onChange={(event) =>
                            setForm((state) => ({
                              ...state,
                              inactivityDate: event.target.value || null,
                            }))
                          }
                        />
                      </div>
                    </>
                  )}

                  <div className="grid gap-1.5 sm:col-span-2">
                    <label className="text-sm">Notas</label>
                    <textarea
                      rows={3}
                      className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
                      value={form.notes || ''}
                      onChange={(event) =>
                        setForm((state) => ({
                          ...state,
                          notes: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  {editingId && (
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      Cancelar
                    </button>
                  )}

                  <button
                    type="submit"
                    disabled={createPerson.isPending || updatePerson.isPending}
                    className="rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {editingId
                      ? updatePerson.isPending
                        ? 'Guardando…'
                        : 'Guardar cambios'
                      : createPerson.isPending
                        ? 'Creando…'
                        : 'Crear usuario'}
                  </button>
                </div>
              </form>
            )}

            <div
              className={`border rounded-xl bg-white dark:bg-slate-900 flex flex-col ${
                canEditPeople ? '' : 'xl:col-span-2'
              }`}
            >
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="font-medium">
                  Usuarios {totalItems ? `${totalItems} resultado(s)` : ''}
                </h2>

                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    <span>Mostrar:</span>

                    <select
                      className="rounded-lg border px-2 py-1 text-xs bg-white dark:bg-slate-950"
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
                  </div>

                  {pageSize !== 'ALL' && totalPages > 1 && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="px-2 py-1 rounded-lg border disabled:opacity-40"
                        onClick={() =>
                          setPage((value) => Math.max(1, value - 1))
                        }
                        disabled={currentPage <= 1}
                      >
                        Anterior
                      </button>

                      <span>
                        Página {currentPage} de {totalPages}
                      </span>

                      <button
                        type="button"
                        className="px-2 py-1 rounded-lg border disabled:opacity-40"
                        onClick={() =>
                          setPage((value) => Math.min(totalPages, value + 1))
                        }
                        disabled={currentPage >= totalPages}
                      >
                        Siguiente
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="overflow-auto" style={{ maxHeight: '68vh' }}>
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 text-slate-600">
                    <tr>
                      <th className="text-left p-3">Documento</th>
                      <th className="text-left p-3">Nombre</th>
                      <th className="text-left p-3">Tipo</th>
                      <th className="text-left p-3">Área</th>
                      <th className="text-left p-3">EPS</th>
                      <th className="text-left p-3">Departamento</th>
                      <th className="text-left p-3">Municipio</th>
                      <th className="text-left p-3">Dirección</th>
                      <th className="text-left p-3">Estado</th>
                      <th className="text-left p-3">Inactivación</th>
                      <th className="text-left p-3">Fecha</th>
                      {canEditPeople && (
                        <th className="text-left p-3">Acciones</th>
                      )}
                    </tr>
                  </thead>

                  <tbody className="divide-y">
                    {people.isLoading ? (
                      <tr>
                        <td
                          className="p-6 text-center text-slate-500"
                          colSpan={canEditPeople ? 12 : 11}
                        >
                          Cargando…
                        </td>
                      </tr>
                    ) : items.length === 0 ? (
                      <tr>
                        <td
                          className="p-6 text-center text-slate-500"
                          colSpan={canEditPeople ? 12 : 11}
                        >
                          Sin usuarios.
                        </td>
                      </tr>
                    ) : (
                      items.map((person: Person) => (
                        <tr key={person.id} className="hover:bg-slate-50/50">
                          <td className="p-3">
                            {person.documentId || '—'}
                          </td>
                          <td className="p-3">{person.fullName}</td>
                          <td className="p-3">
                            {TYPE_LABEL[normalizeType(person.type)]}
                          </td>
                          <td className="p-3">{person.area || '—'}</td>
                          <td
                            className="p-3 max-w-[260px] truncate"
                            title={person.eps || ''}
                          >
                            {person.eps || '—'}
                          </td>
                          <td className="p-3">
                            {person.department || '—'}
                          </td>
                          <td className="p-3">
                            {person.municipality || '—'}
                          </td>
                          <td
                            className="p-3 max-w-[220px] truncate"
                            title={person.address || ''}
                          >
                            {person.address || '—'}
                          </td>
                          <td className="p-3">
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-medium ${
                                normalizeFinalStatus(person.finalStatus) ===
                                'ACTIVO'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-rose-50 text-rose-700'
                              }`}
                            >
                              {labelFinalStatus(person.finalStatus)}
                            </span>
                          </td>
                          <td className="p-3">
                            {person.inactivityType || '—'}
                          </td>
                          <td className="p-3">
                            {person.inactivityDate
                              ? person.inactivityDate.slice(0, 10)
                              : '—'}
                          </td>

                          {canEditPeople && (
                            <td className="p-3">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => startEdit(person)}
                                  className="rounded-md border px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
                                >
                                  Editar
                                </button>

                                <button
                                  onClick={async () => {
                                    const ok = confirm(
                                      '¿Eliminar este usuario?',
                                    );

                                    if (!ok) return;

                                    await deletePerson.mutateAsync(person.id);
                                  }}
                                  disabled={deletePerson.isPending}
                                  className="rounded-md border px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 disabled:opacity-60"
                                >
                                  Eliminar
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {canEditPeople && (
            <ImportPeopleModal
              open={showImport}
              onClose={() => setShowImport(false)}
            />
          )}
        </section>
      )}
    </Guard>
  );
}