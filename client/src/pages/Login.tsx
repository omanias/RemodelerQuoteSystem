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
import { Loader2 } from "lucide-react";

interface LoginProps {
  embedded?: boolean;
  onSuccess?: () => void;
}

export function Login({ embedded = false, onSuccess }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();
  const { company } = useCompany();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await login({ email, password });

      // On successful login, first call onSuccess if we're in embedded mode
      if (embedded && onSuccess) {
        onSuccess();
      }

      // After successful login, the useAuth hook will automatically navigate to the dashboard
    } catch (error: any) {
      toast({
        title: "Login Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Must have a company to show login form
  if (!company) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const loginForm = (
    <form onSubmit={handleLogin} className="space-y-4">
      <div className="space-y-2">
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isLoading}
        />
        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={isLoading}
        />
      </div>
      <Button 
        type="submit" 
        className="w-full" 
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Signing in...
          </>
        ) : (
          "Sign In"
        )}
      </Button>
    </form>
  );

  if (embedded) {
    return loginForm;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-[400px] shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">QuoteBuilder</CardTitle>
          <CardDescription className="text-lg font-medium mt-2">
            {company.name}
          </CardDescription>
          <CardDescription className="text-sm text-muted-foreground mt-2">
            Sign in to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loginForm}
        </CardContent>
      </Card>
    </div>
  );
}