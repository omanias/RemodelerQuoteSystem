import { createContext, useContext, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export type Company = {
  id: number;
  name: string;
  subdomain: string;
  settings?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
};

interface CompanyContextType {
  company: Company | null;
  setCompany: (company: Company | null) => void;
  subdomain: string | null;
  isSubdomainMode: boolean;
  loading: boolean;
  error: Error | null;
  clearCompany: () => void;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [company, setCompany] = useState<Company | null>(null);
  const { toast } = useToast();
  const hostname = window.location.hostname;
  const isLocalOrWWW = hostname === 'localhost' || hostname === 'www' || hostname.startsWith('.');
  const subdomain = isLocalOrWWW ? null : hostname.split('.')[0];
  const isSubdomainMode = !!subdomain;

  const { data: companyData, isLoading, error } = useQuery({
    queryKey: ['/api/companies/current'],
    queryFn: async () => {
      const response = await fetch('/api/companies/current', {
        credentials: 'include'
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text);
      }
      return response.json() as Promise<Company>;
    },
    enabled: !!subdomain,
    retry: false,
  });

  // Show errors only in subdomain mode
  useEffect(() => {
    if (isSubdomainMode && error) {
      toast({
        title: "Company Error",
        description: error instanceof Error ? error.message : "Failed to load company",
        variant: "destructive",
      });
    }
  }, [isSubdomainMode, error, toast]);

  // Update company state when data changes
  useEffect(() => {
    if (companyData) {
      setCompany(companyData);
    }
  }, [companyData]);

  const clearCompany = () => {
    setCompany(null);
  };

  const value: CompanyContextType = {
    company,
    setCompany,
    subdomain,
    isSubdomainMode,
    loading: isLoading,
    error: error instanceof Error ? error : null,
    clearCompany
  };

  return (
    <CompanyContext.Provider value={value}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}