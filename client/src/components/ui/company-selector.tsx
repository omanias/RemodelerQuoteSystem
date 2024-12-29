import { FormEvent, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { Building2, Loader2 } from "lucide-react";

export function CompanySelector() {
  const [companyId, setCompanyId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { setCompany } = useCompany();
  const { toast } = useToast();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!companyId.trim()) {
      toast({
        title: "Error",
        description: "Please enter a company ID",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/companies/${companyId}`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const company = await response.json();
      setCompany(company);

      toast({
        title: "Success",
        description: "Company access granted successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to find company",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md mx-4">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            <CardTitle>Access Your Company</CardTitle>
          </div>
          <CardDescription>
            Enter your company ID to access your workspace. If you don't know your company ID, please contact your administrator.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="number"
                placeholder="Enter your company ID"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                required
                min="1"
                className="flex-1"
                disabled={isLoading}
                autoFocus
                aria-label="Company ID"
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
                  Accessing...
                </>
              ) : (
                "Access Company"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}