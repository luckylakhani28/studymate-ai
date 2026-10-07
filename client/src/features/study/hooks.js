import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { studyApi } from './studyApi.js';

// Nested under the document's key, so invalidating a document refreshes its study tools too.
const artifactKey = (documentId, type) => ['documents', 'detail', documentId, 'artifacts', type];
const inFlight = (a) => a.status === 'queued' || a.status === 'processing';

export function useArtifacts(documentId, type) {
  return useQuery({
    queryKey: artifactKey(documentId, type),
    queryFn: () => studyApi.list(documentId, type),
    refetchInterval: (query) => (query.state.data?.some(inFlight) ? 2500 : false),
  });
}

export function useRequestArtifact(documentId, type) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) => studyApi.request(documentId, { type, ...body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: artifactKey(documentId, type) }),
  });
}
