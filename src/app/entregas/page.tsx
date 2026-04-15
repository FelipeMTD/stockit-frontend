'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAsset, useAssetMovements } from '@/lib/asset-hooks';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';

// --- TIPOS Y HELPERS ---
type AttachmentType = 'SOPORTE_BAJA' | 'FACTURA_COMPRA';

type Attachment = {
  id: string;
  assetId: string;
  type: AttachmentType;
  fileName: string;
  path: string;
  size: number;
  mime: string;
  createdAt: string;
};

function formatBytes(b?: number) {
  if (!b && b !== 0) return '—';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = b === 0 ? 0 : Math.floor(Math.log(b) / Math.log(1024));
  return `${(b / Math.pow(1024, i)).toFixed(1)} ${u[i]}`;
}

function fDate(d?: string | Date | null) {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('es-CO');
}

function formatCurrency(val?: number | null) {
  if (val == null) return '—';
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(val);
}

function translateMovement(type: string) {
  const map: Record<string, string> = {
    ASSIGN: 'ENTREGA A PACIENTE',
    RETURN: 'RECOGIDA A BODEGA',
    TRANSFER: 'TRASLADO ENTRE BODEGAS',
    STOCK_IN: 'INGRESO INICIAL',
    STOCK_OUT: 'SALIDA DE INVENTARIO',
    MAINTENANCE_OUT: 'SALIDA A MANTENIMIENTO',
    MAINTENANCE_IN: 'REGRESO DE MANTENIMIENTO'
  };
  return map[type] || type;
}

export default function AssetDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter(); 
  const qc = useQueryClient();
  
  const { data: asset, isLoading, error } = useAsset(id);
  const { data: movementsData, isLoading: loadingMovements } = useAssetMovements(id);
  const movements = movementsData?.items || [];

  const [mounted, setMounted] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<any | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [attType, setAttType] = useState<AttachmentType>('FACTURA_COMPRA');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null); 
  const [previewFile, setPreviewFile] = useState<{ url: string, name: string, isImage: boolean } | null>(null);

  // ✅ URL BASE DEFINITIVA E INFALIBLE (Aislada de errores de entorno)
  const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';
  const API_BASE = isLocal ? 'http://localhost:4000' : 'https://stockit-uyvn.onrender.com';

  // ✅ LIMPIADOR DE ENLACES: Filtra errores de DB y asegura que apunte al Backend correcto
  const getSecureUrl = (rawPath: string) => {
    if (!rawPath) return '';
    let clean = rawPath;
    if (clean.startsWith('http')) {
      try { clean = new URL(clean).pathname; } catch (e) {}
    }
    const uIdx = clean.indexOf('/uploads/');
    if (uIdx !== -1) clean = clean.substring(uIdx);
    
    // encodeURI asegura que los espacios o tildes (como en "Guía") no rompan el visor
    return encodeURI(`${API_BASE}/${clean.replace(/^\/+/, '')}`);
  };

  // ✅ CONSULTA DE DETECTIVE: Busca la factura/soporte manual en la tabla Handover
  const handoverQuery = useQuery({
    queryKey: ['handover-details', selectedMovement?.reference, selectedMovement?.notes],
    queryFn: async () => {
      let hId = null;
      if (selectedMovement?.reference?.startsWith('H:')) {
        hId = selectedMovement.reference.replace('H:', '').trim();
      } else if (selectedMovement?.notes?.match(/Generada desde Entregas y Recogidas ([a-zA-Z0-9_-]+)/i)) {
        const match = selectedMovement.notes.match(/Generada desde Entregas y Recogidas ([a-zA-Z0-9_-]+)/i);
        if (match) hId = match[1].trim();
      }
      if (!hId) return null;
      try {
        const res = await api.get(`/api/handover/${hId}`);
        return res.data;
      } catch (e) { return null; }
    },
    enabled: !!selectedMovement,
  });

  const listAttachmentsQ = useQuery({
    queryKey: ['asset-attachments', id],
    queryFn: async () => (await api.get<{ items: Attachment[] }>(`/api/assets/${id}/attachments`)).data,
    enabled: !!id,
  });

  const uploadAttachment = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Selecciona un documento PDF o Imagen');
      const fd = new FormData();
      fd.append('file', file);
      fd.append('type', attType);
      const res = await api.post(`/api/assets/${id}/attachments`, fd, { headers: { 'Content-Type': 'multipart/form-data' }});
      return res.data as Attachment;
    },
    onSuccess: () => {
      toast.success('Anexo cargado exitosamente');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      qc.invalidateQueries({ queryKey: ['asset-attachments', id] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? e?.message ?? 'Error al cargar'),
  });

  const removeAttachment = useMutation({
    mutationFn: async (attId: string) => await api.delete(`/api/attachments/${attId}`),
    onSuccess: () => { toast.success('Anexo eliminado'); qc.invalidateQueries({ queryKey: ['asset-attachments', id] }); },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? e?.message ?? 'Error al eliminar'),
  });

  useEffect(() => { setMounted(true); }, []);

  const handleOpenMovement = (mov: any) => { setSelectedMovement(mov); };

  // ✅ FUNCIÓN UNIFICADA PARA ABRIR VISOR (Usa siempre URL segura)
  const handlePreview = (rawPath: string, name: string) => {
    const url = getSecureUrl(rawPath);
    const isImage = !!url.split('?')[0].toLowerCase().match(/\.(jpg|jpeg|png|gif|svg|webp)$/);
    setPreviewFile({ url, name, isImage });
  };

  if (!mounted) return <div className="p-8 text-center text-slate-500 font-medium">Iniciando...</div>;
  if (isLoading) return <div className="p-10 text-center font-bold animate-pulse text-sky-600">Cargando...</div>;
  if (error || !asset) return <div className="p-10 text-center font-bold text-rose-500">Error al cargar el equipo.</div>;

  const status = String(asset.status || 'IN_STOCK');
  const lifeState = String(asset.lifeState || 'ACTIVE');
  const acqType = String(asset.acquisitionType || '—');
  const riskLevel = String(asset.riskLevel || '—');
  const maintFreq = String(asset.maintenanceFrequency || 'NO APLICA');

  // ✅ EXTRACCIÓN DE DOCUMENTOS (COMODATO Y SOPORTE ADICIONAL)
  let displayNotes = selectedMovement?.notes || '';
  let pdfUrl: string | null = null;
  let soporteManualUrl: string | null = null;
  let soporteManualName = 'Soporte_Adicional.pdf';

  if (selectedMovement) {
    // 1. Buscamos el Comodato [PDF]:
    const explicitPdfMatch = displayNotes.match(/\[PDF\]:\s*(https?:\/\/[^\s]+|\/uploads[^\s]+)/i);

    if (explicitPdfMatch) {
      pdfUrl = explicitPdfMatch[1];
      displayNotes = displayNotes.replace(explicitPdfMatch[0], '').trim();
      displayNotes = displayNotes.replace(/^\|\s*/, '').replace(/\s*\|\s*$/, '').trim();
    } else if (selectedMovement?.reference?.startsWith('H:')) {
      const handoverId = selectedMovement.reference.replace('H:', '').trim();
      pdfUrl = `/uploads/handovers/Comodato_${handoverId}.pdf`;
    }

    // 2. Buscamos el Soporte Manual (Consultado desde Handover)
    if (handoverQuery.data?.attachmentPath) {
      const hPath = handoverQuery.data.attachmentPath;
      if (!hPath.includes('Comodato_')) {
        soporteManualUrl = hPath;
        soporteManualName = handoverQuery.data.attachmentName || 'Soporte_Manual';
      }
    }
  }

  const isOldRoute = !pdfUrl && !soporteManualUrl && selectedMovement?.reference?.startsWith('ROUTE:');
  const attachments = listAttachmentsQ.data?.items || [];

  return (
    <div className="mx-auto max-w-5xl space-y-6 font-poppins text-slate-900 pb-20 pt-4 px-4 relative">
      
      {/* ENCABEZADO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-6 rounded-xl border border-slate-200 shadow-sm gap-4">
        <div className="flex items-center gap-5">
          {asset.photoUrl ? (
            <img src={asset.photoUrl} alt="Equipo" className="w-16 h-16 rounded-lg object-cover border shadow-sm" />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400">
              <svg className="w-6 h-6 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
          )}
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-800 uppercase">{asset.tag || 'SIN TAG'}</h1>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-1">{asset.name || 'EQUIPO NO IDENTIFICADO'}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-3">
          <span className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase shadow-sm border bg-slate-100 text-slate-700 border-slate-300">{status.replace('_', ' ')}</span>
          <button onClick={() => router.push(`/assets/${id}/edit`)} className="bg-sky-600 hover:bg-sky-700 text-white text-[10px] font-bold px-5 py-2 rounded-lg uppercase tracking-widest shadow-sm">Editar Equipo</button>
        </div>
      </div>

      {/* DATOS DEL EQUIPO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b pb-3 mb-5">Especificaciones Técnicas</h2>
            <div className="grid gap-6 sm:grid-cols-2 text-sm">
              <div><p className="text-[10px] font-bold uppercase text-slate-400">Marca</p><p className="font-bold text-slate-800 uppercase">{asset.brand || '—'}</p></div>
              <div><p className="text-[10px] font-bold uppercase text-slate-400">Modelo</p><p className="font-bold text-slate-800 uppercase">{asset.model || '—'}</p></div>
              <div><p className="text-[10px] font-bold uppercase text-slate-400">Número de Serie</p><p className="font-black text-slate-800 uppercase">{asset.serial || '—'}</p></div>
              <div><p className="text-[10px] font-bold uppercase text-slate-400">Registro INVIMA</p><p className="font-bold text-slate-800 uppercase">{asset.invimaCode || '—'}</p></div>
              <div><p className="text-[10px] font-bold uppercase text-slate-400">Nivel de Riesgo</p><p className="font-bold text-slate-800 uppercase">{riskLevel}</p></div>
              <div><p className="text-[10px] font-bold uppercase text-slate-400">Categoría</p><p className="font-bold text-slate-800 uppercase">{asset.category?.name || '—'}</p></div>
            </div>
          </section>

          <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b pb-3 mb-5">Información Financiera</h2>
            <div className="grid gap-6 sm:grid-cols-2 text-sm">
              <div><p className="text-[10px] font-bold uppercase text-slate-400">Tipo de Adquisición</p><p className="font-bold text-slate-800 uppercase">{acqType}</p></div>
              <div><p className="text-[10px] font-bold uppercase text-slate-400">Costo de Compra</p><p className="font-bold text-emerald-600">{formatCurrency(asset.purchaseCost)}</p></div>
              <div><p className="text-[10px] font-bold uppercase text-slate-400">Fecha de Compra</p><p className="font-bold text-slate-800">{fDate(asset.purchaseDate)}</p></div>
              <div><p className="text-[10px] font-bold uppercase text-slate-400">Garantía Hasta</p><p className="font-bold text-slate-800">{fDate(asset.warrantyUntil)}</p></div>
              <div className="sm:col-span-2"><p className="text-[10px] font-bold uppercase text-slate-400">Proveedor</p><p className="font-bold text-slate-800 uppercase">{asset.supplierName || '—'}</p></div>
              <div className="sm:col-span-2"><p className="text-[10px] font-bold uppercase text-slate-400">Factura #</p><p className="font-bold text-slate-800 uppercase">{asset.invoiceNumber || '—'}</p></div>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="bg-sky-50 border-2 border-sky-100 rounded-xl p-6 shadow-sm">
            <h2 className="text-xs font-black text-sky-800 uppercase tracking-widest border-b border-sky-200 pb-3 mb-5">Ubicación Actual</h2>
            <div className="space-y-4 text-sm">
              {status === 'ASSIGNED' ? (
                <>
                  <div><p className="text-[10px] font-bold uppercase text-sky-600 mb-1">Custodio / Paciente</p><p className="font-black text-slate-800 uppercase text-lg leading-tight">{asset.currentCustodian?.fullName || 'NO ASIGNADO'}</p><p className="text-xs font-bold text-slate-500 mt-1">CC: {asset.currentCustodian?.documentId || '—'}</p></div>
                  <div className="border-t border-sky-200 pt-3"><p className="text-[10px] font-bold uppercase text-sky-600 mb-1">Bodega de Origen</p><p className="font-bold text-slate-700 uppercase">{asset.assignedWarehouse?.name || '—'}</p></div>
                </>
              ) : (
                <>
                  <div><p className="text-[10px] font-bold uppercase text-sky-600 mb-1">Bodega Física</p><p className="font-black text-slate-800 uppercase text-lg leading-tight">{asset.currentLocation?.name || asset.assignedWarehouse?.name || 'SIN BODEGA'}</p></div>
                  <div className="border-t border-sky-200 pt-3"><p className="text-[10px] font-bold uppercase text-sky-600 mb-1">Sede Institucional</p><p className="font-bold text-slate-700 uppercase">{asset.site?.name || '—'}</p></div>
                </>
              )}
            </div>
          </section>

          <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b pb-3 mb-5">Mantenimiento</h2>
            <div className="space-y-4 text-sm">
              <div><p className="text-[10px] font-bold uppercase text-slate-400">Frecuencia</p><p className="font-bold text-slate-800 uppercase">{maintFreq}</p></div>
              <div><p className="text-[10px] font-bold uppercase text-slate-400">Estado de Vida Útil</p><p className="font-bold text-slate-800 uppercase">{lifeState}</p></div>
              {asset.notes && (
                 <div className="border-t pt-3"><p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Notas / Observaciones</p><p className="text-xs text-slate-600">{asset.notes}</p></div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* ANEXOS DEL EQUIPO (FACTURAS, ETC) */}
      <div className="mt-10">
        <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-4">Documentos y Anexos</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="bg-slate-50 rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-3">Subir Nuevo Anexo</h3>
            <select value={attType} onChange={(e) => setAttType(e.target.value as AttachmentType)} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm bg-white outline-none">
              <option value="FACTURA_COMPRA">Factura de Compra</option>
              <option value="SOPORTE_BAJA">Soporte de Baja</option>
            </select>
            <input ref={fileInputRef} type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="rounded-xl border border-slate-300 px-3 py-2 text-xs bg-white cursor-pointer w-full" />
            <button onClick={() => uploadAttachment.mutate()} disabled={uploadAttachment.isPending || !file} className="w-full mt-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest py-3 shadow-lg hover:bg-slate-800 disabled:opacity-50">
              {uploadAttachment.isPending ? 'Subiendo...' : 'Guardar Anexo'}
            </button>
          </div>
          
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-3 mb-4 flex justify-between items-center">
              <span>Archivos Guardados</span>
              <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-[10px]">{attachments.length}</span>
            </h3>
            
            {listAttachmentsQ.isLoading ? (
              <div className="text-sm font-bold text-slate-400 uppercase tracking-widest animate-pulse py-4">Cargando anexos...</div>
            ) : attachments.length === 0 ? (
              <div className="text-sm font-medium text-slate-500 border-2 border-dashed border-slate-200 rounded-xl p-8 text-center bg-slate-50">
                No hay documentos anexos cargados para este equipo.
              </div>
            ) : (
              <ul className="space-y-3">
                {attachments.map((att) => {
                  const isDropdownOpen = openDropdown === att.id;
                  const isImg = att.mime?.startsWith('image/') || att.fileName.toLowerCase().match(/\.(jpg|jpeg|png|gif)$/);
                  const downloadUrl = getSecureUrl(att.path);

                  return (
                    <li key={att.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-4 flex items-center justify-between gap-3 hover:shadow-sm transition-shadow relative">
                      <div onClick={() => handlePreview(att.path, att.fileName)} className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer hover:opacity-80 transition-opacity">
                         <div className={`w-10 h-10 shrink-0 rounded-lg flex items-center justify-center font-black ${isImg ? 'bg-sky-100 text-sky-700' : 'bg-rose-100 text-rose-700'}`}>
                           {isImg ? (
                             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                           ) : (
                             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                           )}
                         </div>
                         <div className="min-w-0 flex-1">
                           <p className="text-sm font-bold text-slate-800 uppercase tracking-tight truncate">{att.type === 'SOPORTE_BAJA' ? 'SOPORTE DE BAJA' : 'FACTURA DE COMPRA'}</p>
                           <p className="text-[10px] text-slate-500 font-medium truncate" title={att.fileName}>{att.fileName} • {formatBytes(att.size)} • {new Date(att.createdAt).toLocaleDateString('es-CO')}</p>
                         </div>
                      </div>

                      <div className="relative shrink-0">
                        <button onClick={(e) => { e.stopPropagation(); setOpenDropdown(isDropdownOpen ? null : att.id); }} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors focus:outline-none">
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                        </button>
                        {isDropdownOpen && <div className="fixed inset-0 z-30" onClick={() => setOpenDropdown(null)} />}
                        {isDropdownOpen && (
                          <div className="absolute right-0 top-10 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-40 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                            <a href={downloadUrl} download={att.fileName} onClick={() => setOpenDropdown(null)} className="flex items-center gap-3 px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 w-full text-left">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-sky-600"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                              Descargar Archivo
                            </a>
                            <button onClick={() => { setOpenDropdown(null); if (confirm('¿Estás seguro de eliminar este documento anexo?')) removeAttachment.mutate(att.id); }} className="flex items-center gap-3 px-4 py-3 text-xs font-bold text-rose-600 hover:bg-rose-50 border-t border-slate-100 w-full text-left">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                              Eliminar Anexo
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* HISTORIAL DE MOVIMIENTOS */}
      <div className="mt-10">
        <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-4">Historial de Movimientos</h2>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          
          {loadingMovements ? (
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest animate-pulse">Cargando historial...</p>
          ) : movements.length === 0 ? (
            <p className="text-sm font-medium text-slate-500 border-2 border-dashed border-slate-200 rounded-xl p-8 text-center bg-slate-50">No hay movimientos registrados para este equipo.</p>
          ) : (
            <div className="space-y-6">
              {movements.map((mov: any) => (
                <div key={mov.id} className="relative pl-6 border-l-2 border-slate-100 last:border-l-transparent pb-2 last:pb-0 group">
                  <div className="absolute w-4 h-4 bg-sky-500 rounded-full -left-[9px] top-1 border-[3px] border-white shadow-sm group-hover:bg-sky-600 transition-colors"></div>
                  
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-2 gap-1">
                    <span className="text-[11px] font-black text-sky-700 uppercase tracking-widest bg-sky-50 px-3 py-1 rounded w-fit">
                      {translateMovement(mov.type)}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                      {new Date(mov.createdAt).toLocaleString('es-CO')}
                    </span>
                  </div>

                  <div 
                    onClick={() => handleOpenMovement(mov)}
                    className="bg-white border border-slate-200 p-4 rounded-xl text-sm text-slate-700 mt-2 shadow-sm hover:shadow-md hover:border-sky-300 transition-all cursor-pointer flex justify-between items-center"
                  >
                    <div className="space-y-1 w-full">
                      {mov.type === 'ASSIGN' && <p>Entregado a: <span className="font-bold uppercase text-slate-900">{mov.toPerson?.fullName || '—'}</span></p>}
                      {mov.type === 'RETURN' && <p>Recogido de: <span className="font-bold uppercase text-slate-900">{mov.fromPerson?.fullName || '—'}</span></p>}
                      {mov.type === 'TRANSFER' && <p>Trasladado hacia <span className="font-bold uppercase text-slate-900">{mov.toLocation?.name || '—'}</span></p>}
                      {mov.type === 'STOCK_IN' && <p>Ingresado a: <span className="font-bold uppercase text-slate-900">{mov.toLocation?.name || '—'}</span></p>}
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-2">Registrado por: {mov.createdBy?.name || 'Sistema'}</p>
                    </div>
                    <div className="text-sky-500 font-bold text-[10px] uppercase tracking-widest whitespace-nowrap pl-4 hidden sm:block">
                      Ver Detalles ↗
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ✅ VISOR ÚNICO DE PDF / IMÁGENES GIGANTE (SIN CAJA AMARILLA NI LINKS EN PANTALLA) */}
      {previewFile && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in">
          <div className="bg-slate-800 w-full max-w-5xl h-[95vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden border border-slate-700">
             
             <div className="p-3 sm:p-4 bg-slate-900 flex items-center justify-between shadow-md z-10 border-b border-slate-800">
               <div className="flex items-center gap-2 sm:gap-4">
                 <button onClick={() => setPreviewFile(null)} className="text-[10px] font-bold text-white uppercase tracking-widest hover:text-sky-300 flex items-center gap-1 transition-colors bg-slate-800 px-3 py-2 rounded-lg border border-slate-700">
                   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                   Cerrar Visor
                 </button>
                 <span className="text-white text-[11px] sm:text-xs font-bold truncate max-w-[130px] sm:max-w-md">{previewFile.name}</span>
               </div>
               <a href={previewFile.url} download target="_blank" rel="noopener noreferrer" className="text-[10px] bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 sm:px-5 sm:py-2.5 rounded-lg uppercase font-black tracking-widest transition-colors shadow-lg">
                 Descargar 📥
               </a>
             </div>

             <div className="flex-1 w-full h-full overflow-hidden p-2 sm:p-6 bg-slate-300 flex flex-col items-center justify-center relative">
               {previewFile.isImage ? (
                  <img src={previewFile.url} alt={previewFile.name} className="max-w-full max-h-full object-contain rounded-xl shadow-2xl bg-white" />
               ) : (
                  <>
                    <iframe src={`${previewFile.url}#view=FitH`} className="hidden sm:block w-full flex-1 rounded-xl shadow-2xl bg-white border-0" title={previewFile.name} />
                    
                    {/* VISOR DE RESPALDO PARA CELULAR */}
                    <div className="sm:hidden w-full flex-1 flex flex-col items-center justify-center bg-white rounded-xl shadow-2xl p-6 text-center border-2 border-dashed border-slate-300">
                       <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mb-4">
                         <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                       </div>
                       <h3 className="text-base font-black text-slate-800 mb-2 uppercase">Documento PDF</h3>
                       <p className="text-slate-500 text-xs mb-6">Tu navegador móvil requiere abrir el PDF en otra pestaña para poder leerlo.</p>
                       <a href={previewFile.url} target="_blank" rel="noopener noreferrer" className="w-full bg-sky-600 text-white px-4 py-4 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg">
                          Abrir Documento Original ↗
                       </a>
                    </div>
                  </>
               )}
             </div>
          </div>
        </div>
      )}

      {/* MODAL DE DETALLES DEL MOVIMIENTO */}
      {selectedMovement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden transition-all duration-300">
            
            <div className="p-4 sm:p-5 border-b flex justify-between items-center bg-slate-50">
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-800 uppercase tracking-tight">Detalle del Movimiento</h2>
                <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 tracking-widest uppercase mt-1">Registrado el: {new Date(selectedMovement.createdAt).toLocaleString('es-CO')}</p>
              </div>
              <button onClick={() => setSelectedMovement(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300 font-bold">✕</button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 sm:space-y-6">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tipo de Movimiento</p>
                  <p className="text-sm font-black uppercase text-sky-700">{translateMovement(selectedMovement.type)}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Autor de Gestión</p>
                  <p className="text-sm font-bold text-slate-700 uppercase truncate">{selectedMovement.createdBy?.name || 'Sistema'}</p>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4 shadow-sm">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">Información de Origen y Destino</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Origen</p>
                    {selectedMovement.fromPerson ? (
                       <p className="font-bold text-slate-800 uppercase">{selectedMovement.fromPerson.fullName} <span className="block text-xs text-slate-500 mt-0.5">Doc: {selectedMovement.fromPerson.documentId || '—'}</span></p>
                    ) : selectedMovement.fromLocation ? (
                       <p className="font-bold text-slate-800 uppercase">{selectedMovement.fromLocation.name}</p>
                    ) : (
                       <p className="text-slate-400 uppercase font-medium text-xs">No aplica</p>
                    )}
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Destino</p>
                    {selectedMovement.toPerson ? (
                       <p className="font-bold text-slate-800 uppercase">{selectedMovement.toPerson.fullName} <span className="block text-xs text-slate-500 mt-0.5">Doc: {selectedMovement.toPerson.documentId || '—'}</span></p>
                    ) : selectedMovement.toLocation ? (
                       <p className="font-bold text-slate-800 uppercase">{selectedMovement.toLocation.name}</p>
                    ) : (
                       <p className="text-slate-400 uppercase font-medium text-xs">No aplica</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">Soporte y Validación</h3>
                <div>
                   <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Firma o Trazo de Conformidad</p>
                   {selectedMovement.signatureData?.startsWith('data:image') ? (
                     <img src={selectedMovement.signatureData} alt="Firma" className="h-20 border rounded bg-white p-2 object-contain shadow-sm" />
                   ) : (
                     <p className="text-[10px] font-bold italic text-slate-500 uppercase bg-white p-3 rounded border border-slate-200">{selectedMovement.signatureData || 'Sin firma registrada'}</p>
                   )}
                </div>
                
                {displayNotes && (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Notas Adicionales</p>
                    <p className="text-xs text-slate-600 italic bg-white p-3 rounded border border-slate-200">{displayNotes}</p>
                  </div>
                )}

                {/* ✅ BOTONES DE DOCUMENTOS (COMODATO Y FACTURA MANUAL) */}
                {(pdfUrl || soporteManualUrl) && (
                  <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    
                    {pdfUrl && (
                      <button 
                        onClick={() => handlePreview(pdfUrl as string, 'Comodato_Original.pdf')} 
                        className={`w-full flex items-center justify-center bg-indigo-50 border-2 border-indigo-200 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 transition-all font-black uppercase text-[11px] sm:text-xs tracking-widest py-3 rounded-xl shadow-sm gap-2 ${!soporteManualUrl ? 'sm:col-span-2' : ''}`}
                      >
                         <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                        Ver Comodato
                      </button>
                    )}

                    {soporteManualUrl && (
                      <button 
                        onClick={() => handlePreview(soporteManualUrl as string, soporteManualName)} 
                        className={`w-full flex items-center justify-center bg-emerald-50 border-2 border-emerald-200 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 transition-all font-black uppercase text-[11px] sm:text-xs tracking-widest py-3 rounded-xl shadow-sm gap-2 ${!pdfUrl ? 'sm:col-span-2' : ''}`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                        Soporte Adicional
                      </button>
                    )}

                  </div>
                )}
                
                {isOldRoute && (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                     <p className="text-[10px] text-slate-500 font-medium italic text-center p-3 bg-slate-100 rounded-lg">El comodato de esta ruta antigua no está enlazado directamente.</p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-4 border-t bg-slate-50 flex justify-end">
              <button onClick={() => setSelectedMovement(null)} className="w-full sm:w-auto px-6 py-3 sm:py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg hover:bg-slate-800 transition-colors">
                Cerrar Detalles
              </button>
            </div>
            
          </div>
        </div>
      )}

    </div>
  );
}