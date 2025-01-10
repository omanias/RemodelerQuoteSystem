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
import { useToast } from "@/hooks/use-toast";
import { QuoteStatus, PaymentMethod, type Quote } from "@db/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Minus, X, UserPlus } from "lucide-react";
import { Link } from "wouter";
import { SignatureCanvas } from "@/components/SignatureCanvas";

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
  downPaymentType: z.enum(["percentage", "fixed"]).optional(),
  downPaymentValue: z.string().optional(),
  notes: z.string().optional(),
  templateId: z.string().min(1, "Template is required"),
  signature: z.object({
    data: z.string(),
    timestamp: z.string(),
    metadata: z.object({
      browserInfo: z.string(),
      ipAddress: z.string(),
      signedAt: z.string(),
      timezone: z.string(),
    }),
  }).optional(),
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
  contact?: any | null;
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

interface Category {
  id: number;
  name: string;
  products: Product[];
}

interface SelectedProduct {
  productId: number;
  quantity: number;
  variation?: string;
  unitPrice: number;
}


export function QuoteForm({ quote, onSuccess, user, defaultContactId, contact }: QuoteFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProducts, setSelectedProducts] = useState(() => {
    if (quote?.content?.products) {
      return quote.content.products.map((p: any) => ({
        productId: p.id,
        quantity: p.quantity || 1,
        variation: p.variation,
        unitPrice: parseFloat(p.price) || 0,
      }));
    }
    return [];
  });

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: templates = [] } = useQuery<any[]>({
    queryKey: ["/api/templates"],
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
      downPaymentType: quote?.downPaymentType || "percentage",
      downPaymentValue: quote?.downPaymentValue?.toString() || "0",
      notes: quote?.notes || "",
      templateId: quote?.templateId?.toString() || "",
      signature: quote?.signature || undefined,
    },
  });

  useEffect(() => {
    if (contact) {
      form.setValue("contactId", contact.id.toString());
      form.setValue("clientName", `${contact.firstName} ${contact.lastName}`);
      form.setValue("clientEmail", contact.primaryEmail);
      form.setValue("clientPhone", contact.primaryPhone);
      form.setValue("clientAddress", contact.primaryAddress);
    }
  }, [contact, form]);

  const selectedContactId = form.watch("contactId");
  useEffect(() => {
    if (selectedContactId && !contact) {
      const selectedContact = contacts.find(c => c.id.toString() === selectedContactId);
      if (selectedContact) {
        form.setValue("clientName", `${selectedContact.firstName} ${selectedContact.lastName}`);
        form.setValue("clientEmail", selectedContact.primaryEmail);
        form.setValue("clientPhone", selectedContact.primaryPhone);
        form.setValue("clientAddress", selectedContact.primaryAddress);
      }
    }
  }, [selectedContactId, contacts, form, contact]);

  const selectedCategoryId = form.watch("categoryId");
  useEffect(() => {
    if (quote?.categoryId && !selectedCategoryId) {
      form.setValue("categoryId", quote.categoryId.toString());
    }
  }, [quote, form, selectedCategoryId]);

  const { data: products = [], isLoading: isLoadingProducts } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    select: (data) =>
      data.filter((product) => product.categoryId.toString() === selectedCategoryId),
    enabled: !!selectedCategoryId,
  });

  useEffect(() => {
    if (selectedCategoryId && templates?.length > 0) {
      const categoryTemplates = templates.filter((t) => t.categoryId.toString() === selectedCategoryId);
      const defaultTemplate = categoryTemplates.find((t) => t.isDefault) || categoryTemplates[0];

      if (defaultTemplate) {
        form.setValue("templateId", defaultTemplate.id.toString());
      }
    }
  }, [selectedCategoryId, templates, form]);

  const parseNumber = (value: any): number => {
    if (value === undefined || value === null || value === '') return 0;
    const parsed = parseFloat(value.toString());
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

  const calculateDownPayment = () => {
    const total = calculateTotal();
    const downPaymentType = form.watch("downPaymentType");
    const downPaymentValue = parseNumber(form.watch("downPaymentValue"));

    return downPaymentType === "percentage"
      ? (total * downPaymentValue) / 100
      : downPaymentValue;
  };

  const calculateRemainingBalance = () => {
    const total = calculateTotal();
    const downPayment = calculateDownPayment();
    return total - downPayment;
  };

  const addProduct = (product: Product, variationPrice?: string) => {
    setSelectedProducts(prev => [
      ...prev,
      {
        productId: product.id,
        quantity: 1,
        variation: variationPrice ? product.variations?.find(v => v.price === variationPrice)?.name : undefined,
        unitPrice: variationPrice ? parseFloat(variationPrice) : product.basePrice,
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

  const mutation = useMutation({
    mutationFn: async (data: z.infer<typeof quoteFormSchema>) => {
      const total = calculateTotal();
      const downPayment = calculateDownPayment();
      const remainingBalance = calculateRemainingBalance();
      const subtotal = calculateSubtotal();
      const discount = calculateDiscount();
      const tax = calculateTax();

      const formattedProducts = selectedProducts.map(item => {
        const product = products.find(p => p.id === item.productId);
        return {
          id: item.productId,
          quantity: item.quantity,
          name: product?.name,
          price: parseNumber(item.unitPrice),
          variation: item.variation,
          unit: product?.unit
        };
      });

      const quoteData = {
        contactId: parseInt(data.contactId),
        categoryId: parseInt(data.categoryId),
        templateId: parseInt(data.templateId),
        clientName: data.clientName,
        clientEmail: data.clientEmail,
        clientPhone: data.clientPhone,
        clientAddress: data.clientAddress,
        status: data.status,
        paymentMethod: data.paymentMethod,
        subtotal: parseNumber(subtotal),
        total: parseNumber(total),
        downPaymentType: data.downPaymentType,
        downPaymentValue: parseNumber(data.downPaymentValue),
        remainingBalance: parseNumber(remainingBalance),
        discountType: data.discountType,
        discountValue: parseNumber(data.discountValue),
        discountCode: data.discountCode,
        taxRate: parseNumber(data.taxRate),
        taxAmount: parseNumber(tax),
        content: {
          products: formattedProducts,
          calculations: {
            subtotal: parseNumber(subtotal),
            total: parseNumber(total),
            downPayment: parseNumber(downPayment),
            remainingBalance: parseNumber(remainingBalance),
            discount: parseNumber(discount),
            tax: parseNumber(tax)
          },
        },
        signature: data.signature,
      };

      const response = await fetch(quote ? `/api/quotes/${quote.id}` : "/api/quotes", {
        method: quote ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(quoteData),
        credentials: "include",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
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

  const onSubmit = (data: z.infer<typeof quoteFormSchema>) => {
    if (selectedProducts.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one product to the quote",
        variant: "destructive",
      });
      return;
    }
    mutation.mutate(data);
  };

  const autoSaveMutation = useMutation({
    mutationFn: async (data: z.infer<typeof quoteFormSchema>) => {
      if (!quote?.id) return; // Only auto-save existing quotes

      const total = calculateTotal();
      const downPayment = calculateDownPayment();
      const remainingBalance = calculateRemainingBalance();
      const subtotal = calculateSubtotal();
      const discount = calculateDiscount();
      const tax = calculateTax();

      const formattedProducts = selectedProducts.map(item => {
        const product = products.find(p => p.id === item.productId);
        return {
          id: item.productId,
          quantity: item.quantity,
          name: product?.name,
          price: parseNumber(item.unitPrice),
          variation: item.variation,
          unit: product?.unit
        };
      });

      setIsAutoSaving(true);

      const response = await fetch(`/api/quotes/${quote.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contactId: parseInt(data.contactId),
          categoryId: parseInt(data.categoryId),
          templateId: parseInt(data.templateId),
          clientName: data.clientName,
          clientEmail: data.clientEmail,
          clientPhone: data.clientPhone,
          clientAddress: data.clientAddress,
          selectedProducts: formattedProducts,
          subtotal: parseNumber(subtotal),
          total: parseNumber(total),
          downPaymentValue: parseNumber(downPayment),
          remainingBalance: parseNumber(remainingBalance),
          discountType: data.discountType,
          discountValue: parseNumber(data.discountValue),
          discountCode: data.discountCode,
          taxRate: parseNumber(data.taxRate),
          taxAmount: parseNumber(tax),
          status: data.status,
          paymentMethod: data.paymentMethod,
          downPaymentType: data.downPaymentType,
          notes: data.notes,
          content: {
            products: formattedProducts,
            calculations: {
              subtotal: parseNumber(subtotal),
              total: parseNumber(total),
              downPayment: parseNumber(downPayment),
              remainingBalance: parseNumber(remainingBalance),
              discount: parseNumber(discount),
              tax: parseNumber(tax)
            },
          },
          signature: data.signature,
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

  const debouncedAutoSave = useDebouncedCallback((data: z.infer<typeof quoteFormSchema>) => {
    if (quote?.id) {
      autoSaveMutation.mutate(data);
    }
  }, 2000); // Auto-save after 2 seconds of no changes

  useEffect(() => {
    const subscription = form.watch((value) => {
      if (quote?.id && Object.keys(form.formState.dirtyFields).length > 0) {
        debouncedAutoSave(value as z.infer<typeof quoteFormSchema>);
      }
    });
    return () => subscription.unsubscribe();
  }, [form, quote?.id, debouncedAutoSave]);

  const [showSignature, setShowSignature] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const handleSignatureSave = (signatureData: {
    data: string;
    timestamp: string;
    metadata: {
      browserInfo: string;
      ipAddress: string;
      signedAt: string;
      timezone: string;
    };
  }) => {
    const formData = form.getValues();
    mutation.mutate({
      ...formData,
      signature: signatureData,
    });
  };

  const status = form.watch("status");
  useEffect(() => {
    if (status === QuoteStatus.ACCEPTED && !quote?.signature) {
      setShowSignature(true);
    }
  }, [status, quote?.signature]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a contact" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {contacts.map((contact) => (
                        <SelectItem key={contact.id} value={contact.id.toString()}>
                          {contact.firstName} {contact.lastName} - {contact.primaryEmail}
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
                      <Input type="email" {...field} />
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
                      <Input type="tel" {...field} />
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
                        {categories.map((category) => (
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
                          .filter((t) => t.categoryId.toString() === form.watch("categoryId"))
                          .map((template) => (
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
            </div>
          </CardContent>
        </Card>

        {form.watch("categoryId") && (
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
                                Base Price: ${product.basePrice}/{product.unit}
                              </p>
                            </div>
                            {product.variations ? (
                              <Select onValueChange={(value) => addProduct(product, value)}>
                                <FormControl>
                                  <SelectTrigger className="w-[140px]">
                                    <SelectValue placeholder="Select variant" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {product.variations.map((variation) => (
                                    <SelectItem key={variation.name} value={variation.price}>
                                      {variation.name} - ${variation.price}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => addProduct(product)}
                                className="w-[140px]"
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Add to Quote
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
                      {selectedProducts.map((item, index) => {
                        const product = products.find(p => p.id === item.productId);
                        return (
                          <div key={index} className="flex items-center gap-4 p-2 border rounded-md">
                            <div className="flex-1">
                              <p className="font-medium">
                                {product?.name}
                                {item.variation && ` - ${item.variation}`}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                ${item.unitPrice}/{product?.unit}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => updateQuantity(index, item.quantity - 1)}
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <Input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => updateQuantity(index, parseInt(e.target.value) || 1)}
                                className="w-20 text-center"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => updateQuantity(index, item.quantity + 1)}
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
                        );
                      })}
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
                name="discountValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Discount Value
                      {form.watch("discountType") === "percentage" ? " (%)" : " ($)"}
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
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
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
                          <SelectValue />
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
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
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

              <FormField
                control={form.control}
                name="downPaymentValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Down Payment Value
                      {form.watch("downPaymentType") === "percentage" ? " (%)" : " ($)"}
                    </FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>${calculateSubtotal().toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Discount:</span>
                <span>-${calculateDiscount().toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax:</span>
                <span>${calculateTax().toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Total:</span>
                <span>${calculateTotal().toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Down Payment:</span>
                <span>${calculateDownPayment().toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Remaining Balance:</span>
                <span>${calculateRemainingBalance().toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {status === QuoteStatus.ACCEPTED && !quote?.signature && (
          <SignatureCanvas
            isOpen={showSignature}
            onClose={() => setShowSignature(false)}
            onSave={handleSignatureSave}
            title="Sign Quote"
            description="Please sign below to accept this quote. Your signature will be recorded with a timestamp and other verification data."
          />
        )}

        {quote?.signature && (
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-2">Signature Information</h3>
              <div className="space-y-2">
                <img
                  src={quote.signature.data}
                  alt="Signature"
                  className="border rounded p-2 max-w-md"
                />
                <p className="text-sm text-muted-foreground">
                  Signed on: {new Date(quote.signature.timestamp).toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">
                  Timezone: {quote.signature.metadata.timezone}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-2">
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