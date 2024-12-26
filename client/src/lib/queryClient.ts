import { QueryClient } from "@tanstack/react-query";
import { auth } from "./firebase";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch(queryKey[0] as string, {
          headers: token ? {
            Authorization: `Bearer ${token}`,
          } : undefined,
        });

        if (!res.ok) {
          if (res.status >= 500) {
            throw new Error(`${res.status}: ${res.statusText}`);
          }

          throw new Error(`${res.status}: ${await res.text()}`);
        }

        return res.json();
      },
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    }
  },
});