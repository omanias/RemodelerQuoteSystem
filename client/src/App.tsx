import { useEffect } from "react";
import { Switch, Route } from "wouter";
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

function App() {
  const { user, loading: authLoading, logout } = useAuth();
  const { company, isSubdomainMode, loading: companyLoading, error, clearCompany } = useCompany();

  // Handle company error in subdomain mode
  useEffect(() => {
    if (isSubdomainMode && error) {
      logout();
      clearCompany();
    }
  }, [isSubdomainMode, error, logout, clearCompany]);

  // Show loading state while checking auth and company status
  if (authLoading || (isSubdomainMode && companyLoading)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Show login page if user is not authenticated
  if (!user) {
    // In subdomain mode with error, show error company selector
    if (isSubdomainMode && error) {
      return <CompanySelector showError={true} />;
    }
    // In non-subdomain mode without company, show company selector
    if (!isSubdomainMode && !company) {
      return <CompanySelector />;
    }
    // Otherwise show login page
    return <Login />;
  }

  // After login, ensure company is selected in non-subdomain mode
  if (!isSubdomainMode && !company) {
    return <CompanySelector />;
  }

  // Show main application once authenticated and company is selected
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