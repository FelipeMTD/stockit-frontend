'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useAsset(id: string) {
  return useQuery({
    queryKey: ['asset', id],
    queryFn: async () => (await api.get(`/api/assets/${id}`)).data,
    enabled: !!id
  });
}

// ✅ NUEVO: Hook para obtener el historial de movimientos de un activo específico
export function useAssetMovements(id: string, page = 1, pageSize = 50) {
  return useQuery({
    queryKey: ['asset-movements', id, page, pageSize],
    queryFn: async () => (await api.get(`/api/movements/by-asset/${id}`, { params: { page, pageSize } })).data,
    enabled: !!id
  });
}

export function useUpdateAsset(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.patch(`/api/assets/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asset', id] });
      qc.invalidateQueries({ queryKey: ['assets'] });
    }
  });
}

export function useDeleteAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/assets/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assets'] });
    }
  });
}