import { useState, useEffect, type KeyboardEventHandler } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Minus, X, UserPlus } from "lucide-react";
import { Link } from "wouter";

export enum QuoteStatus {
  DRAFT = "DRAFT",
  SENT = "SENT",
  ACCEPTED = "ACCEPTED",
  REJECTED = "REJECTED",
  REVISED = "REVISED"
}

export enum PaymentMethod {
  CASH = "CASH",
  CREDIT_CARD = "CREDIT_CARD",
  BANK_TRANSFER = "BANK_TRANSFER",
  PAYMENT_PLAN = "PAYMENT_PLAN"
}

interface ProductVariation {
  id: number;
  name: string;
  price: number;
}

interface Product {
  id: number;
  name: string;
  unit: string;
  price: number;
  quantity: number;
  variation?: string;
  variations?: ProductVariation[];
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
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  discountType: z.enum(["PERCENTAGE", "FIXED"]).optional(),
  discountValue: z.string().optional().or(z.literal("")),
  discountCode: z.string().optional().or(z.literal("")),
  taxRate: z.string().optional().or(z.literal("")),
  downPaymentType: z.enum(["PERCENTAGE", "FIXED"]).optional(),
  downPaymentValue: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal(""))
});

type QuoteFormValues = z.infer<typeof quoteFormSchema>;

interface QuoteFormProps {
  quote?: {
    id: number;
    number: string;
    clientName: string;
    clientEmail: string | null;
    clientPhone: string | null;
    clientAddress: string | null;
    status: QuoteStatus;
    total: number;
    subtotal: number;
    downPaymentValue: number | null;
    remainingBalance: number | null;
    createdAt: string;
    contactId: number | null;
    categoryId: number;
    templateId: number;
    content: {
      products: Product[];
      calculations?: {
        tax: number;
        total: number;
        discount: number;
        subtotal: number;
        downPayment: number;
        remainingBalance: number;
      };
    };
    paymentMethod: PaymentMethod | null;
    discountType: "PERCENTAGE" | "FIXED" | null;
    discountValue: number | null;
    discountCode: string | null;
    downPaymentType: "PERCENTAGE" | "FIXED" | null;
    taxRate: number | null;
    notes: string | null;
  };
  onSuccess?: () => void;
  user?: {
    id: number;
    name: string;
    email: string;
    role: string;
  } | null;
  defaultContactId?: string | null;
  contact?: {
    firstName: string;
    lastName: string;
    primaryEmail: string;
    primaryPhone: string;
    primaryAddress: string;
  } | null;
}

export function QuoteForm({ quote, onSuccess, user, defaultContactId, contact }: QuoteFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedProducts, setSelectedProducts] = useState<Product[]>(() => {
    if (quote?.content?.products) {
      return quote.content.products;
    }
    return [];
  });

  const { data: contacts = [] } = useQuery<any[]>({
    queryKey: ["/api/contacts"],
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

  const { data: products = [], isLoading: isLoadingProducts } = useQuery<any[]>({
    queryKey: ["/api/products", selectedCategoryId],
    enabled: !!selectedCategoryId,
  });

  const defaultValues = {
    contactId: quote?.contactId?.toString() || defaultContactId || undefined,
    templateId: quote?.templateId?.toString(),
    categoryId: quote?.categoryId?.toString(),
    clientName: quote?.clientName || (contact ? `${contact.firstName} ${contact.lastName}` : ""),
    clientEmail: quote?.clientEmail || contact?.primaryEmail || "",
    clientPhone: quote?.clientPhone || contact?.primaryPhone || "",
    clientAddress: quote?.clientAddress || contact?.primaryAddress || "",
    status: quote?.status || QuoteStatus.DRAFT,
    paymentMethod: quote?.paymentMethod || undefined,
    discountType: quote?.discountType || undefined,
    discountValue: quote?.discountValue?.toString() || "",
    discountCode: quote?.discountCode || "",
    taxRate: quote?.taxRate?.toString() || "",
    downPaymentType: quote?.downPaymentType || undefined,
    downPaymentValue: quote?.downPaymentValue?.toString() || "",
    notes: quote?.notes || ""
  };

  const form = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues
  });

  useEffect(() => {
    if (contact) {
      form.setValue("clientName", `${contact.firstName} ${contact.lastName}`);
      form.setValue("clientEmail", contact.primaryEmail || "");
      form.setValue("clientPhone", contact.primaryPhone || "");
      form.setValue("clientAddress", contact.primaryAddress || "");
    }
  }, [contact, form]);

  useEffect(() => {
    const categoryId = form.watch("categoryId");
    if (categoryId) {
      setSelectedCategoryId(categoryId);
    }
  }, [form.watch("categoryId")]);

  const calculateTotals = (products: Product[]) => {
    try {
      const subtotal = products.reduce((sum, item) => {
        const quantity = Math.max(1, Number(item.quantity) || 1);
        const price = Number(item.price) || 0;
        return sum + (quantity * price);
      }, 0);

      const discountType = form.watch("discountType");
      const discountValue = Number(form.watch("discountValue")) || 0;
      const taxRate = Number(form.watch("taxRate")) || 0;
      const downPaymentType = form.watch("downPaymentType");
      const downPaymentValue = Number(form.watch("downPaymentValue")) || 0;

      const discount = discountType === "PERCENTAGE"
        ? (subtotal * discountValue / 100)
        : discountValue;

      const taxAmount = ((subtotal - discount) * taxRate) / 100;
      const total = Math.max(0, subtotal - discount + taxAmount);

      const downPayment = downPaymentType === "PERCENTAGE"
        ? (total * downPaymentValue / 100)
        : downPaymentValue;

      const remainingBalance = Math.max(0, total - downPayment);

      return {
        tax: taxAmount,
        total,
        discount,
        subtotal,
        downPayment,
        remainingBalance
      };
    } catch (error) {
      console.error("Error calculating totals:", error);
      return {
        tax: 0,
        total: 0,
        discount: 0,
        subtotal: 0,
        downPayment: 0,
        remainingBalance: 0
      };
    }
  };

  const mutation = useMutation({
    mutationFn: async (data: QuoteFormValues) => {
      const calculations = calculateTotals(selectedProducts);

      const payload = {
        ...data,
        contactId: data.contactId ? parseInt(data.contactId) : null,
        categoryId: data.categoryId ? parseInt(data.categoryId) : null,
        templateId: data.templateId ? parseInt(data.templateId) : null,
        content: {
          products: selectedProducts.map(product => ({
            ...product,
            quantity: Math.max(1, Number(product.quantity) || 1),
            price: Number(product.price) || 0
          })),
          calculations
        },
        subtotal: calculations.subtotal,
        total: calculations.total,
        discountValue: Number(data.discountValue) || null,
        taxRate: Number(data.taxRate) || null,
        downPaymentValue: Number(data.downPaymentValue) || null,
        remainingBalance: calculations.remainingBalance,
        paymentMethod: data.paymentMethod || null
      };

      const response = await fetch(quote ? `/api/quotes/${quote.id}` : "/api/quotes", {
        method: quote ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      if (quote?.id) {
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

  const handleKeyDown: KeyboardEventHandler<HTMLFormElement> = (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      form.handleSubmit(onSubmit)(e);
    }
  };

  const onSubmit = async (data: QuoteFormValues) => {
    try {
      await mutation.mutateAsync(data);
    } catch (error) {
      console.error("Form submission error:", error);
    }
  };

  const addProduct = (product: any) => {
    setSelectedProducts(prev => [
      ...prev,
      {
        id: product.id,
        name: product.name,
        unit: product.unit,
        price: product.variation ? product.price : (product.price || 0),
        quantity: 1,
        variation: product.variation,
        variations: product.variations
      }
    ]);
  };

  const updateQuantity = (index: number, value: number) => {
    setSelectedProducts(prev =>
      prev.map((item, i) =>
        i === index ? { ...item, quantity: Math.max(1, value) } : item
      )
    );
  };

  const removeProduct = (index: number) => {
    setSelectedProducts(prev => prev.filter((_, i) => i !== index));
  };

  const calculations = calculateTotals(selectedProducts);

  return (
    <Form {...form}>
      <form onKeyDown={handleKeyDown} onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Client Information Card */}
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

        {/* Products Card */}
        {selectedCategoryId && (
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-4">Products</h3>
              <div className="space-y-4">
                {isLoadingProducts ? (
                  <div className="text-center py-4">Loading products...</div>
                ) : products.length === 0 ? (
                  <div className="text-center py-4">No products found in this category</div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {products.map((product: any) => (
                      <Card key={product.id}>
                        <CardContent className="pt-6">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium">{product.name}</h4>
                              <p className="text-sm text-muted-foreground">
                                {product.variations?.length > 0 ? (
                                  <>
                                    Price Range: ${Math.min(...product.variations.map((v: any) => v.price)).toFixed(2)} -
                                    ${Math.max(...product.variations.map((v: any) => v.price)).toFixed(2)}
                                  </>
                                ) : (
                                  `Unit Price: $${product.price.toFixed(2)}`
                                )}
                              </p>
                              {product.variations?.length > 0 && (
                                <div className="mt-2">
                                  <Select
                                    onValueChange={(variationId) => {
                                      const selectedVariation = product.variations.find((v: any) => v.id.toString() === variationId);
                                      if (selectedVariation) {
                                        addProduct({
                                          ...product,
                                          price: selectedVariation.price,
                                          variation: selectedVariation.name
                                        });
                                      }
                                    }}
                                  >
                                    <SelectTrigger className="w-full">
                                      <SelectValue placeholder="Select variation" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {product.variations.map((variation: any) => (
                                        <SelectItem key={variation.id} value={variation.id.toString()}>
                                          {variation.name} - ${variation.price.toFixed(2)}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </div>
                            {(!product.variations || product.variations.length === 0) && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => addProduct(product)}
                                className="h-8 w-8"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {selectedProducts.length > 0 && (
                  <div className="space-y-4 mt-6">
                    <h4 className="font-medium">Selected Products</h4>
                    <div className="space-y-2">
                      {selectedProducts.map((item, index) => (
                        <div key={index} className="flex items-center gap-4 p-4 border rounded-md">
                          <div className="flex-1">
                            <p className="font-medium">
                              {item.name}
                              {item.variation ? ` - ${item.variation}` : ""}
                            </p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span>Unit Price: ${Number(item.price).toFixed(2)}</span>
                              <span>•</span>
                              <span>Total: ${(Number(item.quantity) * Number(item.price)).toFixed(2)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => updateQuantity(index, Number(item.quantity) - 1)}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateQuantity(index, parseInt(e.target.value) || 1)}
                              className="w-20 text-center"
                              min="1"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => updateQuantity(index, Number(item.quantity) + 1)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeProduct(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quote Settings Card */}
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
                        {Object.values(PaymentMethod).map((method) => (
                          <SelectItem key={method} value={method}>
                            {method}
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
                      <Input {...field} type="number" step="0.01" />
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
                      <Input {...field} type="number" step="0.01" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="downPaymentType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Down Payment Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select down payment type" />
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
                name="downPaymentValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Down Payment Value</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="0.01" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Quote Summary Card */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-4">Quote Summary</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Subtotal</p>
                  <p className="text-lg font-medium">
                    ${calculations.subtotal.toFixed(2)}
                  </p>
                </div>

                {calculations.discount > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Discount {form.watch("discountType") === "PERCENTAGE" ? `(${form.watch("discountValue")}%)` : "(Fixed)"}
                    </p>
                    <p className="text-lg font-medium text-destructive">
                      -${calculations.discount.toFixed(2)}
                    </p>
                  </div>
                )}

                {calculations.tax > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground">Tax ({form.watch("taxRate")}%)</p>
                    <p className="text-lg font-medium">
                      ${calculations.tax.toFixed(2)}
                    </p>
                  </div>
                )}

                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-xl font-semibold">
                    ${calculations.total.toFixed(2)}
                  </p>
                </div>

                {calculations.downPayment > 0 && (
                  <>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Down Payment {form.watch("downPaymentType") === "PERCENTAGE" ? `(${form.watch("downPaymentValue")}%)` : "(Fixed)"}
                      </p>
                      <p className="text-lg font-medium">
                        ${calculations.downPayment.toFixed(2)}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-muted-foreground">Remaining Balance</p>
                      <p className="text-lg font-medium">
                        ${calculations.remainingBalance.toFixed(2)}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? (quote ? "Updating..." : "Creating...") : (quote ? "Update Quote" : "Create Quote")}
          </Button>
        </div>
      </form>
    </Form>
  );
}