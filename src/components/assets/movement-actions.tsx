'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
// Importamos el pad de firmas
import SignaturePad from '@/components/ui/signature-pad';

type MovementType =
  | 'STOCK_IN'
  | 'STOCK_OUT'
  | 'ASSIGN'
  | 'RETURN'
  | 'TRANSFER'
  | 'MAINTENANCE_OUT'
  | 'MAINTENANCE_IN';

type Person = {
  id: string;
  fullName: string;
  documentId: string | null;
  department: string | null;
  municipality: string | null;
  address: string | null;
};

type Location = {
  id: string;
  name: string;
};

type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
};

export default function MovementActions({
  assetId,
  currentLocationId, // 1. AÑADIMOS EL PROP PARA SABER DÓNDE ESTÁ EL EQUIPO AHORA
  onDone,
}: {
  assetId: string;
  currentLocationId?: string | null; // 1. AÑADIMOS EL PROP
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);

  // listados
  const [people, setPeople] = useState<Person[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);

  // selección
  const [selPersonId, setSelPersonId] = useState<string>('');
  const [selReturnLocId, setSelReturnLocId] = useState<string>('');
  const [selTransferLocId, setSelTransferLocId] = useState<string>('');
  
  // 2. ESTADO PARA LA FIRMA OBLIGATORIA EN TRASLADOS
  const [selTransferSignature, setSelTransferSignature] = useState<string>('');

  // botones
  const [submitting, setSubmitting] = useState<MovementType | null>(null);

  useEffect(() => {
    if (!open) return;
    if (people.length && locations.length) return;

    const load = async () => {
      try {
        setLoadingLists(true);

        const [p, l] = await Promise.all([
          api.get<Paginated<Person>>('/api/people', {
            params: { pageSize: 200 }, 
            withCredentials: true,
          }),
          api.get<{ items: Location[] }>('/api/catalog/locations', {
            params: { pageSize: 200 },
            withCredentials: true,
          }),
        ]);

        setPeople(p.data.items || []);
        setLocations(l.data.items || (l.data as any) || []);
      } catch (e: any) {
        const url = e?.config?.url;
        const status = e?.response?.status;
        toast.error(
          `No se pudieron cargar listas${status ? ` (HTTP ${status})` : ''}${
            url ? ` — ${url}` : ''
          }`
        );
      } finally {
        setLoadingLists(false);
      }
    };

    load();
  }, [open, people.length, locations.length]);

  // 3. ACTUALIZAMOS EL HELPER PARA ENVIAR ORIGEN Y FIRMA
  const runMovement = async (payload: {
    type: MovementType;
    toPersonId?: string | null;
    toLocationId?: string | null;
    fromLocationId?: string | null; // AÑADIDO
    signatureData?: string | null;  // AÑADIDO
  }) => {
    try {
      setSubmitting(payload.type);
      await api.post(
        '/api/movements',
        {
          assetId,
          type: payload.type,
          toPersonId: payload.toPersonId ?? null,
          toLocationId: payload.toLocationId ?? null,
          fromLocationId: payload.fromLocationId ?? null, // LO ENVIAMOS A ZOD
          signatureData: payload.signatureData ?? null,   // LO ENVIAMOS A ZOD
        },
        { withCredentials: true }
      );
      toast.success('Movimiento registrado');
      setOpen(false);
      setSelPersonId('');
      setSelReturnLocId('');
      setSelTransferLocId('');
      setSelTransferSignature('');
      onDone?.();
    } catch (e: any) {
      const url = e?.config?.url;
      const status = e?.response?.status;
      const msg = e?.response?.data?.error || e?.response?.data?.message || e?.message || 'No se pudo registrar';
      toast.error(`${msg}${status ? ` (HTTP ${status})` : ''}${url ? ` — ${url}` : ''}`);
    } finally {
      setSubmitting(null);
    }
  };

  const disabledAssign = !selPersonId || submitting !== null;
  const disabledReturn = !selReturnLocId || submitting !== null;
  
  // 4. EL BOTÓN REQUIERE UBICACIÓN, FIRMA Y SABER DÓNDE ESTABA EL EQUIPO
  const disabledTransfer = !selTransferLocId || !selTransferSignature || !currentLocationId || submitting !== null;

  const modal = useMemo(() => {
    if (!open) return null;

    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
        <div className="w-full max-w-2xl rounded-2xl border bg-white p-4 shadow-xl dark:bg-slate-900 overflow-y-auto max-h-[90vh]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Registrar movimiento</h3>
            <button
              onClick={() => setOpen(false)}
              className="rounded-full px-3 py-1 text-sm border hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              ✕
            </button>
          </div>

          <div className="mt-2 grid gap-4">
            {/* Asignar a custodio */}
            <div className="rounded-xl border p-4">
              <div className="font-medium mb-2">Asignar a custodio</div>
              <div className="flex gap-2 items-center">
                <select
                  disabled={loadingLists}
                  className="w-full min-w-[260px] rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
                  value={selPersonId}
                  onChange={(e) => setSelPersonId(e.target.value)}
                >
                  <option value="">Selecciona persona</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName} {p.documentId ? ` — ${p.documentId}` : ''}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => runMovement({ type: 'ASSIGN', toPersonId: selPersonId })}
                  disabled={disabledAssign}
                  className="rounded-xl bg-sky-600 text-white px-4 py-2 text-sm hover:bg-sky-700 disabled:opacity-60 whitespace-nowrap"
                >
                  {submitting === 'ASSIGN' ? 'Asignando…' : 'Asignar'}
                </button>
              </div>
            </div>

            {/* Retornar a ubicación (stock) */}
            <div className="rounded-xl border p-4">
              <div className="font-medium mb-2">Retornar a ubicación</div>
              <div className="flex gap-2 items-center">
                <select
                  disabled={loadingLists}
                  className="w-full min-w-[260px] rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
                  value={selReturnLocId}
                  onChange={(e) => setSelReturnLocId(e.target.value)}
                >
                  <option value="">Selecciona ubicación</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() =>
                    runMovement({ type: 'RETURN', toLocationId: selReturnLocId })
                  }
                  disabled={disabledReturn}
                  className="rounded-xl bg-sky-600 text-white px-4 py-2 text-sm hover:bg-sky-700 disabled:opacity-60 whitespace-nowrap"
                >
                  {submitting === 'RETURN' ? 'Retornando…' : 'Retornar'}
                </button>
              </div>
            </div>

            {/* Transferir ubicación (CON FIRMA OBLIGATORIA) */}
            <div className="rounded-xl border p-4">
              <div className="font-medium mb-2">Transferir ubicación</div>
              
              {!currentLocationId && (
                <div className="text-xs text-red-500 mb-2">
                  No se detectó la ubicación actual del activo. No se puede transferir.
                </div>
              )}

              <div className="flex flex-col gap-4">
                <select
                  disabled={loadingLists}
                  className="w-full rounded-xl border px-3 py-2 text-sm bg-white dark:bg-slate-950"
                  value={selTransferLocId}
                  onChange={(e) => setSelTransferLocId(e.target.value)}
                >
                  <option value="">Selecciona nueva ubicación</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>

                {/* Pad de firmas */}
                <div className="border rounded-lg bg-slate-50 dark:bg-slate-900 overflow-hidden">
                  <div className="p-2 text-xs font-medium text-slate-500 border-b flex justify-between items-center">
                    <span>Firma de quien recibe (Obligatorio)</span>
                  </div>
                  <div className="bg-white">
                    <SignaturePad 
                      value={selTransferSignature}
                      onChange={(dataUrl) => setSelTransferSignature(dataUrl || '')}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() =>
                      // 5. ENVIAMOS ORIGEN, DESTINO Y FIRMA
                      runMovement({ 
                        type: 'TRANSFER', 
                        toLocationId: selTransferLocId,
                        fromLocationId: currentLocationId, 
                        signatureData: selTransferSignature 
                      })
                    }
                    disabled={disabledTransfer}
                    className="rounded-xl bg-sky-600 text-white px-6 py-2 text-sm hover:bg-sky-700 disabled:opacity-60"
                  >
                    {submitting === 'TRANSFER' ? 'Transfiriendo…' : 'Transferir'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }, [
    open,
    loadingLists,
    people,
    locations,
    selPersonId,
    selReturnLocId,
    selTransferLocId,
    selTransferSignature, // Añadido a las dependencias
    currentLocationId,    // Añadido a las dependencias
    submitting,
  ]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-2 rounded-lg bg-sky-600 text-white text-sm hover:opacity-95"
        title="Registrar movimiento"
      >
        Acciones
      </button>
      {modal}
    </>
  );
}