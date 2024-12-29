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
import { Categories } from "@/pages/Categories";
import { Products } from "@/pages/Products";
import { Templates } from "@/pages/Templates";
import { Users } from "@/pages/Users";
import { AdminPermissions } from "@/pages/AdminPermissions";
import { Contacts } from "@/pages/Contacts";
import { ContactDetail } from "@/pages/ContactDetail";

function App() {
  const { user, loading: authLoading, logout } = useAuth();
  const { company, isSubdomainMode, loading: companyLoading, error, clearCompany } = useCompany();

  // Logout and clear company if in subdomain mode and company error occurs
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
    return <Login />;
  }

  // Show company selector if:
  // 1. Not in subdomain mode and no company selected
  // 2. In subdomain mode but company not found (error state)
  if ((!isSubdomainMode && !company) || (isSubdomainMode && error)) {
    return <CompanySelector showError={isSubdomainMode && error !== null} />;
  }

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
        <Route path="/categories" component={Categories} />
        <Route path="/products" component={Products} />
        <Route path="/templates" component={Templates} />
        <Route path="/users" component={Users} />
        <Route path="/permissions" component={AdminPermissions} />
      </Switch>
    </Layout>
  );
}

export default App;