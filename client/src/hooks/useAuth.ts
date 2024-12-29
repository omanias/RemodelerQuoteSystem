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
  status: 'ACTIVE' | 'INACTIVE';
};

export function useAuth() {
  const [, setLocation] = useLocation();
  const { company, subdomain, isSubdomainMode } = useCompany();

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
      // In non-subdomain mode, require company selection before login
      if (!isSubdomainMode && !company) {
        throw new Error("Please select a company before logging in");
      }

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
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

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      // After logout, redirect to company-specific login or company selector
      if (company && !isSubdomainMode) {
        setLocation(`/companies/${company.id}/login`);
      } else {
        setLocation("/");
      }
    },
  });

  return {
    user,
    loading: isLoading,
    login: async (credentials: { email: string; password: string }) => {
      await loginMutation.mutateAsync(credentials);
      // After successful login and user data refresh, navigate to dashboard
      setLocation("/");
    },
    logout: logoutMutation.mutateAsync,
    // Only consider user authenticated if:
    // 1. User exists AND
    // 2. Either not in subdomain mode OR company matches user's company
    isAuthenticated: !!user && (!isSubdomainMode || (company && user.companyId === company.id)),
  };
}