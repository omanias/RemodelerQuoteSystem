import { useState, useEffect, KeyboardEventHandler, useCallback } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PaymentMethod, QuoteStatus } from "@db/schema";
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
import { Plus, Minus, X, UserPlus } from "lucide-react";
import { Link } from "wouter";

interface SelectedProduct {
  productId: number;
  quantity: number;
  variation?: string;
  unitPrice: number;
  basePrice: number;
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

interface QuoteFormProps {
  quote?: Quote;
  onSuccess?: () => void;
  user?: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
  defaultContactId?: string | null;
  contact?: {
    firstName: string;
    lastName: string;
    primaryEmail: string;
    primaryPhone: string;
    primaryAddress: string;
  };
}

const quoteFormSchema = z.object({
  contactId: z.string().optional(),
  templateId: z.string().optional(),
  categoryId: z.string().optional(),
  clientName: z.string().min(1, "Client name is required"),
  clientEmail: z.string().email("Invalid email address").optional(),
  clientPhone: z.string().optional(),
  clientAddress: z.string().optional(),
  status: z.enum(Object.keys(QuoteStatus) as [string, ...string[]]),
  content: z.object({
    products: z.array(z.object({
      productId: z.number(),
      quantity: z.number(),
      variation: z.string().optional(),
      unitPrice: z.number()
    }))
  }).optional(),
  subtotal: z.number().min(0).optional(),
  total: z.number().min(0).optional(),
  notes: z.string().optional(),
  paymentMethod: z.enum(Object.keys(PaymentMethod) as [string, ...string[]]).optional(),
  discountType: z.enum(["PERCENTAGE", "FIXED"]).optional(),
  discountValue: z.number().min(0).optional(),
  discountCode: z.string().optional(),
  downPaymentType: z.enum(["PERCENTAGE", "FIXED"]).optional(),
  downPaymentValue: z.number().min(0).optional(),
  taxRate: z.number().min(0).optional(),
  remainingBalance: z.number().min(0).optional()
});

type QuoteFormValues = z.infer<typeof quoteFormSchema>;

export function QuoteForm({ quote, onSuccess, user, defaultContactId, contact }: QuoteFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Initialize selected products with correct price handling
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>(() => {
    if (quote?.content?.products) {
      return quote.content.products.map((p) => {
        const productPrice = Number(p.unitPrice) || 0;
        return {
          productId: p.productId,
          quantity: p.quantity || 1,
          variation: p.variation,
          unitPrice: productPrice,
          basePrice: productPrice,
        };
      });
    }
    return [];
  });

  const form = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: {
      contactId: quote?.contactId?.toString() || defaultContactId || undefined,
      templateId: quote?.templateId?.toString(),
      categoryId: quote?.categoryId?.toString(),
      clientName: quote?.clientName || (contact ? `${contact.firstName} ${contact.lastName}` : ""),
      clientEmail: quote?.clientEmail || contact?.primaryEmail || undefined,
      clientPhone: quote?.clientPhone || contact?.primaryPhone || undefined,
      clientAddress: quote?.clientAddress || contact?.primaryAddress || undefined,
      status: quote?.status || "DRAFT",
      content: quote?.content,
      subtotal: quote ? Number(quote.subtotal) || 0 : 0,
      total: quote ? Number(quote.total) || 0 : 0,
      notes: quote?.notes || undefined,
      paymentMethod: quote?.paymentMethod || undefined,
      discountType: quote?.discountType || undefined,
      discountValue: quote?.discountValue ? Number(quote.discountValue) : undefined,
      discountCode: quote?.discountCode || undefined,
      downPaymentType: quote?.downPaymentType || undefined,
      downPaymentValue: quote?.downPaymentValue ? Number(quote.downPaymentValue) : undefined,
      taxRate: quote?.taxRate ? Number(quote.taxRate) : undefined,
      remainingBalance: quote?.remainingBalance ? Number(quote.remainingBalance) : undefined,
    }
  });

  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ["/api/categories"],
  });

  const { data: templates = [] } = useQuery<any[]>({
    queryKey: ["/api/templates"],
  });

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(
    quote?.categoryId?.toString() || undefined
  );

  const { data: products = [] } = useQuery<any[]>({
    queryKey: ["/api/products"],
    enabled: !!selectedCategoryId,
  });

  // Calculate totals considering variations
  const calculateTotals = useCallback(() => {
    const subtotal = selectedProducts.reduce((acc, product) => {
      return acc + (product.unitPrice * product.quantity);
    }, 0);

    const total = subtotal; // Add tax and discount calculations here if needed
    return { subtotal, total };
  }, [selectedProducts]);

  // Update form values when products change
  useEffect(() => {
    const { subtotal, total } = calculateTotals();
    form.setValue('subtotal', subtotal);
    form.setValue('total', total);
  }, [selectedProducts, form, calculateTotals]);

  // Add product with proper price initialization
  const handleAddProduct = (productId: number) => {
    const product = products.find((p: any) => p.id === productId);
    if (!product) return;

    const basePrice = Number(product.basePrice) || 0;
    const newProduct: SelectedProduct = {
      productId,
      quantity: 1,
      variation: undefined,
      unitPrice: basePrice,
      basePrice: basePrice,
    };

    setSelectedProducts((prev) => [...prev, newProduct]);
  };

  // Update variation with correct price handling
  const handleVariationChange = (productIndex: number, variation: string) => {
    setSelectedProducts((prev) => {
      const updated = [...prev];
      const product = products.find((p: any) => p.id === updated[productIndex].productId);
      if (!product) return prev;

      const selectedVariation = product.variations?.find((v: any) => v.name === variation);
      const variationPrice = selectedVariation ? Number(selectedVariation.price) : updated[productIndex].basePrice;

      updated[productIndex] = {
        ...updated[productIndex],
        variation,
        unitPrice: variationPrice,
      };
      return updated;
    });
  };

  const handleQuantityChange = (productIndex: number, newQuantity: number) => {
    setSelectedProducts((prev) => {
      const updated = [...prev];
      updated[productIndex] = {
        ...updated[productIndex],
        quantity: newQuantity,
      };
      return updated;
    });
  };

  const handleRemoveProduct = (productIndex: number) => {
    setSelectedProducts((prev) => prev.filter((_, index) => index !== productIndex));
  };

  const handleKeyDown: KeyboardEventHandler<HTMLFormElement> = (event) => {
    if (event.key === "Enter" && event.ctrlKey) {
      void form.handleSubmit(onSubmit)(event);
    }
  };

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
          products: selectedProducts.map(p => ({
            productId: p.productId,
            quantity: p.quantity,
            variation: p.variation,
            unitPrice: p.unitPrice
          })),
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

  const onSubmit = async (data: QuoteFormValues) => {
    await mutation.mutateAsync(data);
  };

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
                  <UserPlus className="h-4 w-4 mr-2" />
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
        <div className="space-y-4">
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
                    {Object.values(QuoteStatus).map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Products Selection */}
        {selectedCategoryId && (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <h3 className="font-semibold">Products</h3>
                <div className="space-y-4">
                  {selectedProducts.map((product, index) => {
                    const productDetails = products.find((p: any) => p.id === product.productId);
                    return (
                      <div key={index} className="flex items-center gap-4 p-4 border rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium">{productDetails?.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Price: ${product.unitPrice.toFixed(2)} {product.variation ? `(${product.variation})` : ''}
                          </p>
                          {productDetails?.variations && (
                            <Select
                              value={product.variation}
                              onValueChange={(value) => handleVariationChange(index, value)}
                            >
                              <SelectTrigger className="w-[200px] mt-2">
                                <SelectValue placeholder="Select variation" />
                              </SelectTrigger>
                              <SelectContent>
                                {productDetails.variations.map((variation: any) => (
                                  <SelectItem key={variation.name} value={variation.name}>
                                    {variation.name} (${Number(variation.price).toFixed(2)})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleQuantityChange(index, Math.max(1, product.quantity - 1))}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <Input
                            type="number"
                            value={product.quantity}
                            onChange={(e) => handleQuantityChange(index, parseInt(e.target.value) || 1)}
                            className="w-20 text-center"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleQuantityChange(index, product.quantity + 1)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleRemoveProduct(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  <Select onValueChange={(value) => handleAddProduct(parseInt(value))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Add product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products
                        .filter((p: any) => p.categoryId.toString() === selectedCategoryId)
                        .map((product: any) => (
                          <SelectItem key={product.id} value={product.id.toString()}>
                            {product.name} (${Number(product.basePrice).toFixed(2)})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Summary section */}
                <div className="mt-6 space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>${form.watch('subtotal')?.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total:</span>
                    <span>${form.watch('total')?.toFixed(2) || '0.00'}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={mutation.isPending}>
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