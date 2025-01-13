import { Switch, Route } from "wouter";
import { Loader2 } from "lucide-react";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/useAuth";
import { Login } from "@/pages/Login";

// Pages
import { Dashboard } from "@/pages/Dashboard";
import { Quotes } from "@/pages/Quotes";
import { QuoteDetail } from "@/pages/QuoteDetail";
import { Products } from "@/pages/Products";
import { Categories } from "@/pages/Categories";  // Add Categories import
import { Templates } from "@/pages/Templates";
import { Users } from "@/pages/Users";
import { AdminPermissions } from "@/pages/AdminPermissions";
import { Contacts } from "@/pages/Contacts";
import { ContactDetail } from "@/pages/ContactDetail";
import { Companies } from "@/pages/Companies";
import { SuperAdminDashboard } from "@/pages/SuperAdminDashboard";
import WorkflowsPage from "@/pages/workflows";
import { Settings } from "@/pages/Settings";

function App() {
  const { user, loading: authLoading } = useAuth();

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // If no authenticated user, show login page
  if (!user) {
    return (
      <Switch>
        <Route path="*" component={Login} />
      </Switch>
    );
  }

  // For SUPER_ADMIN and MULTI_ADMIN, show super admin dashboard as home
  const homePage = ["SUPER_ADMIN", "MULTI_ADMIN"].includes(user.role)
    ? SuperAdminDashboard
    : Dashboard;

  // Show main application once authenticated
  return (
    <Layout>
      <Switch>
        <Route path="/" component={homePage} />
        <Route path="/quotes" component={Quotes} />
        <Route path="/quotes/new" component={QuoteDetail} />
        <Route path="/quotes/:id" component={QuoteDetail} />
        <Route path="/contacts" component={Contacts} />
        <Route path="/contacts/new" component={ContactDetail} />
        <Route path="/contacts/:id" component={ContactDetail} />
        <Route path="/products" component={Products} />
        <Route path="/products/categories" component={Categories} />  {/* Add Categories route */}
        <Route path="/templates" component={Templates} />
        <Route path="/users" component={Users} />
        <Route path="/permissions" component={AdminPermissions} />
        <Route path="/companies" component={Companies} />
        <Route path="/workflows" component={WorkflowsPage} />
        <Route path="/settings" component={Settings} />
      </Switch>
    </Layout>
  );
}

export default App;