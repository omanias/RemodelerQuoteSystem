import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";

export type AuthUser = {
  id: number;
  email: string;
  name: string;
  role: 'ADMIN' | 'MANAGER' | 'SALES_REP';
  companyId: number;
  status: 'ACTIVE' | 'INACTIVE';
  companyName?: string;
};

type LoginCredentials = {
  companyId: number;
  email: string;
  password: string;
};

export function useAuth() {
  const [, setLocation] = useLocation();

  // Enhanced auth state management with proper error handling
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/auth/user", {
          credentials: "include",
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
        });

        if (!res.ok) {
          if (res.status === 401) {
            return null;
          }
          throw new Error(await res.text());
        }

        return res.json() as Promise<AuthUser>;
      } catch (error) {
        console.error('Auth check error:', error);
        return null;
      }
    },
    retry: false,
    gcTime: 0, // Disable garbage collection
    staleTime: 30000 // Consider data stale after 30 seconds
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      if (!credentials.companyId || !credentials.email || !credentials.password) {
        throw new Error("Company ID, email and password are required");
      }

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify(credentials),
        credentials: "include",
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Login failed");
      }

      return res.json() as Promise<AuthUser>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/auth/user"], data);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setLocation("/");
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/user"], null);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setLocation("/login");
    },
  });

  return {
    user,
    loading: isLoading,
    login: loginMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    isAuthenticated: !!user,
    isLoading: loginMutation.isPending || logoutMutation.isPending,
    error: loginMutation.error || logoutMutation.error,
  };
}