import { useEffect } from "react";
import { Switch, Route, useLocation, useParams } from "wouter";
import { Loader2 } from "lucide-react";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/contexts/CompanyContext";
import { CompanySelector } from "@/components/ui/company-selector";
import { Login } from "@/pages/Login";

// Pages
import { Dashboard } from "@/pages/Dashboard";
import { Quotes } from "@/pages/Quotes";
import { QuoteDetail } from "@/pages/QuoteDetail";
import { Products } from "@/pages/Products";
import { Templates } from "@/pages/Templates";
import { Users } from "@/pages/Users";
import { AdminPermissions } from "@/pages/AdminPermissions";
import { Contacts } from "@/pages/Contacts";
import { ContactDetail } from "@/pages/ContactDetail";

// Type for route params
type LoginParams = {
  companyId: string;
};

function CompanyLoginRoute() {
  const params = useParams<LoginParams>();
  const { company, setCompany } = useCompany();
  const [, setLocation] = useLocation();

  useEffect(() => {
    const fetchCompany = async () => {
      try {
        const response = await fetch(`/api/companies/${params.companyId}`, {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Company not found");
        }

        const data = await response.json();
        setCompany(data);
      } catch (error) {
        console.error("Error fetching company:", error);
        setLocation("/");
      }
    };

    // Only fetch if company ID in URL doesn't match current company
    if (!company || (params.companyId && company.id !== parseInt(params.companyId))) {
      fetchCompany();
    }
  }, [params.companyId, company, setCompany, setLocation]);

  // Prevent flash of login form while company is loading
  if (!company || (params.companyId && company.id !== parseInt(params.companyId))) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return <Login />;
}

function App() {
  const { user, loading: authLoading } = useAuth();
  const { company, isSubdomainMode, loading: companyLoading, error } = useCompany();
  const [location] = useLocation();

  // Show loading state while checking auth and company status
  if (authLoading || (isSubdomainMode && companyLoading)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Not authenticated flow
  if (!user) {
    // Show error page in subdomain mode with error
    if (isSubdomainMode && error) {
      return <CompanySelector showError={true} />;
    }

    // In non-subdomain mode
    if (!isSubdomainMode) {
      // Check if we're on a company login route
      const isCompanyLoginRoute = location.match(/^\/companies\/\d+\/login$/);

      // Show company selector if no company is selected and not on login route
      if (!company && !isCompanyLoginRoute) {
        return <CompanySelector />;
      }

      // Show company login route if we're on that path
      if (isCompanyLoginRoute) {
        return <CompanyLoginRoute />;
      }
    }

    // Default to login for all other cases (has company or subdomain mode)
    return <Login />;
  }

  // Show main application once authenticated
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/quotes" component={Quotes} />
        <Route path="/quotes/new" component={QuoteDetail} />
        <Route path="/quotes/:id" component={QuoteDetail} />
        <Route path="/contacts" component={Contacts} />
        <Route path="/contacts/new" component={ContactDetail} />
        <Route path="/contacts/:id" component={ContactDetail} />
        <Route path="/products" component={Products} />
        <Route path="/templates" component={Templates} />
        <Route path="/users" component={Users} />
        <Route path="/permissions" component={AdminPermissions} />
      </Switch>
    </Layout>
  );
}

export default App;