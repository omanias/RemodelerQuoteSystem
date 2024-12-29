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

// Wrapper component for the login route that handles company ID from URL
function CompanyLoginRoute() {
  const params = useParams<LoginParams>();
  const { company, setCompany } = useCompany();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!company && params.companyId) {
      // Fetch and set company based on URL parameter
      fetch(`/api/companies/${params.companyId}`, {
        credentials: "include",
      })
        .then((res) => {
          if (!res.ok) throw new Error("Company not found");
          return res.json();
        })
        .then((data) => {
          setCompany(data);
        })
        .catch((error) => {
          console.error("Error fetching company:", error);
          setLocation("/"); // Redirect to company selector on error
        });
    }
  }, [params.companyId, company, setCompany, setLocation]);

  return <Login />;
}

// Standalone company selector route
function CompanySelectorRoute() {
  return <CompanySelector />;
}

function App() {
  const { user, loading: authLoading, logout } = useAuth();
  const { company, isSubdomainMode, loading: companyLoading, error, clearCompany } = useCompany();
  const [location] = useLocation();

  // Handle company error in subdomain mode
  useEffect(() => {
    if (isSubdomainMode && error) {
      logout();
      clearCompany();
    }
  }, [isSubdomainMode, error, logout, clearCompany]);

  // Debug logging
  useEffect(() => {
    console.log('App state:', {
      user: !!user,
      company: !!company,
      location,
      isSubdomainMode,
      loading: authLoading || companyLoading
    });
  }, [user, company, location, isSubdomainMode, authLoading, companyLoading]);

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
    // Show error company selector in subdomain mode with error
    if (isSubdomainMode && error) {
      return <CompanySelector showError={true} />;
    }

    // Show company selector by default in non-subdomain mode
    if (!isSubdomainMode && !company && location === "/") {
      return <CompanySelector />;
    }

    // Show login form for subdomain mode or when company is selected
    return (
      <Switch>
        <Route path="/companies/:companyId/login" component={CompanyLoginRoute} />
        <Route component={CompanySelectorRoute} />
      </Switch>
    );
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