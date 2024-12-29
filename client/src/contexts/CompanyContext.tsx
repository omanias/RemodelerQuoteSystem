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
  const [company, setCompanyState] = useState<Company | null>(() => {
    // Try to load from localStorage on mount
    const stored = localStorage.getItem('selectedCompany');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (error) {
        localStorage.removeItem('selectedCompany');
      }
    }
    return null;
  });

  const { toast } = useToast();

  // Parse subdomain from hostname
  const hostname = window.location.hostname;
  const isReplit = hostname.includes('.replit.dev');
  const isLocalOrReplit = hostname === 'localhost' || isReplit;
  const subdomain = isLocalOrReplit ? null : hostname.split('.')[0];
  const isSubdomainMode = !!subdomain;

  // Only fetch company data if we're in subdomain mode
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
    enabled: isSubdomainMode,
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

  // Update company state when data changes in subdomain mode
  useEffect(() => {
    if (isSubdomainMode && companyData) {
      setCompanyState(companyData);
    }
  }, [isSubdomainMode, companyData]);

  const setCompany = (newCompany: Company | null) => {
    if (newCompany) {
      localStorage.setItem('selectedCompany', JSON.stringify(newCompany));
    } else {
      localStorage.removeItem('selectedCompany');
    }
    setCompanyState(newCompany);
  };

  const clearCompany = () => {
    localStorage.removeItem('selectedCompany');
    setCompanyState(null);
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