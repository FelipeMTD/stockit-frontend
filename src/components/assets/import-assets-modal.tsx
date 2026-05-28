'use client';

import * as React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  UploadCloud,
  XCircle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { toast } from 'sonner';

type BulkResult = {
  created: number;
  updated: number;
  errors: { row: number; tag?: string; error: string }[];
};

const COLUMNS: Array<{ key: string; label: string; required?: boolean }> = [
  { key: 'tag', label: 'Código', required: true },
  { key: 'name', label: 'Nombre', required: true },
  { key: 'categoryName', label: 'Categoría', required: true },
  { key: 'serial', label: 'Serie' },
  { key: 'brand', label: 'Marca' },
  { key: 'model', label: 'Modelo' },
  { key: 'categoryCode', label: 'Código categoría' },
  { key: 'locationName', label: 'Ubicación' },
  { key: 'purchaseDate', label: 'Fecha compra' },
  { key: 'purchaseCost', label: 'Costo compra' },
  { key: 'acquisitionType', label: 'Adquisición' },
  { key: 'supplierName', label: 'Proveedor' },
  { key: 'invoiceNumber', label: 'Factura' },
  { key: 'invimaCode', label: 'Invima' },
  { key: 'riskLevel', label: 'Riesgo' },
  { key: 'warrantyUntil', label: 'Garantía' },
  { key: 'notes', label: 'Observación' },
];

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImported?: () => void;
};

function getFilenameFromHeaders(headers: any) {
  const cd = headers?.['content-disposition'] as string | undefined;
  if (!cd) return null;

  const m = /filename="?([^"]+)"?/i.exec(cd);
  return m?.[1] ?? null;
}

function formatFileSize(size: number) {
  if (!Number.isFinite(size)) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export default function ImportAssetsModal({
  open,
  onOpenChange,
  onImported,
}: Props) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const [file, setFile] = React.useState<File | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [downloading, setDownloading] = React.useState(false);
  const [result, setResult] = React.useState<BulkResult | null>(null);

  const hasErrors = Boolean(result?.errors?.length);

  const resetState = () => {
    setFile(null);
    setResult(null);
    setLoading(false);
    setDownloading(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const handleOpenChange = (value: boolean) => {
    if (!value) {
      handleClose();
      return;
    }

    onOpenChange(true);
  };

  async function downloadTemplate() {
    try {
      setDownloading(true);

      const res = await api.get('/api/assets/bulk/template', {
        responseType: 'blob',
        withCredentials: true,
      });

      const filename =
        getFilenameFromHeaders(res.headers) || 'plantilla_activos.csv';

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');

      a.href = url;
      a.download = filename;

      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      const msg =
        e?.response?.data?.error ||
        e?.message ||
        'No se pudo descargar la plantilla';

      toast.error(msg);
      console.log('GET /api/assets/bulk/template error:', e?.response || e);
    } finally {
      setDownloading(false);
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      toast.error('Selecciona un archivo CSV');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const fd = new FormData();
      fd.append('file', file);

      const { data } = await api.post<BulkResult>('/api/assets/bulk', fd, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        withCredentials: true,
      });

      setResult(data);

      toast.success(
        `Importación completada: ${data.created} creado(s), ${data.updated} actualizado(s)`,
      );

      onImported?.();
    } catch (e: any) {
      const msg =
        e?.response?.data?.error || e?.message || 'No se pudo importar';

      toast.error(msg);
      console.log('POST /api/assets/bulk error:', e?.response || e);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;

    if (!selected) {
      setFile(null);
      return;
    }

    const isCsv =
      selected.type === 'text/csv' ||
      selected.name.toLowerCase().endsWith('.csv');

    if (!isCsv) {
      toast.error('El archivo debe ser CSV');
      event.target.value = '';
      setFile(null);
      return;
    }

    setResult(null);
    setFile(selected);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
<DialogContent className="flex max-h-[92dvh] max-w-3xl flex-col overflow-hidden rounded-3xl border-slate-200 p-0">        <DialogHeader className="border-b border-slate-200 px-5 py-5 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#3C9CD1]/10 text-[#1B3859]">
              <UploadCloud className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <DialogTitle className="text-lg font-semibold text-[#111827]">
                Importar activos
              </DialogTitle>

              <DialogDescription className="mt-1 text-sm leading-6 text-slate-500">
                Carga un archivo CSV para crear o actualizar activos de forma
                masiva.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 pb-6 sm:px-6">
            <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-sm font-semibold text-[#1B3859]">
                  Archivo CSV
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Usa la plantilla oficial para evitar errores de columnas.
                </p>

                <label
                  htmlFor="asset-csv-file"
                  className={[
                    'mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed p-5 text-center transition',
                    file
                      ? 'border-[#54BF5B]/50 bg-[#54BF5B]/5'
                      : 'border-slate-300 bg-white hover:border-[#3C9CD1]/50 hover:bg-[#3C9CD1]/5',
                  ].join(' ')}
                >
                  <input
                    ref={fileInputRef}
                    id="asset-csv-file"
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileChange}
                    className="sr-only"
                  />

                  <div
                    className={[
                      'grid h-12 w-12 place-items-center rounded-2xl',
                      file
                        ? 'bg-[#54BF5B]/15 text-[#16803A]'
                        : 'bg-slate-100 text-slate-500',
                    ].join(' ')}
                  >
                    {file ? (
                      <FileText className="h-5 w-5" />
                    ) : (
                      <UploadCloud className="h-5 w-5" />
                    )}
                  </div>

                  <p className="mt-3 text-sm font-semibold text-[#111827]">
                    {file ? file.name : 'Seleccionar archivo CSV'}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {file
                      ? formatFileSize(file.size)
                      : 'Haz clic aquí para buscar el archivo en tu equipo.'}
                  </p>
                </label>

                {file && (
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      setResult(null);

                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                    className="mt-3 inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                  >
                    Quitar archivo
                  </button>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-[#1B3859]">
                  Plantilla oficial
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Descarga el formato esperado por el sistema antes de cargar
                  datos masivos.
                </p>

                <button
                  type="button"
                  onClick={downloadTemplate}
                  disabled={downloading}
                  className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-[#1B3859] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Download className="h-4 w-4" />
                  {downloading ? 'Descargando…' : 'Descargar plantilla'}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#1B3859]">
                    Campos soportados
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Las etiquetas se muestran en español, pero las claves del
                    CSV siguen siendo técnicas.
                  </p>
                </div>

                <span className="inline-flex w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  {COLUMNS.length} columnas
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {COLUMNS.map(({ key, label, required }) => (
                  <span
                    key={key}
                    title={`Clave CSV: ${key}`}
                    className={[
                      'inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium',
                      required
                        ? 'border-[#54BF5B]/30 bg-[#54BF5B]/10 text-[#1B3859]'
                        : 'border-slate-200 bg-slate-50 text-slate-600',
                    ].join(' ')}
                  >
                    {label}
                    {required && (
                      <span className="text-[10px] font-bold text-[#16803A]">
                        *
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>

            {result && (
              <div
                className={[
                  'rounded-2xl border p-4',
                  hasErrors
                    ? 'border-amber-200 bg-amber-50'
                    : 'border-[#54BF5B]/30 bg-[#54BF5B]/10',
                ].join(' ')}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={[
                      'grid h-10 w-10 shrink-0 place-items-center rounded-2xl',
                      hasErrors
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-[#54BF5B]/15 text-[#16803A]',
                    ].join(' ')}
                  >
                    {hasErrors ? (
                      <AlertTriangle className="h-5 w-5" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#111827]">
                      Resultado de importación
                    </p>

                    <p className="mt-1 text-sm text-slate-600">
                      <b>{result.created}</b> creado(s),{' '}
                      <b>{result.updated}</b> actualizado(s)
                    </p>
                  </div>
                </div>

                {result.errors.length > 0 && (
                  <div className="mt-4 overflow-hidden rounded-2xl border border-amber-200 bg-white">
                    <div className="border-b border-amber-100 px-3 py-2">
                      <p className="text-xs font-semibold text-amber-800">
                        Errores encontrados
                      </p>
                    </div>

                    <div className="max-h-52 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-amber-50 text-amber-900">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold">
                              Fila
                            </th>
                            <th className="px-3 py-2 text-left font-semibold">
                              Código
                            </th>
                            <th className="px-3 py-2 text-left font-semibold">
                              Detalle
                            </th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100">
                          {result.errors.map((er, idx) => (
                            <tr key={`${er.row}-${idx}`}>
                              <td className="px-3 py-2 align-top text-slate-600">
                                {er.row}
                              </td>
                              <td className="px-3 py-2 align-top font-medium text-slate-700">
                                {er.tag || '—'}
                              </td>
                              <td className="px-3 py-2 align-top text-slate-600">
                                {er.error}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="shrink-0 border-t border-slate-200 bg-white px-5 py-4 sm:px-6">
            <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                onClick={handleClose}
                disabled={loading}
              >
                Cerrar
              </button>

              <button
                type="submit"
                disabled={loading || !file}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#1B3859] px-4 text-sm font-semibold text-white transition hover:bg-[#132B45] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <XCircle className="h-4 w-4 animate-pulse" />
                    Importando…
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-4 w-4" />
                    Subir CSV
                  </>
                )}
              </button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}