import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useDebouncedCallback } from "@/hooks/use-debounce";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { QuoteStatus, PaymentMethod, type Quote } from "@db/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Minus, X, Save } from "lucide-react";
import { cn } from "@/lib/utils";

// Update the validation schema to match the API requirements
const quoteFormSchema = z.object({
  contactId: z.string().min(1, "Contact is required"),
  clientName: z.string().min(1, "Client name is required"),
  clientEmail: z.string().email("Invalid email address"),
  clientPhone: z.string().optional(),
  clientAddress: z.string().optional(),
  categoryId: z.string().min(1, "Category is required"),
  status: z.enum(Object.values(QuoteStatus) as [string, ...string[]]),
  paymentMethod: z.enum(Object.values(PaymentMethod) as [string, ...string[]]),
  discountType: z.enum(["percentage", "fixed"]).optional(),
  discountValue: z.string().optional(),
  discountCode: z.string().optional(),
  taxRate: z.string().optional(),
  notes: z.string().optional(),
  clientMessage: z.string().optional(),
  templateId: z.string().min(1, "Template is required"),
});

interface QuoteFormProps {
  quote?: Quote;
  onSuccess?: () => void;
  user?: {
    id: number;
    email: string;
    name: string;
  };
  defaultContactId?: string | null;
  contact?: Contact | null;
}

interface Contact {
  id: number;
  firstName: string;
  lastName: string;
  primaryEmail: string;
  primaryPhone: string;
  primaryAddress: string;
}

interface Product {
  id: number;
  name: string;
  basePrice: number;
  unit: string;
  categoryId: number;
  variations?: Array<{ name: string; price: string }>;
}

interface SelectedProduct {
  productId: number;
  quantity: number;
  variation?: string;
  unitPrice: number;
  description?: string;
}

export function QuoteForm({ quote, onSuccess, user, defaultContactId, contact }: QuoteFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Initialize selected products from quote data if it exists
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>(() => {
    if (quote?.content?.products) {
      return quote.content.products.map((p: any) => ({
        productId: p.id,
        quantity: p.quantity || 1,
        variation: p.variation,
        unitPrice: parseFloat(p.price) || 0,
        description: p.description || "",
      }));
    }
    return [];
  });

  const form = useForm({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: {
      contactId: quote?.contactId?.toString() || defaultContactId || "",
      clientName: quote?.clientName || "",
      clientEmail: quote?.clientEmail || "",
      clientPhone: quote?.clientPhone || "",
      clientAddress: quote?.clientAddress || "",
      categoryId: quote?.categoryId?.toString() || "",
      status: quote?.status || QuoteStatus.DRAFT,
      paymentMethod: quote?.paymentMethod || PaymentMethod.CASH,
      discountType: quote?.discountType || "percentage",
      discountValue: quote?.discountValue?.toString() || "0",
      discountCode: quote?.discountCode || "",
      taxRate: quote?.taxRate?.toString() || "0",
      notes: quote?.notes || "",
      clientMessage: quote?.clientMessage || "",
      templateId: quote?.templateId?.toString() || "",
    },
  });

  const parseNumber = (value: any): number => {
    const parsed = parseFloat(value?.toString() || "0");
    return isNaN(parsed) ? 0 : parsed;
  };

  const calculateSubtotal = () => {
    if (!selectedProducts.length) return 0;
    return selectedProducts.reduce((sum, item) => {
      const quantity = parseNumber(item.quantity);
      const price = parseNumber(item.unitPrice);
      return sum + (quantity * price);
    }, 0);
  };

  const calculateDiscount = () => {
    const subtotal = calculateSubtotal();
    const discountType = form.watch("discountType");
    const discountValue = parseNumber(form.watch("discountValue"));

    return discountType === "percentage"
      ? (subtotal * discountValue) / 100
      : discountValue;
  };

  const calculateTax = () => {
    const subtotal = calculateSubtotal();
    const discount = calculateDiscount();
    const taxRate = parseNumber(form.watch("taxRate"));

    return ((subtotal - discount) * taxRate) / 100;
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const discount = calculateDiscount();
    const tax = calculateTax();
    return subtotal - discount + tax;
  };

  // Auto-save mutation
  const autoSaveMutation = useMutation({
    mutationFn: async (data: z.infer<typeof quoteFormSchema>) => {
      if (!quote?.id) return;

      const total = calculateTotal();
      const subtotal = calculateSubtotal();

      const formattedProducts = selectedProducts.map(item => ({
        id: item.productId,
        quantity: item.quantity,
        price: parseFloat(item.unitPrice.toString()),
        description: item.description,
        variation: item.variation,
      }));

      setIsAutoSaving(true);

      const response = await fetch(`/api/quotes/${quote.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          contactId: parseInt(data.contactId),
          categoryId: parseInt(data.categoryId),
          templateId: parseInt(data.templateId),
          selectedProducts: formattedProducts,
          subtotal,
          total,
          discountValue: parseFloat(data.discountValue || "0"),
          taxRate: parseFloat(data.taxRate || "0"),
          content: {
            products: formattedProducts,
            calculations: {
              subtotal,
              total,
              discount: calculateDiscount(),
              tax: calculateTax()
            },
          },
        }),
        credentials: "include",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      setLastSaved(new Date());
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
    },
    onError: (error: Error) => {
      console.error("Auto-save error:", error);
      toast({
        title: "Auto-save failed",
        description: "Changes couldn't be saved automatically. Please save manually.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsAutoSaving(false);
    },
  });

  // Debounced auto-save function
  const debouncedAutoSave = useDebouncedCallback((data: z.infer<typeof quoteFormSchema>) => {
    if (quote?.id) {
      autoSaveMutation.mutate(data);
    }
  }, 2000);

  // Watch for form changes and trigger auto-save
  useEffect(() => {
    const subscription = form.watch((value) => {
      if (quote?.id && Object.keys(form.formState.dirtyFields).length > 0) {
        debouncedAutoSave(value as z.infer<typeof quoteFormSchema>);
      }
    });
    return () => subscription.unsubscribe();
  }, [form, quote?.id, debouncedAutoSave]);

  const addProduct = () => {
    setSelectedProducts(prev => [
      ...prev,
      {
        productId: 0,
        quantity: 1,
        unitPrice: 0,
        description: "",
      }
    ]);
  };

  const updateProduct = (index: number, field: keyof SelectedProduct, value: any) => {
    setSelectedProducts(prev =>
      prev.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    );
  };

  const removeProduct = (index: number) => {
    setSelectedProducts(prev => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: z.infer<typeof quoteFormSchema>) => {
    if (selectedProducts.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one product or service to the quote",
        variant: "destructive",
      });
      return;
    }

    try {
      const total = calculateTotal();
      const subtotal = calculateSubtotal();

      const formattedProducts = selectedProducts.map(item => ({
        id: item.productId,
        quantity: item.quantity,
        price: parseFloat(item.unitPrice.toString()),
        description: item.description,
        variation: item.variation,
      }));

      const response = await fetch(quote ? `/api/quotes/${quote.id}` : "/api/quotes", {
        method: quote ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          contactId: parseInt(data.contactId),
          categoryId: parseInt(data.categoryId),
          templateId: parseInt(data.templateId),
          selectedProducts: formattedProducts,
          subtotal,
          total,
          discountValue: parseFloat(data.discountValue || "0"),
          taxRate: parseFloat(data.taxRate || "0"),
          content: {
            products: formattedProducts,
            calculations: {
              subtotal,
              total,
              discount: calculateDiscount(),
              tax: calculateTax()
            },
          },
        }),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      toast({
        title: "Success",
        description: quote ? "Quote updated successfully" : "Quote created successfully",
      });

      onSuccess?.();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">
              Quote for {form.watch("clientName") || "Client Name"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Quote #{quote?.number || "New Quote"}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {isAutoSaving ? (
              <>
                <Save className="h-4 w-4 animate-spin" />
                <span>Saving changes...</span>
              </>
            ) : lastSaved ? (
              <>
                <Save className="h-4 w-4" />
                <span>Last saved {new Intl.DateTimeFormat('en-US', {
                  hour: 'numeric',
                  minute: 'numeric',
                  second: 'numeric'
                }).format(lastSaved)}</span>
              </>
            ) : null}
          </div>
        </div>

        {/* Client Info */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="clientName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Client Name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="clientEmail"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Client Email</FormLabel>
                <FormControl>
                  <Input type="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Products/Services */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">Product / Service</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addProduct}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Line Item
                </Button>
              </div>

              <div className="space-y-4">
                {selectedProducts.map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-4 items-start">
                    <div className="col-span-5">
                      <Input
                        placeholder="Description"
                        value={item.description}
                        onChange={(e) => updateProduct(index, 'description', e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateProduct(index, 'quantity', parseInt(e.target.value) || 1)}
                        className="text-right"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => updateProduct(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                        className="text-right"
                        placeholder="$0.00"
                      />
                    </div>
                    <div className="col-span-2 text-right">
                      ${(item.quantity * item.unitPrice).toFixed(2)}
                    </div>
                    <div className="col-span-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeProduct(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Calculations */}
              <div className="border-t pt-4 mt-6">
                <div className="space-y-2 max-w-xs ml-auto">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>${calculateSubtotal().toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between items-center gap-4">
                    <span>Discount</span>
                    <div className="flex items-center gap-2">
                      <Select
                        value={form.watch("discountType")}
                        onValueChange={(value) => form.setValue("discountType", value as "percentage" | "fixed")}
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">%</SelectItem>
                          <SelectItem value="fixed">$</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        step="0.01"
                        className="w-24 text-right"
                        {...form.register("discountValue")}
                      />
                      <span className="w-20 text-right">
                        ${calculateDiscount().toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center gap-4">
                    <span>Tax</span>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        className="w-24 text-right"
                        {...form.register("taxRate")}
                      />
                      <span>%</span>
                      <span className="w-20 text-right">
                        ${calculateTax().toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between font-semibold border-t pt-2">
                    <span>Total</span>
                    <span>${calculateTotal().toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Client Message */}
        <FormField
          control={form.control}
          name="clientMessage"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Client Message</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder="Enter a message for your client..."
                  className="min-h-[100px]"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Contract/Disclaimer */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-2">Contract / Disclaimer</h3>
            <p className="text-sm text-muted-foreground">
              This quote is valid for the next 30 days, after which values may be subject to change.
            </p>
          </CardContent>
        </Card>

        {/* Internal Notes */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Internal Notes</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder="Internal notes will only be seen by your team"
                  className="min-h-[100px]"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Action Buttons */}
        <div className="flex justify-end gap-4">
          <Button
            type="submit"
            disabled={isAutoSaving}
          >
            {isAutoSaving ? "Saving..." : (quote ? "Update Quote" : "Create Quote")}
          </Button>
        </div>
      </form>
    </Form>
  );
}