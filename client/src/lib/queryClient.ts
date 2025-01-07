import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        try {
          const res = await fetch(queryKey[0] as string, {
            credentials: "include",
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
          });

          if (!res.ok) {
            const errorText = await res.text();
            if (res.status >= 500) {
              console.error(`Server error: ${res.status}`, errorText);
              throw new Error(`Server error: ${res.status}`);
            }

            throw new Error(errorText || `Request failed with status ${res.status}`);
          }

          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            return res.json();
          }

          throw new Error('Response is not JSON');
        } catch (error) {
          console.error('Query error:', error);
          throw error;
        }
      },
      retry: (failureCount, error) => {
        if (error instanceof Error && error.message.includes('401')) {
          return false; // Don't retry auth failures
        }
        return failureCount < 2;
      },
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
    },
    mutations: {
      retry: false,
      onError: (error) => {
        console.error('Mutation error:', error);
      }
    }
  },
});