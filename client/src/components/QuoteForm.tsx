import { useState, useEffect } from "react";
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
import { QuoteStatus, PaymentMethod, type Quote } from "@db/schema";
import { Card, CardContent } from "@/components/ui/card";
import { UserPlus } from "lucide-react";
import { Link } from "wouter";

// Quote form schema that matches the database types
const quoteFormSchema = z.object({
  contactId: z.string().nullable(),
  templateId: z.string().nullable(),
  categoryId: z.string().nullable(),
  clientName: z.string().min(1, "Client name is required"),
  clientEmail: z.string().email("Invalid email address").nullable(),
  clientPhone: z.string().nullable(),
  clientAddress: z.string().nullable(),
  status: z.nativeEnum(QuoteStatus),
  content: z.record(z.any()).default({}),
  subtotal: z.number().min(0),
  total: z.number().min(0),
  notes: z.string().nullable(),
  paymentMethod: z.nativeEnum(PaymentMethod).nullable(),
  discountType: z.enum(["PERCENTAGE", "FIXED"]).nullable(),
  discountValue: z.number().min(0).nullable(),
  discountCode: z.string().nullable(),
  downPaymentType: z.enum(["PERCENTAGE", "FIXED"]).nullable(),
  downPaymentValue: z.number().min(0).nullable(),
});

type QuoteFormValues = z.infer<typeof quoteFormSchema>;

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
  contact?: any;
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
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>(() => {
    if (quote?.content && typeof quote.content === 'object' && 'products' in quote.content) {
      return (quote.content.products as any[]).map((p: any) => ({
        productId: p.id,
        quantity: p.quantity || 1,
        variation: p.variation,
        unitPrice: Number(p.price) || 0,
      }));
    }
    return [];
  });

  const form = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: {
      contactId: quote?.contactId?.toString() || defaultContactId || null,
      templateId: quote?.templateId?.toString() || null,
      categoryId: quote?.categoryId?.toString() || null,
      clientName: quote?.clientName || (contact ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim() : ""),
      clientEmail: quote?.clientEmail || contact?.primaryEmail || null,
      clientPhone: quote?.clientPhone || contact?.primaryPhone || null,
      clientAddress: quote?.clientAddress || contact?.primaryAddress || null,
      status: quote?.status || QuoteStatus.DRAFT,
      content: quote?.content || {},
      subtotal: quote ? Number(quote.subtotal) : 0,
      total: quote ? Number(quote.total) : 0,
      notes: quote?.notes || null,
      paymentMethod: quote?.paymentMethod || null,
      discountType: (quote?.discountType as "PERCENTAGE" | "FIXED" | null) || null,
      discountValue: quote?.discountValue ? Number(quote.discountValue) : null,
      discountCode: null,
      downPaymentType: (quote?.downPaymentType as "PERCENTAGE" | "FIXED" | null) || null,
      downPaymentValue: quote?.downPaymentValue ? Number(quote.downPaymentValue) : null,
    },
  });

  // Basic form submission handler
  const onSubmit = async (data: QuoteFormValues) => {
    try {
      if (selectedProducts.length === 0) {
        toast({
          title: "Error",
          description: "Please add at least one product to the quote",
          variant: "destructive",
        });
        return;
      }

      const url = quote ? `/api/quotes/${quote.id}` : "/api/quotes";
      const method = quote ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          content: {
            ...data.content,
            products: selectedProducts,
          },
        }),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to save quote");
      }

      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      if (quote) {
        queryClient.invalidateQueries({ queryKey: [`/api/quotes/${quote.id}`] });
      }

      toast({
        title: "Success",
        description: quote ? "Quote updated successfully" : "Quote created successfully",
      });

      onSuccess?.();
    } catch (error) {
      console.error("Form submission error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save quote",
        variant: "destructive",
      });
    }
  };

  const { data: contacts = [] } = useQuery<any[]>({
    queryKey: ["/api/contacts"],
  });

  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ["/api/categories"],
  });

  const { data: templates = [] } = useQuery<any[]>({
    queryKey: ["/api/templates"],
  });

  const { data: products = [], isLoading: isLoadingProducts } = useQuery<any[]>({
    queryKey: ["/api/products"],
    select: (data) =>
      data.filter((product:any) => product.categoryId.toString() === form.watch("categoryId")),
    enabled: !!form.watch("categoryId"),
  });


  const addProduct = (product: any, variationPrice?: string) => {
    if (variationPrice) {
      const variation = product.variations?.find((v:any) => v.price === variationPrice);
      if (variation) {
        setSelectedProducts((prev) => [
          ...prev,
          {
            productId: product.id,
            quantity: 1,
            variation: variation.name,
            unitPrice: parseFloat(variationPrice),
          },
        ]);
      }
    } else {
      setSelectedProducts((prev) => [
        ...prev,
        {
          productId: product.id,
          quantity: 1,
          unitPrice: product.basePrice,
        },
      ]);
    }
  };

  const updateQuantity = (index: number, value: number) => {
    setSelectedProducts((prev) =>
      prev.map((item, i) => (i === index ? { ...item, quantity: Math.max(1, value) } : item))
    );
  };

  const removeProduct = (index: number) => {
    setSelectedProducts((prev) => prev.filter((_, i) => i !== index));
  };

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
                      {contacts.map((contact:any) => (
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
                        {categories.map((category:any) => (
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
                          .filter((t:any) => t.categoryId.toString() === form.watch("categoryId"))
                          .map((template:any) => (
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
                    {products.map((product:any) => (
                      <Card key={product.id}>
                        <CardContent className="pt-6">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium">{product.name}</h4>
                              <p className="text-sm text-muted-foreground">
                                Base Price: ${product.basePrice}/{product.unit}
                              </p>
                            </div>
                            {product.variations?.length ? (
                              <Select onValueChange={(value) => addProduct(product, value)}>
                                <FormControl>
                                  <SelectTrigger className="w-[140px]">
                                    <SelectValue placeholder="Select variant" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {product.variations.map((variation:any) => (
                                    <SelectItem key={variation.name} value={variation.price}>
                                      {variation.name} - ${variation.price}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => addProduct(product)}
                                className="h-8 w-8"
                              >
                                <UserPlus className="h-4 w-4" />
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
                        const product = products.find((p:any) => p.id === item.productId);
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
                                <UserPlus className="h-4 w-4" />
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
                                <UserPlus className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeProduct(index)}
                              >
                                <UserPlus className="h-4 w-4" />
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

        <div className="flex justify-end">
          <Button type="submit">
            {quote ? "Update Quote" : "Create Quote"}
          </Button>
        </div>
      </form>
    </Form>
  );
}