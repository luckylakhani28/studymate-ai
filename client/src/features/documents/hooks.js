import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { documentsApi } from './documentsApi.js';

// Query-key factory: one place defines keys, so invalidation can't miss a variant.
export const documentKeys = {
  all: ['documents'],
  list: (params) => ['documents', 'list', params],
  detail: (id) => ['documents', 'detail', id],
  chunks: (id) => ['documents', 'detail', id, 'chunks'],
};

const isActive = (doc) => doc.status === 'queued' || doc.status === 'processing';

export function useDocuments(params = { limit: 50 }) {
  return useQuery({
    queryKey: documentKeys.list(params),
    queryFn: () => documentsApi.list(params),
    // Poll only while something is in flight; stops by itself once every document settles.
    refetchInterval: (query) => (query.state.data?.documents.some(isActive) ? 2500 : false),
  });
}

export function useDocument(id) {
  return useQuery({
    queryKey: documentKeys.detail(id),
    queryFn: () => documentsApi.get(id),
    refetchInterval: (query) => (query.state.data && isActive(query.state.data) ? 2500 : false),
  });
}

export function useDocumentChunks(id, enabled) {
  return useInfiniteQuery({
    queryKey: documentKeys.chunks(id),
    queryFn: ({ pageParam }) => documentsApi.chunks(id, { page: pageParam, limit: 20 }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined,
    enabled,
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: documentsApi.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: documentKeys.all }),
  });
}

export function useReprocessDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: documentsApi.reprocess,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: documentKeys.all }),
  });
}
