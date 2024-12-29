import { FormEvent, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { Building2, Loader2, AlertCircle, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Login } from "@/pages/Login";

interface CompanySelectorProps {
  showError?: boolean;
  embedded?: boolean;
}

export function CompanySelector({ showError = false, embedded = false }: CompanySelectorProps) {
  const [companyId, setCompanyId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ id: number; name: string; subdomain: string }>>([]);
  const { setCompany } = useCompany();
  const { toast } = useToast();

  const handleSearch = async (term: string) => {
    if (!term.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await fetch(`/api/companies/search?q=${encodeURIComponent(term)}`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const results = await response.json();
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: "Search Error",
        description: error instanceof Error ? error.message : "Failed to search companies",
        variant: "destructive",
      });
    }
  };

  const handleCompanySelect = async (company: { id: number; name: string }) => {
    setIsLoading(true);

    try {
      const response = await fetch(`/api/companies/${company.id}`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const selectedCompany = await response.json();

      // Update company in context
      setCompany(selectedCompany);

      // Clear form state
      setCompanyId("");
      setSearchResults([]);
      setSearchTerm("");

      // Show success message
      toast({
        title: "Success",
        description: `Connected to ${selectedCompany.name}`,
      });

      // Show login modal
      setShowLoginModal(true);
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

    await handleCompanySelect({ id: parseInt(companyId), name: "" });
  };

  const content = (
    <div className={embedded ? "rounded-lg bg-muted/50 p-4 border" : ""}>
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search companies..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              handleSearch(e.target.value);
            }}
            className="pl-8"
            disabled={isLoading}
          />
        </div>

        {searchResults.length > 0 && (
          <div className="border rounded-md mt-2 divide-y max-h-48 overflow-y-auto bg-background shadow-sm">
            {searchResults.map((company) => (
              <button
                key={company.id}
                onClick={() => handleCompanySelect(company)}
                className="w-full px-4 py-2 text-left hover:bg-accent flex items-center justify-between text-sm"
                disabled={isLoading}
              >
                <span className="font-medium">{company.name}</span>
                <span className="text-muted-foreground">ID: {company.id}</span>
              </button>
            ))}
          </div>
        )}

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Or enter company ID
            </span>
          </div>
        </div>

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
                  ? "The company you're trying to access was not found. Please verify your company ID or search by name."
                  : "Enter your company ID or search by company name to access your workspace."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {content}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={showLoginModal} onOpenChange={setShowLoginModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Login to Your Account</DialogTitle>
            <DialogDescription>
              Please enter your credentials to access your company workspace.
            </DialogDescription>
          </DialogHeader>
          <Login embedded={true} />
        </DialogContent>
      </Dialog>
    </>
  );
}