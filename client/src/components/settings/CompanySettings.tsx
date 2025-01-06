import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Building2, Upload } from "lucide-react";

const companySettingsSchema = z.object({
  name: z.string().min(1, "Company name is required"),
  logo: z.any().optional(), // Will be handled separately
});

type CompanySettingsValues = z.infer<typeof companySettingsSchema>;

export function CompanySettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch current company data
  const { data: company, isLoading } = useQuery<{ id: number; name: string; logo?: string }>({
    queryKey: ["/api/companies/current"],
  });

  const form = useForm<CompanySettingsValues>({
    resolver: zodResolver(companySettingsSchema),
    defaultValues: {
      name: company?.name || "",
    },
  });

  const updateCompany = useMutation({
    mutationFn: async (data: CompanySettingsValues) => {
      const formData = new FormData();
      formData.append("name", data.name);
      if (data.logo instanceof File) {
        formData.append("logo", data.logo);
      }

      const response = await fetch("/api/companies/current", {
        method: "PUT",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update company settings");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies/current"] });
      toast({
        title: "Success",
        description: "Company settings updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      form.setValue("logo", file);
    }
  };

  const onSubmit = (data: CompanySettingsValues) => {
    updateCompany.mutate(data);
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="flex items-center gap-6">
          <Avatar className="h-24 w-24">
            <AvatarImage src={company?.logo} alt={company?.name} />
            <AvatarFallback>
              <Building2 className="h-12 w-12" />
            </AvatarFallback>
          </Avatar>
          <div>
            <Button type="button" variant="outline" onClick={() => document.getElementById("logo-upload")?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Logo
            </Button>
            <input
              id="logo-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoChange}
            />
            <p className="text-sm text-muted-foreground mt-2">
              Recommended: 512x512px PNG or JPG
            </p>
          </div>
        </div>

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Company Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={updateCompany.isPending}>
          Save Changes
        </Button>
      </form>
    </Form>
  );
}