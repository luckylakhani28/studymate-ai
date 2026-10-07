import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        const status = error?.response?.status;
        if (status && status < 500) return false; // 4xx won't fix itself on retry
        return failureCount < 2; // network errors and 5xx: two retries with backoff
      },
    },
  },
});
