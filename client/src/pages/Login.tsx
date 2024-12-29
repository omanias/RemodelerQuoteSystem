import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import { CompanySelector } from "@/components/ui/company-selector";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login } = useAuth();
  const { toast } = useToast();
  const { company, isSubdomainMode } = useCompany();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login({ email, password });
    } catch (error: any) {
      toast({
        title: "Login Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // If not in subdomain mode and no company selected, show company selector
  if (!isSubdomainMode && !company) {
    return <CompanySelector />;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Card className="w-[400px] shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">QuoteBuilder</CardTitle>
          {company && (
            <CardDescription className="text-lg font-medium mt-2">
              {company.name}
            </CardDescription>
          )}
          <CardDescription className="text-sm text-muted-foreground mt-2">
            Sign in to manage your quotes and templates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button className="w-full" type="submit">
              Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}