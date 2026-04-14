'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useRoute } from '@/lib/hooks';
import { api } from '@/lib/api';

function parseSignatureNotes(notes: string) {
  if (!notes) return null;
  const parts = notes.split(' || ');
  const sigPart = [...parts].reverse().find(p => p.includes('[STEP:1/2]'));
  const auditPart = [...parts].reverse().find(p => p.includes('[STEP:2/2]'));
  if (!sigPart) return null;

  const extract = (str: string, key: string) => {
    const search = `${key}:`;
    const start = str.indexOf(search);
    if (start === -1) return '';
    const end = str.indexOf('|', start);
    return (end === -1 ? str.slice(start + search.length) : str.slice(start + search.length, end)).trim();
  };

  const driverAssetsStr = extract(sigPart, 'Activos');
  const driverAssets = driverAssetsStr ? driverAssetsStr.split(',').map(s => s.trim()).filter(Boolean) : [];
  
  const auditAssetsStr = auditPart ? extract(auditPart, 'AuditFinal') : null;
  const finalAssets = auditAssetsStr !== null ? (auditAssetsStr ? auditAssetsStr.split(',').map(s => s.trim()).filter(Boolean) : []) : driverAssets;

  return { 
    name: extract(sigPart, 'Firma') || '—', 
    id: extract(sigPart, 'ID') || '—', 
    relation: extract(sigPart, 'Parentesco') || '—',
    email: extract(sigPart, 'Email') || '—', // ✅ SE EXTRAE EL EMAIL
    signatureData: extract(sigPart, 'FirmaImagenDataURL') || null,
    driverAssets,
    finalAssets
  };
}

const RELATIONS = ['PACIENTE', 'FAMILIAR', 'CUIDADOR', 'HIJO/A', 'PADRE/MADRE', 'OTRO'];

export default function RouteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useRoute(id);
  const [userRole, setUserRole] = useState<string | null | undefined>(undefined);
  const [initialized, setInitialized] = useState(false);
  const [collectedAssetIds, setCollectedAssetIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  
  const [whoSigns, setWhoSigns] = useState('');
  const [signerId, setSignerId] = useState('');
  const [relation, setRelation] = useState('');
  const [email, setEmail] = useState(''); // ✅ ESTADO PARA EL EMAIL
  
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawing = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    setUserRole(localStorage.getItem('user_role')?.toUpperCase() || null);
  }, []);

  const displayStatus = String((data as any)?.status || '').toUpperCase();
  const isPendingReview = displayStatus.includes('1/2') || displayStatus === 'PENDING_REVIEW';
  const isCompletedFinal = displayStatus.includes('2/2') || displayStatus === 'COMPLETED';
  const isConductor = userRole === 'CONDUCTOR';
  
  const sigData = parseSignatureNotes((data as any)?.notes || '');
  const allItems = (data as any)?.stop?.items || [];

  useEffect(() => {
    if (!data?.stop?.items || userRole === undefined || initialized) return;
    
    if (isConductor && !isPendingReview && !isCompletedFinal) {
      setCollectedAssetIds(data.stop.items.map((it: any) => it.asset.id));
      setInitialized(true);
    } else if (!isConductor && isPendingReview && sigData) {
      setCollectedAssetIds(sigData.driverAssets);
      setInitialized(true);
    }
  }, [data, isConductor, isPendingReview, isCompletedFinal, sigData, initialized, userRole]);

  const getCoordinates = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const startDrawing = (e: any) => {
    if (e.cancelable) e.preventDefault();
    isDrawing.current = true;
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.strokeStyle = '#0f172a'; }
  };

  const draw = (e: any) => {
    if (e.cancelable) e.preventDefault();
    if (!isDrawing.current) return;
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) { ctx.lineTo(x, y); ctx.stroke(); setHasSignature(true); }
  };

  const stopDrawing = () => { isDrawing.current = false; };
  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) { ctx.clearRect(0, 0, canvas.width, canvas.height); setHasSignature(false); }
  };

  const handleComplete1_2 = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!whoSigns.trim() || !signerId.trim() || !relation || !email.trim()) {
      return alert('Debe completar todos los datos de quien recibe, incluyendo el correo.');
    }
    if (!hasSignature || !canvasRef.current) {
      return alert('Debe proporcionar la firma digital para continuar.');
    }

    setSaving(true);
    try {
      const signatureBase64 = canvasRef.current.toDataURL('image/png');
      // ✅ EL EMAIL SE GUARDA EN LAS NOTAS PARA QUE EL BACKEND LO TOME
      const detailNotes = `[STEP:1/2] | Firma: ${whoSigns.trim()} | ID: ${signerId.trim()} | Parentesco: ${relation} | Email: ${email.trim()} | Activos: ${collectedAssetIds.join(',')} | FirmaImagenDataURL: ${signatureBase64}`;
      
      await api.patch(`/api/routes/${id}`, {
        status: 'PENDING_REVIEW',
        notes: [(data as any).notes || '', detailNotes].filter(Boolean).join(' || '),
        collectedAssetIds
      });
      window.location.replace('/routes');
    } catch (err) { alert('Error al guardar gestión'); setSaving(false); }
  };

  const handleFinalClose = async () => {
    setSaving(true);
    try {
      const auditNotes = `[STEP:2/2] | AuditFinal: ${collectedAssetIds.join(',')}`;
      await api.patch(`/api/routes/${id}`, {
        status: 'COMPLETED',
        notes: [(data as any).notes || '', auditNotes].filter(Boolean).join(' || '),
        collectedAssetIds
      });
      window.location.replace('/routes');
    } catch (err) { alert('Error al cerrar ruta'); setSaving(false); }
  };

  if (isLoading || !data || userRole === undefined) return <div className="p-10 text-center font-poppins font-bold animate-pulse text-slate-400 uppercase tracking-widest">Validando Plataforma...</div>;

  return (
    <div className="mx-auto max-w-5xl space-y-6 font-poppins text-slate-900 pb-20 pt-4 px-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-6 rounded-xl border border-slate-200 shadow-sm gap-4">
        <div><h1 className="text-2xl font-bold tracking-tight text-slate-800 uppercase">{(data as any).code}</h1><p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mt-1">Gestión Logística</p></div>
        <div className={`w-fit rounded-full border px-5 py-2 text-[10px] font-black uppercase shadow-sm ${isPendingReview ? 'border-sky-200 bg-sky-50 text-sky-700' : isCompletedFinal ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>{displayStatus}</div>
      </div>

      <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b pb-3 mb-5">Información del Paciente Oficial</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <div><p className="text-[10px] font-bold uppercase text-slate-400">Titular</p><p className="text-sm font-bold text-slate-800 uppercase">{(data as any).contact}</p></div>
          <div><p className="text-[10px] font-bold uppercase text-slate-400">Documento</p><p className="text-sm font-semibold text-slate-800">{(data as any).contactDoc}</p></div>
          <div className="sm:col-span-2 border-t border-slate-100 pt-4"><p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Dirección Exacta</p><p className="text-lg font-bold text-sky-950 uppercase leading-tight">{(data as any).address}</p></div>
        </div>
      </section>

      {!isConductor && !isPendingReview && !isCompletedFinal && (
        <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b pb-3 mb-4">Equipos Programados para esta Ruta</h2>
          <div className="grid gap-3">
            {allItems.map((it: any) => (
              <div key={it.id} className="flex justify-between items-center py-3 border-b border-slate-50 last:border-0">
                <span className="text-sm font-bold text-slate-700">{it.asset.tag} <span className="text-xs font-medium text-slate-500 uppercase ml-1">• {it.asset.name}</span></span>
                <span className={`text-[9px] font-black uppercase px-2 py-1 rounded border shadow-sm ${it.action === 'DELIVER' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                  {it.action === 'DELIVER' ? 'A ENTREGAR' : 'A RECOGER'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {isConductor && isPendingReview && sigData && (
        <section className="bg-sky-50 border border-sky-100 rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-sky-900 uppercase tracking-widest border-b border-sky-200 pb-2">Resumen de tu Gestión</h2>
          <div className="grid gap-3">
            {allItems.map((it: any) => {
              const wasReported = sigData.driverAssets.includes(it.asset.id);
              return (
                <div key={it.id} className="flex justify-between items-center py-2 border-b border-slate-200 last:border-0">
                  <span className={`text-sm ${wasReported ? 'font-bold' : 'text-slate-400 line-through'}`}>{it.asset.tag} - {it.asset.name}</span>
                  <span className={`text-[9px] font-black px-2 py-1 rounded ${wasReported ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>{wasReported ? '✓ REPORTADO' : '✕ OMITIDO'}</span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {isConductor && !isPendingReview && !isCompletedFinal && (
        <form onSubmit={handleComplete1_2} className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-xs font-bold text-slate-400 uppercase mb-4 tracking-widest">1. Validación de Equipos</h2>
            <div className="space-y-3">
              {allItems.map((it: any) => {
                const isChecked = collectedAssetIds.includes(it.asset.id);
                return (
                  <label key={it.id} className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer ${isChecked ? 'border-sky-600 bg-sky-50 shadow-sm' : 'border-slate-100 opacity-60'}`}>
                    <div className="flex items-center gap-4">
                      <input type="checkbox" className="h-5 w-5 rounded border-slate-300 text-sky-600 focus:ring-sky-600" checked={isChecked} onChange={e => {
                        if (e.target.checked) setCollectedAssetIds([...collectedAssetIds, it.asset.id]);
                        else setCollectedAssetIds(collectedAssetIds.filter(id => id !== it.asset.id));
                      }} />
                      <div className="flex flex-col"><span className={`font-bold text-sm ${!isChecked && 'text-slate-400 line-through'}`}>{it.asset.tag}</span><span className="text-[10px] uppercase text-slate-500">{it.asset.name}</span></div>
                    </div>
                    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded ${it.action === 'DELIVER' ? 'bg-indigo-100 text-indigo-800' : 'bg-emerald-100 text-emerald-800'}`}>{it.action === 'DELIVER' ? 'Entrega' : 'Recogida'}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
            <h2 className="text-xs font-bold text-slate-400 uppercase border-b pb-3 tracking-widest">2. Registro de Recepción Obligatorio</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <input 
                required 
                inputMode="text"
                className="w-full border-b-2 p-3 text-sm outline-none focus:border-sky-600 bg-slate-50 uppercase font-bold" 
                placeholder="Nombre completo quien firma" 
                value={whoSigns} 
                onChange={e => setWhoSigns(e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, ''))} 
              />
              <input 
                required 
                inputMode="numeric"
                className="w-full border-b-2 p-3 text-sm outline-none focus:border-sky-600 bg-slate-50" 
                placeholder="Cédula / Documento (Solo números)" 
                value={signerId} 
                onChange={e => setSignerId(e.target.value.replace(/\D/g, ''))} 
              />
              <select required className="w-full border-b-2 p-3 text-sm bg-slate-50 focus:border-sky-600 outline-none" value={relation} onChange={e => setRelation(e.target.value)}>
                <option value="">Vínculo / Parentesco...</option>
                {RELATIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              
              {/* ✅ NUEVO CAMPO DE CORREO ELECTRÓNICO */}
              <input 
                required 
                type="email"
                className="w-full border-b-2 p-3 text-sm outline-none focus:border-sky-600 bg-slate-50" 
                placeholder="Correo electrónico (Comodato)" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
              />

            </div>
            <div className="mt-8">
              <div className="flex justify-between mb-3"><label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Firma Digital Obligatoria</label>{hasSignature && <button type="button" onClick={clearSignature} className="text-[10px] font-bold text-rose-600 uppercase underline">Borrar Firma</button>}</div>
              <div className="relative overflow-hidden rounded-xl border-2 border-slate-300 bg-slate-100 p-2 shadow-inner"><canvas ref={canvasRef} width={800} height={300} className="w-full h-52 cursor-crosshair touch-none bg-white rounded shadow-sm" onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} /></div>
            </div>
            <button type="submit" disabled={saving} className="w-full bg-sky-600 text-white py-4 rounded-xl font-bold uppercase text-xs tracking-[0.2em] shadow-lg hover:bg-sky-700 transition-all active:scale-95">{saving ? 'ENVIANDO...' : 'FINALIZAR GESTIÓN 1/2'}</button>
          </div>
        </form>
      )}

      {!isConductor && isPendingReview && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-5">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b pb-2">Reporte en Calle (Conductor)</h2>
            
            <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
              <p className="text-[10px] font-bold text-sky-600 uppercase mb-1">Quien Firmó Físicamente</p>
              <p className="text-lg font-black text-slate-800 uppercase">{sigData?.name}</p>
              <p className="text-xs font-bold uppercase text-slate-500">{sigData?.relation} • CC: {sigData?.id}</p>
              
              {/* ✅ MUESTRA EL EMAIL EN EL REPORTE DE CALLE */}
              {sigData?.email && sigData.email !== '—' && (
                <p className="text-[11px] font-bold text-sky-700 lowercase mt-1 bg-sky-100/50 w-fit px-2 py-0.5 rounded border border-sky-200">
                  {sigData.email}
                </p>
              )}
              
              {sigData?.signatureData && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <p className="text-[9px] font-bold text-slate-400 uppercase mb-2">Firma Capturada:</p>
                  <img src={sigData.signatureData} alt="Firma del receptor" className="h-24 bg-white border border-slate-200 rounded-lg p-2 shadow-sm" />
                </div>
              )}
            </div>

          </section>

          <section className="bg-sky-50 border-2 border-sky-100 rounded-xl p-6 shadow-sm sticky top-24 space-y-6">
            <h2 className="text-xs font-bold text-sky-800 uppercase border-b border-sky-200 pb-2 tracking-widest">Validación de Bodega (Final)</h2>
            <p className="text-[11px] font-bold text-sky-700/80 uppercase leading-relaxed">Marca los activos que llegaron físicamente a bodega para actualizar el inventario y enviar el comodato al paciente.</p>
            <div className="space-y-3">
              {allItems.map((it: any) => {
                const isChecked = collectedAssetIds.includes(it.asset.id);
                return (
                  <label key={it.id} className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all bg-white cursor-pointer ${isChecked ? 'border-sky-600 ring-2 ring-sky-50 shadow-md' : 'border-slate-100 opacity-60 shadow-inner'}`}>
                    <input type="checkbox" className="h-5 w-5 rounded border-slate-300 text-sky-700" checked={isChecked} onChange={e => {
                        if (e.target.checked) setCollectedAssetIds([...collectedAssetIds, it.asset.id]);
                        else setCollectedAssetIds(collectedAssetIds.filter(id => id !== it.asset.id));
                    }} />
                    <div className="flex flex-col text-sm font-bold"><span>{it.asset.tag}</span><span className="text-[10px] text-slate-500 uppercase">{it.asset.name}</span></div>
                  </label>
                )
              })}
            </div>
            <button onClick={handleFinalClose} disabled={saving} className="w-full bg-slate-900 text-white py-5 rounded-xl font-black uppercase text-xs tracking-[0.2em] shadow-xl hover:bg-black active:scale-95 transition-all">AUDITAR Y CERRAR RUTA</button>
          </section>
        </div>
      )}

      {isCompletedFinal && sigData && (
        <section className="bg-white rounded-2xl border border-emerald-100 shadow-2xl overflow-hidden animate-in fade-in duration-500">
          <div className="bg-emerald-600 p-6 text-white flex items-center justify-between shadow-lg"><div><h2 className="text-xl font-black uppercase tracking-tighter">Servicio Finalizado</h2><p className="text-[10px] font-bold opacity-80 uppercase tracking-widest">Comodato enviado y ruta cerrada</p></div><div className="h-12 w-12 bg-white/20 rounded-full flex items-center justify-center text-2xl font-black">✓</div></div>
          <div className="p-8 grid md:grid-cols-2 gap-10 bg-slate-50/50">
            <div className="space-y-6">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">Comprobante de Recepción</h3>
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <div><p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Paciente Titular</p><p className="text-sm font-bold text-slate-700 uppercase">{(data as any).contact}</p></div>
                <div className="border-t border-slate-100 pt-3"></div>
                <div>
                  <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Quien Recibió (Firma)</p>
                  <p className="text-xl font-black text-slate-800 uppercase">{sigData.name}</p>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">{sigData.relation} • CC: {sigData.id}</p>
                  
                  {/* ✅ MUESTRA EL EMAIL EN EL RESUMEN FINAL */}
                  {sigData.email && sigData.email !== '—' && (
                    <p className="text-xs font-bold text-emerald-600 lowercase mt-1 bg-emerald-50 w-fit px-2 py-0.5 rounded border border-emerald-200">{sigData.email}</p>
                  )}
                </div>
                
                {sigData.signatureData && (
                  <div className="mt-5 pt-4 border-t border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-2">Firma de Conformidad:</p>
                    <img src={sigData.signatureData} alt="Firma Final" className="h-20 object-contain" />
                  </div>
                )}
              </div>
            </div>
            
            <div className="space-y-6">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">Inventario Consolidado</h3>
              <div className="grid gap-2">
                {allItems.map((it: any) => {
                  const wasFinalized = sigData.finalAssets.includes(it.asset.id);
                  return (
                    <div key={it.id} className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${wasFinalized ? 'bg-emerald-50 border-emerald-200 shadow-sm' : 'bg-white border-slate-100 opacity-60'}`}>
                      <div className="flex flex-col">
                        <span className={`text-sm font-bold ${!wasFinalized ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{it.asset.tag} <span className="text-xs font-medium text-slate-500 uppercase ml-1">• {it.asset.name}</span></span>
                        <span className="text-[9px] font-black uppercase text-slate-500 mt-0.5">{it.action === 'DELIVER' ? 'Entregado' : 'Recogido'}</span>
                      </div>
                      <span className={`flex items-center justify-center w-7 h-7 rounded-full border shadow-sm ${wasFinalized ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                        {wasFinalized ? '✓' : '✕'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}