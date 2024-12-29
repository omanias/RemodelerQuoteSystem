import { createContext, useContext, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export type Company = {
  id: number;
  name: string;
  subdomain: string;
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
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [company, setCompany] = useState<Company | null>(null);
  const { toast } = useToast();
  const hostname = window.location.hostname;
  const isLocalOrWWW = hostname === 'localhost' || hostname === 'www' || hostname.startsWith('.');
  const subdomain = isLocalOrWWW ? null : hostname.split('.')[0];
  const isSubdomainMode = !!subdomain;

  const { data: companyData, isLoading, error } = useQuery<Company, Error>({
    queryKey: ['/api/companies/current'],
    enabled: !!subdomain && subdomain !== 'www' && subdomain !== 'localhost',
    retry: false,
  });

  // Update company state when data changes
  useEffect(() => {
    if (companyData) {
      setCompany(companyData);
    }
  }, [companyData]);

  const value = {
    company,
    setCompany,
    subdomain,
    isSubdomainMode,
    loading: isLoading,
    error: error || null
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