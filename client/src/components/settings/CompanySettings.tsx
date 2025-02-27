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
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import type { Company } from "@db/schema";

const companySettingsSchema = z.object({
  name: z.string().min(1, "Company name is required"),
  logo: z.any().optional(),
  phone: z.string().optional(),
  tollFree: z.string().optional(),
  fax: z.string().optional(),
  email: z.string().email("Invalid email address").optional().nullable(),
  website: z.string().url("Invalid website URL").optional().nullable(),
  streetAddress: z.string().optional(),
  suite: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  taxId: z.string().optional(),
  businessHours: z.record(z.any()).optional(),
  socialMedia: z.record(z.string().url().optional()).optional(),
});

type CompanySettingsValues = z.infer<typeof companySettingsSchema>;

export function CompanySettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const { data: company, isLoading } = useQuery<Company>({
    queryKey: ["/api/companies/current"],
  });

  const form = useForm<CompanySettingsValues>({
    resolver: zodResolver(companySettingsSchema),
    defaultValues: {
      name: "",
      phone: "",
      tollFree: "",
      fax: "",
      email: "",
      website: "",
      streetAddress: "",
      suite: "",
      city: "",
      state: "",
      zipCode: "",
      taxId: "",
      businessHours: {},
      socialMedia: {},
    },
  });

  // Initialize form with company data when it's available
  useEffect(() => {
    if (company) {
      form.reset({
        name: company.name || "",
        phone: company.phone || "",
        tollFree: company.tollFree || "",
        fax: company.fax || "",
        email: company.email || "",
        website: company.website || "",
        streetAddress: company.streetAddress || "",
        suite: company.suite || "",
        city: company.city || "",
        state: company.state || "",
        zipCode: company.zipCode || "",
        taxId: company.taxId || "",
        businessHours: company.businessHours || {},
        socialMedia: company.socialMedia || {},
      });
    }
  }, [company]);

  const updateCompany = useMutation({
    mutationFn: async (data: CompanySettingsValues) => {
      const formData = new FormData();

      // Add all form fields to FormData
      Object.entries(data).forEach(([key, value]) => {
        if (key === 'logo' && value instanceof File) {
          formData.append('logo', value);
        } else if (key === 'businessHours' || key === 'socialMedia') {
          if (value && Object.keys(value).length > 0) {
            formData.append(key, JSON.stringify(value));
          }
        } else if (value !== null && value !== undefined && value !== '') {
          formData.append(key, value.toString());
        }
      });

      const response = await fetch("/api/companies/current", {
        method: "PUT",
        body: formData,
        credentials: "include"
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
      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      setPreviewImage(previewUrl);
      form.setValue("logo", file);

      // Cleanup preview URL when component unmounts
      return () => URL.revokeObjectURL(previewUrl);
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" encType="multipart/form-data">
        <div className="flex items-center gap-6">
          <Avatar className="h-24 w-24">
            {(previewImage || company?.logo) ? (
              <AvatarImage 
                src={previewImage || (company?.logo ? `${company.logo}?${Date.now()}` : undefined)} 
                alt={company?.name || 'Company Logo'} 
              />
            ) : (
              <AvatarFallback>
                <Building2 className="h-12 w-12" />
              </AvatarFallback>
            )}
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

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="contact">Contact</TabsTrigger>
            <TabsTrigger value="address">Address</TabsTrigger>
            <TabsTrigger value="social">Social Media</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <Card className="p-6">
              <div className="space-y-4">
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
                <FormField
                  control={form.control}
                  name="taxId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tax ID / EIN</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="contact" className="space-y-4">
            <Card className="p-6">
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input {...field} type="tel" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="tollFree"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Toll-Free Number</FormLabel>
                      <FormControl>
                        <Input {...field} type="tel" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="fax"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fax Number</FormLabel>
                      <FormControl>
                        <Input {...field} type="tel" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website</FormLabel>
                      <FormControl>
                        <Input {...field} type="url" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="address" className="space-y-4">
            <Card className="p-6">
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="streetAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Street Address</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="suite"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Suite/Unit</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="zipCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ZIP Code</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="social" className="space-y-4">
            <Card className="p-6">
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="socialMedia.facebook"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Facebook</FormLabel>
                      <FormControl>
                        <Input {...field} type="url" placeholder="https://facebook.com/..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="socialMedia.twitter"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Twitter</FormLabel>
                      <FormControl>
                        <Input {...field} type="url" placeholder="https://twitter.com/..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="socialMedia.linkedin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>LinkedIn</FormLabel>
                      <FormControl>
                        <Input {...field} type="url" placeholder="https://linkedin.com/..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="socialMedia.instagram"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Instagram</FormLabel>
                      <FormControl>
                        <Input {...field} type="url" placeholder="https://instagram.com/..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="socialMedia.youtube"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>YouTube</FormLabel>
                      <FormControl>
                        <Input {...field} type="url" placeholder="https://youtube.com/..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        <Button type="submit" disabled={updateCompany.isPending}>
          Save Changes
        </Button>
      </form>
    </Form>
  );
}