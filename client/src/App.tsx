import { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { Layout } from "@/components/Layout";
import { AuthProvider, useFirebaseAuth } from "@/contexts/AuthContext";

// Pages
import { Login } from "@/pages/Login";
import { Dashboard } from "@/pages/Dashboard";
import { Quotes } from "@/pages/Quotes";
import { Products } from "@/pages/Products";
import { Templates } from "@/pages/Templates";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { firebaseUser, isLoading } = useFirebaseAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !firebaseUser) {
      setLocation("/login");
    }
  }, [firebaseUser, isLoading, setLocation]);

  if (!firebaseUser) {
    return null;
  }

  return <Layout>{children}</Layout>;
}

function RedirectIfAuthenticated({ children }: { children: React.ReactNode }) {
  const { firebaseUser, isLoading } = useFirebaseAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && firebaseUser) {
      setLocation("/");
    }
  }, [firebaseUser, isLoading, setLocation]);

  if (firebaseUser) {
    return null;
  }

  return <>{children}</>;
}

function App() {
  return (
    <Switch>
      <Route path="/login">
        <RedirectIfAuthenticated>
          <Login />
        </RedirectIfAuthenticated>
      </Route>
      <Route path="/">
        <RequireAuth>
          <Dashboard />
        </RequireAuth>
      </Route>
      <Route path="/quotes">
        <RequireAuth>
          <Quotes />
        </RequireAuth>
      </Route>
      <Route path="/products">
        <RequireAuth>
          <Products />
        </RequireAuth>
      </Route>
      <Route path="/templates">
        <RequireAuth>
          <Templates />
        </RequireAuth>
      </Route>
    </Switch>
  );
}

export default function AppWrapper() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}