import { useEffect, useState } from "react";
import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { Layout } from "@/components/Layout";
import { Loader2 } from "lucide-react";

// Pages
import { Login } from "@/pages/Login";
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
import { useAuth } from "@/hooks/useAuth";

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <QueryClientProvider client={queryClient}>
        <Login />
        <Toaster />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
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
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;