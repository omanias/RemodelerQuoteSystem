import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const quoteSettingsSchema = z.object({
  defaultTaxRate: z.string(),
  defaultDiscountType: z.enum(["percentage", "fixed"]),
  defaultDiscountValue: z.string(),
  defaultPaymentMethod: z.string(),
  defaultDownPaymentType: z.enum(["percentage", "fixed"]),
  defaultDownPaymentValue: z.string(),
  requireClientSignature: z.boolean(),
  autoSendEmails: z.boolean(),
  showUnitPrice: z.boolean(), // New field
  showTotalPrice: z.boolean(), // New field
});

type QuoteSettingsValues = z.infer<typeof quoteSettingsSchema>;

export function QuoteSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery<QuoteSettingsValues>({
    queryKey: ["/api/settings/quotes"],
  });

  const form = useForm<QuoteSettingsValues>({
    resolver: zodResolver(quoteSettingsSchema),
    defaultValues: {
      defaultTaxRate: settings?.defaultTaxRate || "0",
      defaultDiscountType: settings?.defaultDiscountType || "percentage",
      defaultDiscountValue: settings?.defaultDiscountValue || "0",
      defaultPaymentMethod: settings?.defaultPaymentMethod || "CASH",
      defaultDownPaymentType: settings?.defaultDownPaymentType || "percentage",
      defaultDownPaymentValue: settings?.defaultDownPaymentValue || "0",
      requireClientSignature: settings?.requireClientSignature || false,
      autoSendEmails: settings?.autoSendEmails || false,
      showUnitPrice: settings?.showUnitPrice ?? true, // Default to true for backwards compatibility
      showTotalPrice: settings?.showTotalPrice ?? true, // Default to true for backwards compatibility
    },
  });

  const updateSettings = useMutation({
    mutationFn: async (data: QuoteSettingsValues) => {
      const response = await fetch("/api/settings/quotes", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update quote settings");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/quotes"] });
      toast({
        title: "Success",
        description: "Quote settings updated successfully",
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

  const onSubmit = (data: QuoteSettingsValues) => {
    updateSettings.mutate(data);
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="defaultTaxRate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Default Tax Rate (%)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="defaultDiscountType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Default Discount Type</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="defaultDiscountValue"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Default Discount Value
                  {form.watch("defaultDiscountType") === "percentage"
                    ? " (%)"
                    : " ($)"}
                </FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="defaultPaymentMethod"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Default Payment Method</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="CARD">Card</SelectItem>
                    <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                    <SelectItem value="CHECK">Check</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="defaultDownPaymentType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Default Down Payment Type</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="defaultDownPaymentValue"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Default Down Payment Value
                  {form.watch("defaultDownPaymentType") === "percentage"
                    ? " (%)"
                    : " ($)"}
                </FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-4">
          {/* Add new toggles for unit price and total price display */}
          <FormField
            control={form.control}
            name="showUnitPrice"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel>Show Unit Price</FormLabel>
                  <div className="text-sm text-muted-foreground">
                    Display unit price in quotes and PDF exports
                  </div>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="showTotalPrice"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel>Show Total Price</FormLabel>
                  <div className="text-sm text-muted-foreground">
                    Display total price per line item in quotes and PDF exports
                  </div>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="requireClientSignature"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel>Require Client Signature</FormLabel>
                  <div className="text-sm text-muted-foreground">
                    Require client signature before accepting quotes
                  </div>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="autoSendEmails"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel>Auto-send Emails</FormLabel>
                  <div className="text-sm text-muted-foreground">
                    Automatically send emails when quote status changes
                  </div>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <Button type="submit" disabled={updateSettings.isPending}>
          Save Changes
        </Button>
      </form>
    </Form>
  );
}