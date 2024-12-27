import { useEffect, useState } from "react";
import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { Layout } from "@/components/Layout";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Loader2 } from "lucide-react";

// Pages
import { Login } from "@/pages/Login";
import { Dashboard } from "@/pages/Dashboard";
import { Quotes } from "@/pages/Quotes";
import { Products } from "@/pages/Products";
import { Templates } from "@/pages/Templates";

function App() {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    console.log("Setting up Firebase auth listener");
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("Auth state changed:", user?.email);
      setAuthenticated(!!user);
      setLoading(false);

      if (user) {
        console.log("User is authenticated, redirecting to dashboard");
        setLocation("/");
      } else {
        console.log("User is not authenticated, redirecting to login");
        setLocation("/login");
      }
    });

    return () => unsubscribe();
  }, [setLocation]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Switch>
        <Route path="/login">
          {authenticated ? (
            () => {
              console.log("Already authenticated, redirecting to dashboard");
              setLocation("/");
              return null;
            }
          ) : (
            <Login />
          )}
        </Route>
        <Route path="/">
          {!authenticated ? (
            () => {
              console.log("Not authenticated, redirecting to login");
              setLocation("/login");
              return null;
            }
          ) : (
            <Layout>
              <Dashboard />
            </Layout>
          )}
        </Route>
        <Route path="/quotes">
          {!authenticated ? (
            () => {
              setLocation("/login");
              return null;
            }
          ) : (
            <Layout>
              <Quotes />
            </Layout>
          )}
        </Route>
        <Route path="/products">
          {!authenticated ? (
            () => {
              setLocation("/login");
              return null;
            }
          ) : (
            <Layout>
              <Products />
            </Layout>
          )}
        </Route>
        <Route path="/templates">
          {!authenticated ? (
            () => {
              setLocation("/login");
              return null;
            }
          ) : (
            <Layout>
              <Templates />
            </Layout>
          )}
        </Route>
      </Switch>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;