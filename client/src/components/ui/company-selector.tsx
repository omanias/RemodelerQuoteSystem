import { FormEvent, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { Building2, Loader2, AlertCircle } from "lucide-react";

interface CompanySelectorProps {
  showError?: boolean;
  embedded?: boolean;
}

export function CompanySelector({ showError = false, embedded = false }: CompanySelectorProps) {
  const [companyId, setCompanyId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { setCompany } = useCompany();
  const { toast } = useToast();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (!companyId.trim()) {
        throw new Error("Please enter a company ID");
      }

      const response = await fetch(`/api/companies/${companyId}`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const selectedCompany = await response.json();

      // Update company in context
      setCompany(selectedCompany);

      // Show success message
      toast({
        title: "Success",
        description: `Connected to ${selectedCompany.name}`,
      });

    } catch (error) {
      console.error('Company selection error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to select company",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const content = (
    <div className={embedded ? "rounded-lg bg-muted/50 p-4 border" : ""}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          type="number"
          placeholder="Enter company ID"
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
          min="1"
          required
          disabled={isLoading}
        />
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Accessing...
            </>
          ) : (
            "Access Company"
          )}
        </Button>
      </form>
    </div>
  );

  return (
    <>
      {embedded ? (
        content
      ) : (
        <div className="min-h-screen w-full flex items-center justify-center bg-background">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              {showError ? (
                <div className="flex items-center gap-2 text-destructive mb-4">
                  <AlertCircle className="h-6 w-6" />
                  <CardTitle className="text-destructive">Company Not Found</CardTitle>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Building2 className="h-6 w-6" />
                  <CardTitle>Access Your Company</CardTitle>
                </div>
              )}
              <CardDescription>
                {showError
                  ? "The company you're trying to access was not found. Please verify your company ID."
                  : "Enter your company ID to access your workspace."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {content}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}