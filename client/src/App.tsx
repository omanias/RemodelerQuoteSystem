import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

// Pages
import { Login } from "@/pages/Login";
import { Dashboard } from "@/pages/Dashboard";
import { Quotes } from "@/pages/Quotes";
import { Products } from "@/pages/Products";
import { Templates } from "@/pages/Templates";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading, error } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    console.log("ProtectedRoute state:", { loading, user: !!user, error });
    if (!loading && !user) {
      console.log("Redirecting to login");
      setLocation("/login");
    }
  }, [user, loading, setLocation]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500">Error: {error.message}</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function App() {
  const { user, loading } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    console.log("App auth state:", { loading, user: !!user, location });
    if (!loading && user && location === "/login") {
      console.log("Redirecting to dashboard");
      setLocation("/");
    }
  }, [user, loading, location, setLocation]);

  return (
    <QueryClientProvider client={queryClient}>
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
        <Route path="/quotes" component={() => <ProtectedRoute component={Quotes} />} />
        <Route path="/products" component={() => <ProtectedRoute component={Products} />} />
        <Route path="/templates" component={() => <ProtectedRoute component={Templates} />} />
      </Switch>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;