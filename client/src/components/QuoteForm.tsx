import { useState, useEffect, KeyboardEventHandler } from "react";
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
  discountValue: z.string().transform((val) => (val === "" ? "0" : val)),
  discountCode: z.string().optional().or(z.literal("")),
  taxRate: z.string().transform((val) => (val === "" ? "0" : val)),
  downPaymentType: z.enum(["PERCENTAGE", "FIXED"]).optional(),
  downPaymentValue: z.string().transform((val) => (val === "" ? "0" : val)),
  notes: z.string().optional().or(z.literal(""))
});

type QuoteFormValues = z.infer<typeof quoteFormSchema>;

interface ProductVariation {
  name: string;
  price: number;
}

interface Product {
  id: number;
  name: string;
  unit: string;
  basePrice: number;
  price?: number;
  quantity?: number;
  variation?: string;
  variations?: ProductVariation[];
}

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
      products: Array<{
        id: number;
        name: string;
        unit: string;
        basePrice: number;
        price: number;
        quantity: number;
        variation?: string;
        variations?: Array<{
          name: string;
          price: number;
        }>;
      }>;
      calculations?: {
        tax: number;
        total: number;
        discount: number;
        subtotal: number;
        downPayment: number;
        remainingBalance: number;
      };
    };
    paymentMethod: string | null;
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

  // Initialize selectedProducts with quote data if available
  const [selectedProducts, setSelectedProducts] = useState<Array<Product>>(() => {
    if (quote?.content?.products) {
      return quote.content.products.map(product => ({
        id: product.id,
        name: product.name,
        unit: product.unit,
        basePrice: product.basePrice,
        price: product.price || product.basePrice,
        quantity: product.quantity || 1,
        variation: product.variation,
        variations: product.variations
      }));
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

  // Set initial category ID from quote if available
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(
    quote?.categoryId?.toString() || undefined
  );

  const { data: products = [], isLoading: isLoadingProducts } = useQuery<Product[]>({
    queryKey: ["/api/products", selectedCategoryId],
    enabled: !!selectedCategoryId,
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
      status: quote?.status || QuoteStatus.DRAFT,
      paymentMethod: quote?.paymentMethod as PaymentMethod || undefined,
      discountType: quote?.discountType || undefined,
      discountValue: quote?.discountValue?.toString() || "",
      discountCode: quote?.discountCode || "",
      taxRate: quote?.taxRate?.toString() || "",
      downPaymentType: quote?.downPaymentType || undefined,
      downPaymentValue: quote?.downPaymentValue?.toString() || "",
      notes: quote?.notes || ""
    }
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

  useEffect(() => {
    if (quote) {
      form.reset({
        contactId: quote.contactId?.toString(),
        templateId: quote.templateId?.toString(),
        categoryId: quote.categoryId?.toString(),
        clientName: quote.clientName,
        clientEmail: quote.clientEmail || "",
        clientPhone: quote.clientPhone || "",
        clientAddress: quote.clientAddress || "",
        status: quote.status,
        paymentMethod: quote.paymentMethod as PaymentMethod || undefined,
        discountType: quote.discountType || undefined,
        discountValue: quote.discountValue?.toString() || "",
        discountCode: quote.discountCode || "",
        taxRate: quote.taxRate?.toString() || "",
        downPaymentType: quote.downPaymentType || undefined,
        downPaymentValue: quote.downPaymentValue?.toString() || "",
        notes: quote.notes || ""
      });
      setSelectedCategoryId(quote.categoryId?.toString());
    }
  }, [quote, form]);


  const calculateTotals = (products: Product[]) => {
    try {
      const subtotal = products.reduce((sum, item) => {
        const quantity = Math.max(1, item.quantity || 1);
        const price = item.price || item.basePrice;
        return sum + (quantity * price);
      }, 0);

      const discountType = form.watch("discountType");
      const discountValue = parseFloat(form.watch("discountValue") || "0");
      const taxRate = parseFloat(form.watch("taxRate") || "0");
      const downPaymentType = form.watch("downPaymentType");
      const downPaymentValue = parseFloat(form.watch("downPaymentValue") || "0");

      const discount = discountType === "PERCENTAGE"
        ? (subtotal * (isNaN(discountValue) ? 0 : discountValue) / 100)
        : (isNaN(discountValue) ? 0 : discountValue);

      const taxAmount = ((subtotal - discount) * (isNaN(taxRate) ? 0 : taxRate)) / 100;
      const total = Math.max(0, subtotal - discount + taxAmount);

      const downPayment = downPaymentType === "PERCENTAGE"
        ? (total * (isNaN(downPaymentValue) ? 0 : downPaymentValue) / 100)
        : (isNaN(downPaymentValue) ? 0 : downPaymentValue);

      const remainingBalance = Math.max(0, total - (isNaN(downPayment) ? 0 : downPayment));

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

      // Ensure numeric values are properly converted
      const payload = {
        ...data,
        contactId: data.contactId ? parseInt(data.contactId) : null,
        categoryId: data.categoryId ? parseInt(data.categoryId) : null,
        templateId: data.templateId ? parseInt(data.templateId) : null,
        content: {
          products: selectedProducts.map(product => ({
            ...product,
            quantity: Math.max(1, product.quantity || 1),
            price: product.price || product.basePrice
          })),
          calculations
        },
        subtotal: calculations.subtotal || 0,
        total: calculations.total || 0,
        discountValue: parseFloat(data.discountValue || "0") || 0,
        taxRate: parseFloat(data.taxRate || "0") || 0,
        downPaymentValue: parseFloat(data.downPaymentValue || "0") || 0,
        remainingBalance: calculations.remainingBalance || 0,
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
        const errorText = await response.text();
        throw new Error(errorText);
      }

      return await response.json();
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

  const addProduct = (product: Product, variation?: ProductVariation) => {
    const newProduct: Product = {
      id: product.id,
      name: product.name,
      unit: product.unit,
      basePrice: product.basePrice,
      price: variation ? variation.price : product.basePrice,
      quantity: 1,
      variation: variation?.name,
      variations: product.variations
    };
    setSelectedProducts(prev => [...prev, newProduct]);
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

  return (
    <Form {...form}>
      <form onKeyDown={handleKeyDown} onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {user ? (
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-2">Sales Representative</h3>
              <div className="text-sm text-muted-foreground">
                <p>Name: {user.name}</p>
                <p>Email: {user.email}</p>
              </div>
            </CardContent>
          </Card>
        ) : null}

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

            <FormField
              control={form.control}
              name="contactId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Select Contact</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      const selectedContact = contacts.find(c => c.id.toString() === value);
                      if (selectedContact) {
                        form.setValue("clientName", `${selectedContact.firstName} ${selectedContact.lastName}`);
                        form.setValue("clientEmail", selectedContact.primaryEmail || "");
                        form.setValue("clientPhone", selectedContact.primaryPhone || "");
                        form.setValue("clientAddress", selectedContact.primaryAddress || "");
                      }
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a contact" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {contacts.map((contact) => (
                        <SelectItem key={contact.id} value={contact.id.toString()}>
                          {contact.firstName} {contact.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4 mt-4">
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

        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-4">Quote Details</h3>
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
                              {template.name}
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
          </CardContent>
        </Card>

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
                    {products.map((product) => (
                      <Card key={product.id}>
                        <CardContent className="pt-6">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium">{product.name}</h4>
                              <p className="text-sm text-muted-foreground">
                                Base Price: ${product.basePrice}
                              </p>
                              {product.variations && product.variations.length > 0 && (
                                <div className="mt-2">
                                  <Select
                                    onValueChange={(value) => {
                                      const selectedVariation = product.variations?.find(
                                        v => v.name === value
                                      );
                                      if (selectedVariation) {
                                        addProduct(product, selectedVariation);
                                      }
                                    }}
                                  >
                                    <SelectTrigger className="w-full">
                                      <SelectValue placeholder="Select variation" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {product.variations.map((variation) => (
                                        <SelectItem key={variation.name} value={variation.name}>
                                          {variation.name} - ${variation.price}
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
                  <div className="space-y-4">
                    <h4 className="font-medium">Selected Products</h4>
                    <div className="space-y-2">
                      {selectedProducts.map((item, index) => (
                        <div key={index} className="flex items-center gap-4 p-2 border rounded-md">
                          <div className="flex-1">
                            <p className="font-medium">{item.name}</p>
                            <p className="text-sm text-muted-foreground">
                              ${item.price?.toFixed(2)}
                              {item.variation && ` - ${item.variation}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => updateQuantity(index, (item.quantity || 1) - 1)}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <Input
                              type="number"
                              value={item.quantity || 1}
                              onChange={(e) => updateQuantity(index, parseInt(e.target.value) || 1)}
                              className="w-20 text-center"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => updateQuantity(index, (item.quantity || 1) + 1)}
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

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Notes</FormLabel>
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

        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-4">Quote Summary</h3>
            <div className="space-y-4 divide-y">
              <div className="grid grid-cols-2 gap-4 py-2">
                <div>
                  <p className="text-sm text-muted-foreground">Subtotal</p>
                  <p className="text-lg font-medium">
                    ${calculateTotals(selectedProducts).subtotal.toFixed(2)}
                  </p>
                </div>
                {form.watch("discountValue") && parseFloat(form.watch("discountValue") || "0") > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Discount ({form.watch("discountType") === "PERCENTAGE" ? `${form.watch("discountValue")}%` : "Fixed"})
                    </p>
                    <p className="text-lg font-medium text-destructive">
                      -${calculateTotals(selectedProducts).discount.toFixed(2)}
                    </p>
                  </div>
                )}
                {form.watch("taxRate") && parseFloat(form.watch("taxRate") || "0") > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground">Tax ({form.watch("taxRate")}%)</p>
                    <p className="text-lg font-medium">
                      ${calculateTotals(selectedProducts).tax.toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4 py-2">
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-xl font-semibold">
                    ${calculateTotals(selectedProducts).total.toFixed(2)}
                  </p>
                </div>
                {form.watch("downPaymentValue") && parseFloat(form.watch("downPaymentValue") || "0") > 0 && (
                  <>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Down Payment ({form.watch("downPaymentType") === "PERCENTAGE" ? `${form.watch("downPaymentValue")}%` : "Fixed"})
                      </p>
                      <p className="text-lg font-medium">
                        ${calculateTotals(selectedProducts).downPayment.toFixed(2)}
                      </p>
                    </div>
                    <div className="col-start-2">
                      <p className="text-sm text-muted-foreground">Remaining Balance</p>
                      <p className="text-lg font-medium">
                        ${calculateTotals(selectedProducts).remainingBalance.toFixed(2)}
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