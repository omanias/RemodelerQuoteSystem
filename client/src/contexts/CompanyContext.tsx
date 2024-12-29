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
  setCompany: (company: Company | null) => Promise<void>;
  subdomain: string | null;
  isSubdomainMode: boolean;
  loading: boolean;
  error: Error | null;
  clearCompany: () => void;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [company, setCompanyState] = useState<Company | null>(null);
  const [isSettingCompany, setIsSettingCompany] = useState(false);
  const { toast } = useToast();

  // Parse subdomain from hostname
  const hostname = window.location.hostname;
  const isLocalOrWWW = hostname === 'localhost' || hostname === 'www' || hostname.startsWith('.');
  const subdomain = isLocalOrWWW ? null : hostname.split('.')[0];
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

  // Update company state when data changes
  useEffect(() => {
    if (companyData) {
      setCompanyState(companyData);
    }
  }, [companyData]);

  const setCompany = async (newCompany: Company | null): Promise<void> => {
    setIsSettingCompany(true);
    try {
      console.log("Setting company:", newCompany?.name || 'null');

      // Store company in localStorage for persistence
      if (newCompany) {
        localStorage.setItem('selectedCompany', JSON.stringify(newCompany));
      } else {
        localStorage.removeItem('selectedCompany');
      }

      setCompanyState(newCompany);

      // Wait for state to update
      return new Promise((resolve) => {
        setTimeout(() => {
          setIsSettingCompany(false);
          resolve();
        }, 100);
      });
    } catch (error) {
      setIsSettingCompany(false);
      throw error;
    }
  };

  // Load company from localStorage on mount
  useEffect(() => {
    if (!isSubdomainMode && !company) {
      const storedCompany = localStorage.getItem('selectedCompany');
      if (storedCompany) {
        try {
          const parsedCompany = JSON.parse(storedCompany);
          setCompanyState(parsedCompany);
        } catch (error) {
          console.error('Error parsing stored company:', error);
          localStorage.removeItem('selectedCompany');
        }
      }
    }
  }, [isSubdomainMode, company]);

  const clearCompany = () => {
    console.log("Clearing company");
    localStorage.removeItem('selectedCompany');
    setCompanyState(null);
  };

  const value: CompanyContextType = {
    company,
    setCompany,
    subdomain,
    isSubdomainMode,
    loading: isLoading || isSettingCompany,
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