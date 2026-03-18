'use client';

import { useState, useMemo } from 'react';
import { api } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  useUpdateCategory,
  useDeleteCategory,
  useUpdateLocation,
  useDeleteLocation,
  useSites,
} from '@/lib/hooks';
import { useUsers, useCreateUser, useUpdateUser, useResetPassword } from '@/lib/user-hooks';
import SitesPanel from '@/components/settings/sites-panel';
import Guard from '@/components/auth-guard';

/* ────────────────────────────────────────────────────────────────────────────
   Data hooks locales
──────────────────────────────────────────────────────────────────────────── */
function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () =>
      (await api.get('/api/catalog/categories', { params: { pageSize: 100 } })).data.items,
  });
}
function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; code?: string | null; description?: string | null }) =>
      api.post('/api/catalog/categories', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Categoría creada');
    },
  });
}

// 👇 NUEVOS HOOKS PARA LOS NOMBRES DE CATEGORÍA
function useAddCategoryName() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { categoryId: string; name: string }) =>
      api.post('/api/catalog/category-names', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}
function useRemoveCategoryName() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/catalog/category-names/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

function useLocations() {
  return useQuery({
    queryKey: ['locations'],
    queryFn: async () =>
      (await api.get('/api/catalog/locations', { params: { pageSize: 100 } })).data.items,
  });
}
function useCreateLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      type?: string | null;
      address?: string | null;
      siteId?: string | null;
    }) => api.post('/api/catalog/locations', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['locations'] });
      toast.success('Ubicación creada');
    },
  });
}

/* ────────────────────────────────────────────────────────────────────────────
   Página de Configuraciones
──────────────────────────────────────────────────────────────────────────── */
export default function SettingsPage() {
  const [tab, setTab] = useState<'categories' | 'locations' | 'users'>('categories');

  return (
    <Guard>
      <section className="space-y-4">
        <h1 className="text-xl font-semibold">Configuraciones</h1>

        <div className="rounded-xl border bg-white dark:bg-slate-900 p-2 flex gap-2 overflow-x-auto">
          <button
            onClick={() => setTab('categories')}
            className={`px-3 py-2 whitespace-nowrap rounded-lg text-sm ${
              tab === 'categories'
                ? 'bg-slate-100 dark:bg-slate-800 font-medium'
                : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
            }`}
          >
            Categorias y Activos
          </button>
          <button
            onClick={() => setTab('locations')}
            className={`px-3 py-2 whitespace-nowrap rounded-lg text-sm ${
              tab === 'locations'
                ? 'bg-slate-100 dark:bg-slate-800 font-medium'
                : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
            }`}
          >
            Ubicaciones y Sedes
          </button>
          <button
            onClick={() => setTab('users')}
            className={`px-3 py-2 whitespace-nowrap rounded-lg text-sm ${
              tab === 'users'
                ? 'bg-slate-100 dark:bg-slate-800 font-medium'
                : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
            }`}
          >
            Usuarios del sistema
          </button>
        </div>

        {tab === 'categories' && <CategoriesPanel />}
        {tab === 'locations' && <LocationsPanel />}
        {tab === 'users' && <UsersPanel />}
      </section>
    </Guard>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Categorías
──────────────────────────────────────────────────────────────────────────── */
function CategoriesPanel() {
  const list = useCategories();
  const create = useCreateCategory();
  const upd = useUpdateCategory();
  const del = useDeleteCategory();

  // Hooks para nombres
  const addName = useAddCategoryName();
  const removeName = useRemoveCategoryName();

  const [editing, setEditing] = useState<any | null>(null);
  const [confirmDel, setConfirmDel] = useState<any | null>(null);
  
  // Estado para el modal de gestionar nombres
  const [managingNames, setManagingNames] = useState<any | null>(null);
  const [newName, setNewName] = useState('');

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error('El nombre es obligatorio');
    await create.mutateAsync({ name, code: code || null, description: description || null });
    setName('');
    setCode('');
    setDescription('');
  }

  // Refresca la data del modal si cambia en background
  const currentManagingCategory = useMemo(() => {
    if (!managingNames || !list.data) return null;
    return list.data.find((c: any) => c.id === managingNames.id) || managingNames;
  }, [managingNames, list.data]);

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* Formulario */}
      <form onSubmit={onSubmit} className="border rounded-xl bg-white dark:bg-slate-900 p-4 space-y-3">
        <h3 className="font-medium">Nueva Categoría</h3>
        <div className="grid gap-1.5">
          <label className="text-sm">Nombre *</label>
          <input
            className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Computadores"
          />
        </div>
        <div className="grid gap-1.5">
          <label className="text-sm">Código</label>
          <input
            className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="COMP"
          />
        </div>
        <div className="grid gap-1.5">
          <label className="text-sm">Descripción</label>
          <textarea
            className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Portátiles y de escritorio"
          />
        </div>
        <div className="flex justify-end">
          <button
            disabled={create.isPending}
            className="rounded-xl bg-lime-500 from-brand to-accent text-white px-4 py-2 text-sm hover:bg-blue-900 disabled:opacity-60"
          >
            {create.isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>

      {/* Lista */}
      <div className="border rounded-xl bg-white dark:bg-slate-900 p-4">
        <h3 className="font-medium mb-2">Categorías creadas</h3>
        <ul className="divide-y">
          {list.data?.map((c: any) => (
            <li key={c.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="font-medium text-sm">{c.name}</div>
                <div className="text-xs text-slate-500">
                  {c.code ? `Código: ${c.code} · ` : ''} 
                  {c.allowedNames?.length || 0} tipos de activos
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                {/* 👇 AQUÍ CAMBIAMOS EL TEXTO DEL BOTÓN */}
                <button
                  className="border rounded-xl text-emerald-700 px-2 py-1 text-xs hover:border-emerald-700 dark:text-emerald-400 dark:border-slate-700 dark:hover:border-emerald-400"
                  onClick={() => setManagingNames(c)}
                >
                  Agregar Activo
                </button>
                <button
                  className="border rounded-xl text-blue-900 px-2 py-1 text-xs hover:border-blue-900"
                  onClick={() => setEditing({ ...c })}
                >
                  Editar
                </button>
                <button className="text-rose-600 text-xs hover:underline" onClick={() => setConfirmDel(c)}>
                  Eliminar
                </button>
              </div>
            </li>
          ))}
          {(list.data?.length ?? 0) === 0 && (
            <li className="py-6 text-center text-sm text-slate-500">Sin categorías.</li>
          )}
        </ul>

        {/* MODAL: Gestionar Nombres de la Categoría */}
        {managingNames && currentManagingCategory && (
          <div className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border bg-white dark:bg-slate-900 p-5 space-y-4 shadow-xl">
              <div className="flex justify-between items-center border-b pb-3 dark:border-slate-800">
                <div>
                  <h4 className="font-semibold text-lg">Catálogo de Activos</h4>
                  <p className="text-xs text-slate-500">Categoría: {currentManagingCategory.name}</p>
                </div>
                <button 
                  onClick={() => { setManagingNames(null); setNewName(''); }} 
                  className="text-slate-400 hover:bg-slate-100 hover:text-slate-700 p-2 rounded-lg dark:hover:bg-slate-800"
                >
                  ✕
                </button>
              </div>

              {/* Input para agregar */}
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!newName.trim()) return;
                try {
                  await addName.mutateAsync({ categoryId: currentManagingCategory.id, name: newName });
                  setNewName('');
                  toast.success('Activo agregado correctamente');
                } catch (err: any) {
                  toast.error(err?.response?.data?.error || 'Error al agregar');
                }
              }} className="flex gap-2">
                <input 
                  className="flex-1 rounded-xl border px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 focus:bg-white"
                  placeholder="Ej: SILLA ERGONOMICA" 
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                />
                <button 
                  disabled={addName.isPending} 
                  className="bg-lime-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-lime-600 disabled:opacity-60 transition-colors"
                >
                  Guardar
                </button>
              </form>

              {/* Lista de nombres permitidos */}
              <div className="border rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-950/50">
                <ul className="max-h-60 overflow-y-auto divide-y dark:divide-slate-800">
                  {currentManagingCategory.allowedNames?.map((n: any) => (
                    <li key={n.id} className="p-3 text-sm flex justify-between items-center hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors">
                      <span className="font-medium text-slate-700 dark:text-slate-300">{n.name}</span>
                      <button 
                        className="text-xs text-rose-500 hover:text-rose-700 font-medium px-2 py-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                        onClick={async () => {
                          if (confirm(`¿Eliminar "${n.name}" del catálogo? (No afectará a los activos que ya lo usan)`)) {
                             try {
                               await removeName.mutateAsync(n.id);
                               toast.success('Activo eliminado de la lista');
                             } catch(err) {
                               toast.error('Error al eliminar');
                             }
                          }
                        }}
                      >
                        Borrar
                      </button>
                    </li>
                  ))}
                  {(!currentManagingCategory.allowedNames || currentManagingCategory.allowedNames.length === 0) && (
                    <li className="p-6 text-center text-slate-500 text-sm">
                      Aún no hay tipos de activos registrados.
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Modal de edición */}
        {editing && (
          <div className="fixed inset-0 bg-black/30 grid place-items-center p-4 z-40">
            <div className="w-full max-w-sm rounded-xl border bg-white dark:bg-slate-900 p-4 space-y-3">
              <h4 className="font-medium">Editar categoría</h4>
              <div className="grid gap-1.5">
                <label className="text-sm">Nombre</label>
                <input
                  className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <label className="text-sm">Código</label>
                <input
                  className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
                  value={editing.code || ''}
                  onChange={(e) => setEditing({ ...editing, code: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <label className="text-sm">Descripción</label>
                <textarea
                  className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
                  value={editing.description || ''}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button className="text-sm px-3 py-2 rounded-lg border" onClick={() => setEditing(null)}>
                  Cancelar
                </button>
                <button
                  className="rounded-xl bg-lime-500 from-brand to-accent text-white px-4 py-2 text-sm hover:bg-blue-900 disabled:opacity-60"
                  onClick={async () => {
                    await upd.mutateAsync({
                      id: editing.id,
                      data: { name: editing.name, code: editing.code || null, description: editing.description || null },
                    });
                    setEditing(null);
                    toast.success('Categoría actualizada');
                  }}
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmación de borrado */}
        {confirmDel && (
          <div className="fixed inset-0 bg-black/30 grid place-items-center p-4 z-40">
            <div className="w-full max-w-sm rounded-xl border bg-white dark:bg-slate-900 p-4 space-y-3">
              <h4 className="font-medium">Eliminar categoría</h4>
              <p className="text-sm text-slate-600">
                ¿Seguro que deseas eliminar <b>{confirmDel.name}</b>?
              </p>
              <div className="flex justify-end gap-2">
                <button className="text-sm px-3 py-2 rounded-lg border" onClick={() => setConfirmDel(null)}>
                  Cancelar
                </button>
                <button
                  className="text-sm px-3 py-2 rounded-lg bg-rose-600 text-white hover:opacity-95"
                  onClick={async () => {
                    try {
                      await del.mutateAsync(confirmDel.id);
                      toast.success('Categoría eliminada');
                    } catch (e: any) {
                      toast.error(e?.response?.data?.error ?? 'No se pudo eliminar');
                    } finally {
                      setConfirmDel(null);
                    }
                  }}
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Ubicaciones (con Sedes debajo)
──────────────────────────────────────────────────────────────────────────── */
function LocationsPanel() {
  const list = useLocations();
  const create = useCreateLocation();
  const sites = useSites();

  const [name, setName] = useState('');
  const [type, setType] = useState('warehouse');
  const [address, setAddress] = useState('');
  const [siteId, setSiteId] = useState('');

  const upd = useUpdateLocation();
  const del = useDeleteLocation();
  const [editing, setEditing] = useState<any | null>(null);
  const [confirmDel, setConfirmDel] = useState<any | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error('El nombre es obligatorio');
    await create.mutateAsync({
      name,
      type: type || null,
      address: address || null,
      siteId: siteId || null,
    });
    setName('');
    setType('warehouse');
    setAddress('');
    setSiteId('');
  }

  return (
    <>
      <div className="grid md:grid-cols-2 gap-4">
        {/* Formulario */}
        <form onSubmit={onSubmit} className="border rounded-xl bg-white dark:bg-slate-900 p-4 space-y-3">
          <h3 className="font-medium">Nueva Ubicación</h3>
          <div className="grid gap-1.5">
            <label className="text-sm">Nombre *</label>
            <input
              className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Bodega Principal"
            />
          </div>
          <div className="grid gap-1.5">
            <label className="text-sm">Tipo</label>
            <select
              className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="warehouse">Bodega</option>
              <option value="office">Oficina</option>
              <option value="client">Cliente</option>
              <option value="other">Otro</option>
            </select>
          </div>
          <div className="grid gap-1.5">
            <label className="text-sm">Dirección</label>
            <input
              className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Calle 1 #2-3"
            />
          </div>
          <div className="grid gap-1.5">
            <label className="text-sm">Sede</label>
            <select
              className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
            >
              <option value="">Sin sede</option>
              {sites.data?.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end">
            <button className="rounded-xl bg-lime-500 from-brand to-accent text-white px-4 py-2 text-sm hover:bg-blue-900 disabled:opacity-60">
              {create.isPending ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>

        {/* Lista */}
        <div className="border rounded-xl bg-white dark:bg-slate-900 p-4">
          <h3 className="font-medium mb-2">Ubicaciones</h3>
          <ul className="divide-y">
            {list.data?.map((l: any) => (
              <li key={l.id} className="py-2 text-sm flex items-center justify-between">
                <div>
                  <div className="font-medium">{l.name}</div>
                  <div className="text-xs text-slate-500">
                    {l.type || '—'}
                    {l.address ? ` · ${l.address}` : ''}
                    {l.site?.name ? ` · ${l.site.name}` : ''}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    className="border rounded-xl  text-blue-900 px-2 py-1 text-xs  hover:border-blue-900"
                    onClick={() => setEditing({ ...l })}
                  >
                    Editar
                  </button>
                  <button className="text-rose-600 text-xs hover:underline" onClick={() => setConfirmDel(l)}>
                    Eliminar
                  </button>
                </div>
              </li>
            ))}
            {(list.data?.length ?? 0) === 0 && (
              <li className="py-6 text-center text-sm text-slate-500">Sin ubicaciones.</li>
            )}
          </ul>

          {/* Modal editar */}
          {editing && (
            <div className="fixed inset-0 bg-black/30 grid place-items-center p-4 z-40">
              <div className="w-full max-w-sm rounded-xl border bg-white dark:bg-slate-900 p-4 space-y-3">
                <h4 className="font-medium">Editar ubicación</h4>
                <div className="grid gap-1.5">
                  <label className="text-sm">Nombre</label>
                  <input
                    className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-sm">Tipo</label>
                  <select
                    className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
                    value={editing.type || ''}
                    onChange={(e) => setEditing({ ...editing, type: e.target.value })}
                  >
                    <option value="">—</option>
                    <option value="warehouse">Bodega</option>
                    <option value="office">Oficina</option>
                    <option value="client">Cliente</option>
                    <option value="other">Otro</option>
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <label className="text-sm">Dirección</label>
                  <input
                    className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
                    value={editing.address || ''}
                    onChange={(e) => setEditing({ ...editing, address: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-sm">Sede</label>
                  <select
                    className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
                    value={editing.siteId || ''}
                    onChange={(e) => setEditing({ ...editing, siteId: e.target.value })}
                  >
                    <option value="">Sin sede</option>
                    {sites.data?.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end gap-2">
                  <button className="text-sm px-3 py-2 rounded-lg border" onClick={() => setEditing(null)}>
                    Cancelar
                  </button>
                  <button
                    className="rounded-xl bg-lime-500 from-brand to-accent text-white px-4 py-2 text-sm hover:bg-sky-900 disabled:opacity-60"
                    onClick={async () => {
                      await upd.mutateAsync({
                        id: editing.id,
                        data: {
                          name: editing.name,
                          type: editing.type || null,
                          address: editing.address || null,
                          siteId: editing.siteId || null,
                        },
                      });
                      setEditing(null);
                      toast.success('Ubicación actualizada');
                    }}
                  >
                    Guardar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Confirmación borrar */}
          {confirmDel && (
            <div className="fixed inset-0 bg-black/30 grid place-items-center p-4 z-40">
              <div className="w-full max-w-sm rounded-xl border bg-white dark:bg-slate-900 p-4 space-y-3">
                <h4 className="font-medium">Eliminar ubicación</h4>
                <p className="text-sm text-slate-600">
                  ¿Seguro que deseas eliminar <b>{confirmDel.name}</b>?
                </p>
                <div className="flex justify-end gap-2">
                  <button className="text-sm px-3 py-2 rounded-lg border" onClick={() => setConfirmDel(null)}>
                    Cancelar
                  </button>
                  <button
                    className="text-sm px-3 py-2 rounded-lg bg-rose-600 text-white hover:opacity-95"
                    onClick={async () => {
                      try {
                        await del.mutateAsync(confirmDel.id);
                        toast.success('Ubicación eliminada');
                      } catch (e: any) {
                        toast.error(e?.response?.data?.error ?? 'No se pudo eliminar');
                      } finally {
                        setConfirmDel(null);
                      }
                    }}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SEDES debajo de Ubicaciones */}
      <SitesPanel />
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Usuarios (login por DOCUMENTO)
──────────────────────────────────────────────────────────────────────────── */
function UsersPanel() {
  const list = useUsers();
  const create = useCreateUser();
  const upd = useUpdateUser();
  const resetPwd = useResetPassword();

  const users = useMemo(() => {
    const d: any = list.data;
    if (Array.isArray(d)) return d;
    return d?.items ?? [];
  }, [list.data]);

  const [f, setF] = useState({
    documentId: '',
    email: '',
    name: '',
    role: 'INVENTARIO',
    password: '',
  });

  const [editing, setEditing] = useState<any | null>(null);
  const [changingPwd, setChangingPwd] = useState<{ id: string; email?: string | null; documentId?: string | null } | null>(null);
  const [newPwd, setNewPwd] = useState('');

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* Crear usuario */}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!f.documentId.trim() || !f.name.trim() || !f.password.trim()) {
            return toast.error('Completa documento, nombre y contraseña');
          }
          try {
            // 👇 CORRECCIÓN AQUÍ: Forzamos el as any para ignorar las reglas viejas
            await create.mutateAsync({
              documentId: f.documentId.trim(),
              email: f.email.trim() || undefined,
              name: f.name.trim(),
              role: f.role,
              password: f.password,
            } as any);
            toast.success('Usuario creado');
            setF({ documentId: '', email: '', name: '', role: 'INVENTARIO', password: '' });
          } catch (e: any) {
            toast.error(e?.response?.data?.error ?? 'No se pudo crear');
          }
        }}
        className="border rounded-xl bg-white dark:bg-slate-900 p-4 space-y-3"
      >
        <h3 className="font-medium">Nuevo usuario</h3>

        <div className="grid gap-1.5">
          <label className="text-sm">Documento *</label>
          <input
            className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
            value={f.documentId}
            onChange={(e) => setF({ ...f, documentId: e.target.value })}
            placeholder="Ej. 1095298077"
          />
        </div>

        <div className="grid gap-1.5">
          <label className="text-sm">Correo (opcional)</label>
          <input
            className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
            value={f.email}
            onChange={(e) => setF({ ...f, email: e.target.value })}
            placeholder="usuario@empresa.com"
          />
        </div>

        <div className="grid gap-1.5">
          <label className="text-sm">Nombre *</label>
          <input
            className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
            placeholder="Nombre y apellido"
          />
        </div>

        <div className="grid gap-1.5">
          <label className="text-sm">Rol *</label>
          <select
            className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
            value={f.role}
            onChange={(e) => setF({ ...f, role: e.target.value })}
          >
            <option value="SUPER_ADMIN">SUPER ADMIN</option>
            <option value="ACTIVOS_FIJOS">ACTIVOS FIJOS</option>
            <option value="INVENTARIO">INVENTARIO</option>
            <option value="ADMINISTRATIVO">ADMINISTRATIVO</option>
            <option value="CONDUCTOR">CONDUCTOR</option>
          </select>
        </div>

        <div className="grid gap-1.5">
          <label className="text-sm">Contraseña *</label>
          <input
            type="password"
            className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
            value={f.password}
            onChange={(e) => setF({ ...f, password: e.target.value })}
            placeholder="••••••••"
          />
        </div>

        <div className="flex justify-end">
          <button className="rounded-xl bg-lime-500 from-brand to-accent text-white px-4 py-2 text-sm hover:bg-blue-900 disabled:opacity-60">
            Guardar
          </button>
        </div>
      </form>

      {/* Lista de usuarios */}
      <div className="border rounded-xl bg-white dark:bg-slate-900 p-4">
        <h3 className="font-medium mb-2">Usuarios</h3>
        <ul className="divide-y">
          {users.map((u: any) => (
            <li key={u.id} className="py-3 text-sm flex items-center justify-between gap-2">
              <div>
                <div className="font-medium">
                  {u.name || u.email || u.documentId}{' '}
                  {u.isActive ? '' : <span className="text-xs text-rose-500">(inactivo)</span>}
                </div>
                <div className="text-xs text-slate-500">
                  Doc: {u.documentId ?? '—'}
                  {u.email ? ` · ${u.email}` : ''} · {u.role}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  className="border rounded-xl  text-blue-900 px-2 py-1 text-xs  hover:border-blue-900"
                  onClick={() => setEditing(u)}
                >
                  Editar
                </button>
                <button
                  className="text-amber-600 text-xs hover:underline"
                  onClick={() => {
                    setChangingPwd({ id: u.id, email: u.email, documentId: u.documentId });
                    setNewPwd('');
                  }}
                >
                  Reset clave
                </button>
                {u.isActive ? (
                  <button
                    className="text-rose-600 text-xs hover:underline"
                    onClick={async () => {
                      await upd.mutateAsync({ id: u.id, data: { isActive: false } });
                    }}
                  >
                    Desactivar
                  </button>
                ) : (
                  <button
                    className="text-emerald-600 text-xs hover:underline"
                    onClick={async () => {
                      await upd.mutateAsync({ id: u.id, data: { isActive: true } });
                    }}
                  >
                    Reactivar
                  </button>
                )}
              </div>
            </li>
          ))}
          {users.length === 0 && (
            <li className="py-6 text-center text-sm text-slate-500">Sin usuarios.</li>
          )}
        </ul>
      </div>

      {/* Modal editar */}
      {editing && (
        <div className="fixed inset-0 bg-black/30 grid place-items-center p-4 z-40">
          <div className="w-full max-w-sm rounded-xl border bg-white dark:bg-slate-900 p-4 space-y-3">
            <h4 className="font-medium">Editar usuario</h4>
            <div className="grid gap-1.5">
              <label className="text-sm">Documento</label>
              <input
                className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
                value={editing.documentId || ''}
                onChange={(e) => setEditing({ ...editing, documentId: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm">Correo (opcional)</label>
              <input
                className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
                value={editing.email || ''}
                onChange={(e) => setEditing({ ...editing, email: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm">Nombre</label>
              <input
                className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
                value={editing.name || ''}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm">Rol</label>
              <select
                className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
                value={editing.role}
                onChange={(e) => setEditing({ ...editing, role: e.target.value })}
              >
                <option value="SUPER_ADMIN">SUPER ADMIN</option>
                <option value="ACTIVOS_FIJOS">ACTIVOS FIJOS</option>
                <option value="INVENTARIO">INVENTARIO</option>
                <option value="ADMINISTRATIVO">ADMINISTRATIVO</option>
                <option value="CONDUCTOR">CONDUCTOR</option>
                <option value="VIEWER">VIEWER</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button className="text-sm px-3 py-2 rounded-lg border" onClick={() => setEditing(null)}>
                Cancelar
              </button>
              <button
                className="rounded-xl bg-lime-500 from-brand to-accent text-white px-4 py-2 text-sm hover:bg-sky-900 disabled:opacity-60"
                onClick={async () => {
                  // 👇 CORRECCIÓN AQUÍ: Forzamos as any en la actualización también
                  await upd.mutateAsync({
                    id: editing.id,
                    data: {
                      documentId: editing.documentId,
                      email: editing.email || undefined,
                      name: editing.name,
                      role: editing.role,
                    } as any, 
                  });
                  setEditing(null);
                  toast.success('Usuario actualizado');
                }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal reset clave */}
      {changingPwd && (
        <div className="fixed inset-0 bg-black/30 grid place-items-center p-4 z-40">
          <div className="w-full max-w-sm rounded-xl border bg-white dark:bg-slate-900 p-4 space-y-3">
            <h4 className="font-medium">Resetear contraseña</h4>
            <p className="text-xs text-slate-500">
              {changingPwd.documentId ? `Doc: ${changingPwd.documentId}` : changingPwd.email || '—'}
            </p>
            <div className="grid gap-1.5">
              <label className="text-sm">Nueva contraseña</label>
              <input
                type="password"
                className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button className="text-sm px-3 py-2 rounded-lg border" onClick={() => setChangingPwd(null)}>
                Cancelar
              </button>
              <button
                className="text-sm px-3 py-2 rounded-lg bg-amber-600 text-white hover:opacity-95"
                onClick={async () => {
                  if (!newPwd.trim()) return toast.error('Escribe la nueva contraseña');
                  await resetPwd.mutateAsync({ id: changingPwd.id, password: newPwd });
                  setChangingPwd(null);
                  toast.success('Contraseña actualizada');
                }}
              >
                Actualizar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}