import { StrictMode } from "react";
import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

// Pages
import { Login } from "@/pages/Login";
import { Dashboard } from "@/pages/Dashboard";
import { Quotes } from "@/pages/Quotes";
import { Products } from "@/pages/Products";
import { Templates } from "@/pages/Templates";

function PrivateRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    setLocation("/login");
    return null;
  }

  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function PublicRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) {
    setLocation("/");
    return null;
  }

  return <Component />;
}

function App() {
  return (
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <Switch>
          <Route path="/login" component={() => <PublicRoute component={Login} />} />
          <Route path="/" component={() => <PrivateRoute component={Dashboard} />} />
          <Route path="/quotes" component={() => <PrivateRoute component={Quotes} />} />
          <Route path="/products" component={() => <PrivateRoute component={Products} />} />
          <Route path="/templates" component={() => <PrivateRoute component={Templates} />} />
        </Switch>
        <Toaster />
      </QueryClientProvider>
    </StrictMode>
  );
}

export default App;