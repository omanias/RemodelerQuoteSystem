import { useState, useEffect, KeyboardEvent } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Minus, Save, Users } from "lucide-react";
import { Link } from "wouter";
import { Textarea } from "@/components/ui/textarea";

// Import PaymentMethod from schema to ensure consistency
import { PaymentMethod, QuoteStatus } from "@db/schema";

// Product interface matching the database schema
interface Product {
  id: number;
  name: string;
  basePrice: number;
  unit: string;
  variations?: Record<string, any>;
}

const quoteFormSchema = z.object({
  contactId: z.string().optional(),
  templateId: z.string().optional(),
  categoryId: z.string().optional(),
  clientName: z.string().min(1, "Client name is required"),
  clientEmail: z.string().email("Invalid email address").optional().or(z.literal("")),
  clientPhone: z.string().optional().or(z.literal("")),
  clientAddress: z.string().optional().or(z.literal("")),
  status: z.nativeEnum(QuoteStatus),
  content: z.object({
    products: z.array(z.object({
      productId: z.number(),
      quantity: z.number().min(1),
      variation: z.string().optional(),
      unitPrice: z.number().min(0)
    }))
  }),
  subtotal: z.number().min(0),
  total: z.number().min(0),
  notes: z.string().optional().or(z.literal("")),
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  discountType: z.enum(["PERCENTAGE", "FIXED"]).optional(),
  discountValue: z.number().min(0).optional(),
  discountCode: z.string().optional().or(z.literal("")),
  downPaymentType: z.enum(["PERCENTAGE", "FIXED"]).optional(),
  downPaymentValue: z.number().min(0).optional(),
  taxRate: z.number().min(0).optional(),
  remainingBalance: z.number().min(0).optional()
});

type QuoteFormValues = z.infer<typeof quoteFormSchema>;

interface SelectedProduct {
  productId: number;
  name: string;
  quantity: number;
  variation?: string;
  unitPrice: number;
}

interface QuoteFormProps {
  quote?: Quote;
  onSuccess?: () => void;
  user?: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
  defaultContactId?: string;
  contact?: {
    firstName: string;
    lastName: string;
    primaryEmail: string;
    primaryPhone: string;
    primaryAddress: string;
  };
}

interface Quote {
  id: number;
  number: string;
  clientName: string;
  status: keyof typeof QuoteStatus;
  total: string | number;
  downPaymentValue: string | number | null;
  remainingBalance: string | number | null;
  createdAt: string;
  content: {
    products: Array<{
      productId: number;
      quantity: number;
      variation?: string;
      unitPrice: number;
    }>;
  };
  templateId: number;
  categoryId: number;
  contactId: number | null;
  clientEmail: string | null;
  clientPhone: string | null;
  clientAddress: string | null;
  notes: string | null;
  paymentMethod: keyof typeof PaymentMethod | null;
  discountType: "PERCENTAGE" | "FIXED" | null;
  discountValue: number | null;
  discountCode: string | null;
  downPaymentType: "PERCENTAGE" | "FIXED" | null;
  taxRate: number | null;
  subtotal: number;
}

export function QuoteForm({ quote, onSuccess, user, defaultContactId, contact }: QuoteFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>(() => {
    if (quote?.content?.products) {
      return quote.content.products.map((p) => ({
        productId: p.productId,
        name: "", // Will be populated from products query
        quantity: p.quantity || 1,
        variation: p.variation,
        unitPrice: typeof p.unitPrice === 'string' ? parseFloat(p.unitPrice) : p.unitPrice || 0,
      }));
    }
    return [];
  });

  // Fetch necessary data
  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ["/api/categories"],
  });

  const { data: templates = [] } = useQuery<any[]>({
    queryKey: ["/api/templates"],
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    enabled: !!selectedProducts.length,
  });

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(
    quote?.categoryId?.toString() || undefined
  );

  // Calculate totals
  const calculateTotals = (products: SelectedProduct[], discountType?: string, discountValue?: number, taxRate?: number) => {
    const subtotal = products.reduce((sum, p) => sum + (p.quantity * p.unitPrice), 0);
    let total = subtotal;

    if (discountType && discountValue) {
      const discount = discountType === 'PERCENTAGE' 
        ? (subtotal * (discountValue / 100))
        : discountValue;
      total -= discount;
    }

    if (taxRate) {
      total += total * (taxRate / 100);
    }

    return { subtotal, total };
  };

  // Create/Update quote mutation
  const mutation = useMutation({
    mutationFn: async (data: QuoteFormValues) => {
      const url = quote ? `/api/quotes/${quote.id}` : "/api/quotes";
      const method = quote ? "PUT" : "POST";

      const requestBody = {
        ...data,
        contactId: data.contactId ? parseInt(data.contactId) : null,
        templateId: data.templateId ? parseInt(data.templateId) : null,
        categoryId: data.categoryId ? parseInt(data.categoryId) : null,
        content: {
          products: selectedProducts,
        },
      };

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to save quote");
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      if (quote) {
        queryClient.invalidateQueries({ queryKey: [`/api/quotes/${quote.id}`] });
      }
      toast({
        title: "Success",
        description: quote ? "Quote updated successfully" : "Quote created successfully",
      });
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const form = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: {
      contactId: quote?.contactId?.toString() || defaultContactId || undefined,
      templateId: quote?.templateId?.toString(),
      categoryId: quote?.categoryId?.toString(),
      clientName: quote?.clientName || (contact ? `${contact.firstName} ${contact.lastName}` : ""),
      clientEmail: quote?.clientEmail || contact?.primaryEmail || "",
      clientPhone: quote?.clientPhone || contact?.primaryPhone || "",
      clientAddress: quote?.clientAddress || contact?.primaryAddress || "",
      status: (quote?.status || "DRAFT") as keyof typeof QuoteStatus,
      content: { 
        products: quote?.content?.products || [] 
      },
      subtotal: quote ? parseFloat(quote.subtotal.toString()) : 0,
      total: quote ? parseFloat(quote.total.toString()) : 0,
      notes: quote?.notes || "",
      paymentMethod: quote?.paymentMethod as keyof typeof PaymentMethod || undefined,
      discountType: quote?.discountType || undefined,
      discountValue: quote?.discountValue ? parseFloat(quote.discountValue.toString()) : undefined,
      discountCode: quote?.discountCode || "",
      downPaymentType: quote?.downPaymentType || undefined,
      downPaymentValue: quote?.downPaymentValue ? parseFloat(quote.downPaymentValue.toString()) : undefined,
      taxRate: quote?.taxRate ? parseFloat(quote.taxRate.toString()) : undefined,
      remainingBalance: quote?.remainingBalance ? parseFloat(quote.remainingBalance.toString()) : undefined,
    }
  });

  // Watch form values for calculations
  const watchDiscountType = form.watch("discountType");
  const watchDiscountValue = form.watch("discountValue");
  const watchTaxRate = form.watch("taxRate");

  // Update totals when relevant values change
  useEffect(() => {
    const { subtotal, total } = calculateTotals(
      selectedProducts,
      watchDiscountType,
      watchDiscountValue,
      watchTaxRate
    );
    form.setValue("subtotal", subtotal);
    form.setValue("total", total);
  }, [selectedProducts, watchDiscountType, watchDiscountValue, watchTaxRate]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && e.ctrlKey) {
      form.handleSubmit(onSubmit)(e);
    }
  };

  const addProduct = () => {
    setSelectedProducts([
      ...selectedProducts,
      {
        productId: 0,
        name: "",
        quantity: 1,
        unitPrice: 0
      }
    ]);
  };

  const removeProduct = (index: number) => {
    setSelectedProducts(selectedProducts.filter((_, i) => i !== index));
  };

  const updateProduct = (index: number, updates: Partial<SelectedProduct>) => {
    setSelectedProducts(products => 
      products.map((p, i) => i === index ? { ...p, ...updates } : p)
    );
  };

  const onSubmit = async (data: QuoteFormValues) => {
    if (selectedProducts.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one product to the quote",
        variant: "destructive",
      });
      return;
    }
    await mutation.mutateAsync(data);
  };

  // Update selectedCategoryId when form values change
  useEffect(() => {
    const categoryId = form.watch("categoryId");
    if (categoryId) {
      setSelectedCategoryId(categoryId);
    }
  }, [form.watch("categoryId")]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" onKeyDown={handleKeyDown}>
        {/* User Info Card */}
        {user && (
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-2">Sales Representative</h3>
              <div className="text-sm text-muted-foreground">
                <p>Name: {user.name}</p>
                <p>Email: {user.email}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contact Information */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Contact Information</h3>
              <Link href="/contacts/new">
                <Button variant="outline" size="sm">
                  <Users className="h-4 w-4 mr-2" />
                  Create New Contact
                </Button>
              </Link>
            </div>

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
                      <Input {...field} type="email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="clientPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Phone</FormLabel>
                    <FormControl>
                      <Input {...field} type="tel" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="clientAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Address</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Category and Template Selection */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-4">Quote Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((category: any) => (
                          <SelectItem key={category.id} value={category.id.toString()}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="templateId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Template</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a template" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {templates
                          .filter((t: any) => t.categoryId.toString() === selectedCategoryId)
                          .map((template: any) => (
                            <SelectItem key={template.id} value={template.id.toString()}>
                              {template.name} {template.isDefault && "(Default)"}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(QuoteStatus).map(([key, value]) => (
                          <SelectItem key={key} value={value}>
                            {value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Products Selection */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Products</h3>
              <Button type="button" onClick={addProduct} variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            </div>

            <div className="space-y-4">
              {selectedProducts.map((product, index) => (
                <div key={index} className="flex gap-4 items-start border p-4 rounded-lg">
                  <div className="flex-1 grid grid-cols-4 gap-4">
                    <div className="col-span-2">
                      <FormItem>
                        <FormLabel>Product</FormLabel>
                        <Select
                          value={product.productId.toString()}
                          onValueChange={(value) => {
                            const selectedProduct = products.find(p => p.id === parseInt(value));
                            if (selectedProduct) {
                              updateProduct(index, {
                                productId: selectedProduct.id,
                                name: selectedProduct.name,
                                unitPrice: selectedProduct.basePrice
                              });
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a product" />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((p) => (
                              <SelectItem key={p.id} value={p.id.toString()}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    </div>

                    <FormItem>
                      <FormLabel>Quantity</FormLabel>
                      <Input
                        type="number"
                        min="1"
                        value={product.quantity}
                        onChange={(e) => 
                          updateProduct(index, { quantity: parseInt(e.target.value) || 1 })
                        }
                      />
                    </FormItem>

                    <FormItem>
                      <FormLabel>Unit Price</FormLabel>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={product.unitPrice}
                        onChange={(e) => 
                          updateProduct(index, { unitPrice: parseFloat(e.target.value) || 0 })
                        }
                      />
                    </FormItem>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mt-6"
                    onClick={() => removeProduct(index)}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quote Settings */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-4">Quote Settings</h3>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Method</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select payment method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(PaymentMethod).map(([key, value]) => (
                          <SelectItem key={key} value={value}>
                            {value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="discountType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discount Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select discount type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                        <SelectItem value="FIXED">Fixed Amount</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="discountValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discount Value</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="discountCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discount Code</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="taxRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax Rate (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Totals Display */}
            <div className="mt-6 border-t pt-4">
              <div className="text-right space-y-2">
                <p>
                  <span className="font-medium">Subtotal:</span>{" "}
                  ${form.watch("subtotal").toFixed(2)}
                </p>
                {watchDiscountValue && watchDiscountType && (
                  <p>
                    <span className="font-medium">Discount:</span>{" "}
                    ${(watchDiscountType === "PERCENTAGE"
                      ? (form.watch("subtotal") * (watchDiscountValue / 100))
                      : watchDiscountValue
                    ).toFixed(2)}
                  </p>
                )}
                {watchTaxRate && (
                  <p>
                    <span className="font-medium">Tax ({watchTaxRate}%):</span>{" "}
                    ${((form.watch("subtotal") - (watchDiscountValue || 0)) * (watchTaxRate / 100)).toFixed(2)}
                  </p>
                )}
                <p className="text-lg font-bold">
                  <span>Total:</span> ${form.watch("total").toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={mutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {mutation.isPending
              ? quote
                ? "Updating..."
                : "Creating..."
              : quote
                ? "Update Quote"
                : "Create Quote"}
          </Button>
        </div>
      </form>
    </Form>
  );
}