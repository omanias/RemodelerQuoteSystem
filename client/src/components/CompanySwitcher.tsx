import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";

interface Company {
  id: number;
  name: string;
}

// Assuming UserRole is defined in schema.ts and imported accordingly.  Adjust path as needed.
import { UserRole } from '@/schema';


export function CompanySwitcher() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  // Only fetch companies if user is SUPER_ADMIN or MULTI_ADMIN
  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
    enabled: user?.role === "SUPER_ADMIN" || user?.role === "MULTI_ADMIN",
  });

  // If user is not SUPER_ADMIN or MULTI_ADMIN, or there's only one company, don't show the switcher
  if (!user || (user.role !== "SUPER_ADMIN" && user.role !== "MULTI_ADMIN") || companies.length <= 1) {
    return null;
  }

  // Find current company from the list
  const currentCompany = companies.find(c => c.id === user.companyId);
  if (!currentCompany) return null;

  const handleCompanySelect = async (companyId: number) => {
    try {
      const response = await fetch("/api/auth/switch-company", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ companyId }),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      // Reload the page to refresh all data
      window.location.reload();
    } catch (error) {
      console.error("Failed to switch company:", error);
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {currentCompany.name}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandGroup>
            {companies.map((company) => (
              <CommandItem
                key={company.id}
                onSelect={() => handleCompanySelect(company.id)}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    company.id === currentCompany.id ? "opacity-100" : "opacity-0"
                  )}
                />
                {company.name}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}