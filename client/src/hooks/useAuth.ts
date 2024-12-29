import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useCompany } from "@/contexts/CompanyContext";

export type AuthUser = {
  id: number;
  email: string;
  name: string;
  role: 'ADMIN' | 'MANAGER' | 'SALES_REP';
  companyId: number;
};

export function useAuth() {
  const [, setLocation] = useLocation();
  const { company, subdomain } = useCompany();

  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      const res = await fetch("/api/auth/user", {
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 401) {
          return null;
        }
        throw new Error(await res.text());
      }

      return res.json() as Promise<AuthUser>;
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...credentials, subdomain }),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setLocation("/");
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setLocation("/login");
    },
  });

  return {
    user,
    loading: isLoading,
    login: loginMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    isAuthenticated: !!user && (!subdomain || (company && user.companyId === company.id)),
  };
}