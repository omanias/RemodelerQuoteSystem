import { createContext, useContext, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Company } from "@db/schema";

interface CompanyContextType {
  company: Company | null;
  setCompany: (company: Company | null) => void;
  subdomain: string | null;
}

const CompanyContext = createContext<CompanyContextType | null>(null);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [company, setCompany] = useState<Company | null>(null);
  const subdomain = window.location.hostname.split('.')[0];

  const { data: companyData } = useQuery<Company>({
    queryKey: ['/api/companies/current'],
    enabled: !!subdomain && subdomain !== 'www' && subdomain !== 'localhost',
  });

  useEffect(() => {
    if (companyData) {
      setCompany(companyData);
    }
  }, [companyData]);

  return (
    <CompanyContext.Provider value={{ company, setCompany, subdomain }}>
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