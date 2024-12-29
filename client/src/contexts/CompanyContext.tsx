import { createContext, useContext, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Company } from "@db/schema";
import { useToast } from "@/hooks/use-toast";

interface CompanyContextType {
  company: Company | null;
  setCompany: (company: Company | null) => void;
  subdomain: string | null;
  isSubdomainMode: boolean;
  loading: boolean;
  error: Error | null;
}

const CompanyContext = createContext<CompanyContextType | null>(null);

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

  return (
    <CompanyContext.Provider value={{ 
      company, 
      setCompany, 
      subdomain, 
      isSubdomainMode,
      loading: isLoading,
      error
    }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}