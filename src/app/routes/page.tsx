'use client';

import Link from 'next/link';
import { useState, useEffect, useMemo } from 'react';
import { useRoutesList } from '@/lib/hooks';
import Guard from '@/components/auth-guard';

function fDateOnly(d?: string) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function formatStatus(status?: string) {
  const s = String(status || '').toUpperCase().trim();
  if (!s || s === 'UNDEFINED' || s === 'NULL') return 'PROGRAMADA'; 
  if (s.includes('1/2') || s.includes('PENDING_REVIEW')) return 'COMPLETADA 1/2';
  if (s.includes('2/2') || s.includes('COMPLETED') || s === 'COMPLETADA') return 'COMPLETADA 2/2';
  if (s.includes('IN_PROGRESS') || s.includes('CURSO')) return 'EN CURSO';
  if (s.includes('SCHEDULED') || s.includes('PROGRAMADA')) return 'PROGRAMADA';
  if (s.includes('CANCELLED') || s.includes('CANCELADA')) return 'CANCELADA';
  return status;
}

function statusBadgeClass(status?: string) {
  const s = String(status || '').toUpperCase();
  if (s.includes('1/2') || s.includes('PENDING_REVIEW')) return 'bg-blue-50 text-blue-900 border-blue-200 px-3 py-1 rounded-full text-[10px] font-bold border shadow-sm';
  if (s.includes('2/2') || s.includes('COMPLET')) return 'bg-emerald-50 text-emerald-900 border-emerald-200 px-3 py-1 rounded-full text-[10px] font-bold border shadow-sm';
  if (s.includes('CURSO') || s.includes('PROGRESS')) return 'bg-sky-50 text-sky-800 border-sky-200 px-3 py-1 rounded-full text-[10px] font-bold border shadow-sm';
  if (s.includes('PROGRAM') || s.includes('SCHEDULED')) return 'bg-amber-50 text-amber-800 border-amber-200 px-3 py-1 rounded-full text-[10px] font-bold border shadow-sm';
  return 'bg-slate-50 text-slate-600 border-slate-200 px-3 py-1 rounded-full text-[10px] font-bold border shadow-sm';
}

export default function RoutesPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [q, setQ] = useState('');
  const { data, isLoading } = useRoutesList(q);

  const routes: any[] = useMemo(() => {
    if (!data) return [];
    return Array.isArray(data) ? data : ((data as any).items || []);
  }, [data]);

  if (!mounted) return <div className="p-8 text-center text-slate-500 font-bold tracking-widest animate-pulse">CARGANDO RUTAS...</div>;

  return (
    <Guard>
      <section className="space-y-6 p-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-800">Rutas de Servicio</h1>
        
        <input 
          value={q} 
          onChange={(e) => setQ(e.target.value)} 
          placeholder="Buscar por paciente o código..." 
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-900 outline-none shadow-sm"
        />

        <div className="grid gap-4">
          {isLoading && <div className="text-sm text-slate-500 font-bold tracking-widest text-center py-10">OBTENIENDO DATOS...</div>}
          {!isLoading && routes.length === 0 && <div className="text-sm text-slate-500 font-bold tracking-widest text-center py-10">NO HAY RUTAS DISPONIBLES</div>}

          {routes.map((r: any) => {
            const displayStatus = formatStatus(r.status);
            return (
              <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-5 flex justify-between items-center hover:shadow-md transition-all">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-bold text-slate-900">{r.code} - {r.type}</span>
                    <span className={statusBadgeClass(displayStatus)}>{displayStatus}</span>
                  </div>
                  <p className="text-xs text-slate-500 font-bold uppercase truncate">{r.contact} — {r.address}</p>
                  
                  <p className="text-[11px] font-bold text-sky-700 mt-2 bg-sky-50 inline-block px-2 py-1 rounded">
                    Programada para: {fDateOnly(r.scheduledDate)}
                  </p>
                </div>
                <Link href={`/routes/${r.id}`} className="bg-blue-900 text-white px-6 py-2.5 rounded-lg text-xs font-bold shadow-lg hover:bg-blue-950 transition-colors uppercase tracking-wider shrink-0 ml-4">
                  GESTIONAR
                </Link>
              </div>
            );
          })}
        </div>
      </section>
    </Guard>
  );
}