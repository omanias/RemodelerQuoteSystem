import { useState, useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Steps } from "@/components/ui/steps";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Minus, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import debounce from "lodash/debounce";

interface Contact {
  id: number;
  firstName: string;
  lastName: string;
  primaryEmail: string;
  primaryPhone: string;
  primaryAddress: string;
}

interface Category {
  id: number;
  name: string;
}

interface Template {
  id: number;
  name: string;
}

interface Product {
  id: number;
  name: string;
  basePrice: number;
  unit: string;
  variations?: { name: string; price: number }[];
}

interface User {
  id: number;
  // Add other user fields as needed
}

interface Company {
  id: number;
  // Add other company fields as needed
}

// Schema for the form
const quoteFormSchema = z.object({
  contactInfo: z.object({
    contactId: z.string().optional(),
    clientName: z.string().min(1, "Client name is required"),
    clientEmail: z.string().email().optional().nullable(),
    clientPhone: z.string().optional().nullable(),
    clientAddress: z.string().optional().nullable(),
  }),
  categoryAndTemplate: z.object({
    categoryId: z.number().min(1, "Category is required"),
    templateId: z.number().min(1, "Template is required"),
  }),
  products: z.array(z.object({
    productId: z.number(),
    quantity: z.number().min(1),
    variation: z.string().optional(),
    unitPrice: z.number(),
  })).min(1, "At least one product is required"),
  calculations: z.object({
    subtotal: z.number(),
    discountType: z.enum(["PERCENTAGE", "FIXED"]).optional().nullable(),
    discountValue: z.number().optional().nullable(),
    downPaymentType: z.enum(["PERCENTAGE", "FIXED"]).optional().nullable(),
    downPaymentValue: z.number().optional().nullable(),
    taxRate: z.number().optional().nullable(),
    total: z.number(),
    remaining: z.number().optional(),
  }),
});

type QuoteFormValues = z.infer<typeof quoteFormSchema>;

interface Props {
  onSuccess?: () => void;
  defaultValues?: Partial<QuoteFormValues>;
}

export function MultiStepQuoteBuilder({ onSuccess, defaultValues }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [showNewContactForm, setShowNewContactForm] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [quoteId, setQuoteId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current user
  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  // Get current company
  const { data: company } = useQuery<Company>({
    queryKey: ["/api/companies/current"],
  });

  const form = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: defaultValues || {
      contactInfo: {
        clientName: "",
        clientEmail: null,
        clientPhone: null,
        clientAddress: null,
      },
      categoryAndTemplate: {
        categoryId: 0,
        templateId: 0,
      },
      products: [],
      calculations: {
        subtotal: 0,
        total: 0,
        discountType: null,
        discountValue: null,
        downPaymentType: null,
        downPaymentValue: null,
        taxRate: null,
      },
    },
  });

  // Fetch contacts
  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  // Fetch categories
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  // Fetch templates based on selected category
  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ["/api/templates", form.watch("categoryAndTemplate.categoryId")],
    enabled: !!form.watch("categoryAndTemplate.categoryId"),
  });

  // Fetch products based on selected category
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products", form.watch("categoryAndTemplate.categoryId")],
    enabled: !!form.watch("categoryAndTemplate.categoryId"),
  });

  // Create or update quote mutation
  const { mutate: createOrUpdateQuote, isPending } = useMutation({
    mutationFn: async (data: QuoteFormValues) => {
      if (!user?.id || !company?.id) {
        throw new Error("User or company information is missing");
      }

      const payload = {
        userId: user.id,
        companyId: company.id,
        status: "DRAFT",
        categoryId: data.categoryAndTemplate.categoryId,
        templateId: data.categoryAndTemplate.templateId,
        clientName: data.contactInfo.clientName,
        clientEmail: data.contactInfo.clientEmail,
        clientPhone: data.contactInfo.clientPhone,
        clientAddress: data.contactInfo.clientAddress,
        content: {
          products: data.products.map(product => ({
            id: product.productId,
            name: products.find(p => p.id === product.productId)?.name || '',
            quantity: Number(product.quantity),
            price: Number(product.unitPrice),
            variation: product.variation
          })),
        },
        subtotal: data.calculations.subtotal.toFixed(2),
        total: data.calculations.total.toFixed(2),
        discountType: data.calculations.discountType || null,
        discountValue: data.calculations.discountValue ? data.calculations.discountValue.toFixed(2) : null,
        downPaymentType: data.calculations.downPaymentType || null,
        downPaymentValue: data.calculations.downPaymentValue ? data.calculations.downPaymentValue.toFixed(2) : null,
        taxRate: data.calculations.taxRate ? data.calculations.taxRate.toFixed(2) : null,
      };

      const endpoint = quoteId ? `/api/quotes/${quoteId}` : "/api/quotes";
      const method = quoteId ? "PUT" : "POST";

      console.log(`${method}ing quote with payload:`, payload);

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Server response error:", errorText);
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.message || "Failed to save quote");
        } catch (e) {
          throw new Error(`Server error: ${errorText}`);
        }
      }

      const responseData = await response.json();
      console.log("Quote saved successfully:", responseData);
      return responseData;
    },
    onSuccess: (data) => {
      if (!quoteId) {
        setQuoteId(data.id);
      }
      setLastSavedAt(new Date());
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });

      toast({
        title: "Success",
        description: `Quote ${quoteId ? 'updated' : 'created'} successfully`,
      });
    },
    onError: (error: Error) => {
      console.error("Quote save error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save quote. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Debounced autosave function
  const debouncedSave = useCallback(
    debounce((data: QuoteFormValues) => {
      if (data.contactInfo.clientName && // Only save if we have at least a client name
        !isPending) {
        createOrUpdateQuote(data);
      }
    }, 2000),
    [createOrUpdateQuote, isPending]
  );

  // Watch for form changes and trigger autosave
  useEffect(() => {
    const subscription = form.watch((formData) => {
      if (formData) {
        debouncedSave(form.getValues());
      }
    });

    return () => {
      subscription.unsubscribe();
      debouncedSave.cancel();
    };
  }, [form, debouncedSave]);

  const calculateTotals = () => {
    const products = form.watch("products");
    const subtotal = products.reduce((acc, product) => acc + (product.quantity * product.unitPrice), 0);

    let total = subtotal;
    const calculations = form.watch("calculations");

    // Apply discount
    if (calculations.discountValue && calculations.discountType) {
      if (calculations.discountType === "PERCENTAGE") {
        total -= (total * (calculations.discountValue / 100));
      } else {
        total -= calculations.discountValue;
      }
    }

    // Apply tax
    if (calculations.taxRate) {
      total += (total * (calculations.taxRate / 100));
    }

    // Apply down payment
    if (calculations.downPaymentValue && calculations.downPaymentType) {
      let downPayment = 0;
      if (calculations.downPaymentType === "PERCENTAGE") {
        downPayment = total * (calculations.downPaymentValue / 100);
      } else {
        downPayment = calculations.downPaymentValue;
      }
      total -= downPayment;
    }

    // Calculate remaining balance
    const remaining = total - (calculations.downPaymentValue || 0);

    form.setValue("calculations.subtotal", subtotal);
    form.setValue("calculations.total", total);
    form.setValue("calculations.remaining", remaining);
  };



  const steps = [
    {
      title: "Contact Info",
      description: "Select or create a contact",
      content: (
        <div className="space-y-4">
          {!showNewContactForm ? (
            <>
              <div className="flex justify-between items-center">
                <Label>Select Contact</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNewContactForm(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Contact
                </Button>
              </div>
              <Select
                onValueChange={(value) => {
                  const contact = contacts.find((c) => c.id === parseInt(value));
                  if (contact) {
                    form.setValue("contactInfo", {
                      contactId: value,
                      clientName: `${contact.firstName} ${contact.lastName}`,
                      clientEmail: contact.primaryEmail,
                      clientPhone: contact.primaryPhone,
                      clientAddress: contact.primaryAddress,
                    });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a contact" />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id.toString()}>
                      {contact.firstName} {contact.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label>New Contact</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNewContactForm(false)}
                >
                  Cancel
                </Button>
              </div>
              <div className="space-y-4">
                <Input
                  placeholder="Client Name"
                  {...form.register("contactInfo.clientName")}
                />
                <Input
                  type="email"
                  placeholder="Email"
                  {...form.register("contactInfo.clientEmail")}
                />
                <Input
                  placeholder="Phone"
                  {...form.register("contactInfo.clientPhone")}
                />
                <Input
                  placeholder="Address"
                  {...form.register("contactInfo.clientAddress")}
                />
              </div>
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Category & Template",
      description: "Select quote category and template",
      content: (
        <div className="space-y-4">
          <div>
            <Label>Category</Label>
            <Select
              onValueChange={(value) => {
                form.setValue("categoryAndTemplate.categoryId", parseInt(value));
                form.setValue("categoryAndTemplate.templateId", 0);
                form.setValue("products", []);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id.toString()}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {form.watch("categoryAndTemplate.categoryId") > 0 && (
            <div>
              <Label>Template</Label>
              <Select
                onValueChange={(value) => {
                  form.setValue("categoryAndTemplate.templateId", parseInt(value));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id.toString()}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Products",
      description: "Add products to quote",
      content: (
        <div className="space-y-4">
          {products.map((product) => (
            <Card key={product.id} className="p-4">
              <div className="flex flex-col space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{product.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      ${product.basePrice} per {product.unit}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const products = form.watch("products");
                        const existingProduct = products.find(p => p.productId === product.id);
                        if (existingProduct) {
                          form.setValue(
                            "products",
                            products.map(p =>
                              p.productId === product.id
                                ? { ...p, quantity: p.quantity - 1 }
                                : p
                            ).filter(p => p.quantity > 0)
                          );
                        }
                        calculateTotals();
                      }}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-8 text-center">
                      {form.watch("products").find(p => p.productId === product.id)?.quantity || 0}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const products = form.watch("products");
                        const existingProduct = products.find(p => p.productId === product.id);
                        if (existingProduct) {
                          form.setValue(
                            "products",
                            products.map(p =>
                              p.productId === product.id
                                ? { ...p, quantity: p.quantity + 1 }
                                : p
                            )
                          );
                        } else {
                          form.setValue("products", [
                            ...products,
                            {
                              productId: product.id,
                              quantity: 1,
                              unitPrice: product.basePrice,
                            },
                          ]);
                        }
                        calculateTotals();
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Add variation selector if product has variations */}
                {product.variations && product.variations.length > 0 && (
                  <div className="mt-2">
                    <Select
                      onValueChange={(value) => {
                        const products = form.watch("products");
                        const selectedVariation = product.variations?.find(v => v.name === value);
                        const existingProduct = products.find(p => p.productId === product.id);

                        if (existingProduct && selectedVariation) {
                          form.setValue(
                            "products",
                            products.map(p =>
                              p.productId === product.id
                                ? {
                                  ...p,
                                  variation: value,
                                  unitPrice: selectedVariation.price || product.basePrice
                                }
                                : p
                            )
                          );
                          calculateTotals();
                        }
                      }}
                      value={form.watch("products").find(p => p.productId === product.id)?.variation}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select variation" />
                      </SelectTrigger>
                      <SelectContent>
                        {product.variations.map((variation, index) => (
                          <SelectItem key={index} value={variation.name}>
                            {variation.name} - ${variation.price}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      ),
    },
    {
      title: "Calculations",
      description: "Add discounts and payments",
      content: (
        <div className="space-y-4">
          <div>
            <Label>Discount Type</Label>
            <Select
              onValueChange={(value) => {
                form.setValue("calculations.discountType", value as any);
                calculateTotals();
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select discount type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                <SelectItem value="FIXED">Fixed Amount</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.watch("calculations.discountType") && (
            <div>
              <Label>Discount Value</Label>
              <Input
                type="number"
                placeholder={form.watch("calculations.discountType") === "PERCENTAGE" ? "%" : "$"}
                onChange={(e) => {
                  form.setValue("calculations.discountValue", Number(e.target.value));
                  calculateTotals();
                }}
              />
            </div>
          )}

          <div>
            <Label>Down Payment Type</Label>
            <Select
              onValueChange={(value) => {
                form.setValue("calculations.downPaymentType", value as any);
                calculateTotals();
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select down payment type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                <SelectItem value="FIXED">Fixed Amount</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.watch("calculations.downPaymentType") && (
            <div>
              <Label>Down Payment Value</Label>
              <Input
                type="number"
                placeholder={form.watch("calculations.downPaymentType") === "PERCENTAGE" ? "%" : "$"}
                onChange={(e) => {
                  form.setValue("calculations.downPaymentValue", Number(e.target.value));
                  calculateTotals();
                }}
              />
            </div>
          )}

          <div>
            <Label>Tax Rate (%)</Label>
            <Input
              type="number"
              placeholder="%"
              onChange={(e) => {
                form.setValue("calculations.taxRate", Number(e.target.value));
                calculateTotals();
              }}
            />
          </div>

          <div className="pt-4 border-t">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>${form.watch("calculations.subtotal").toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Total:</span>
              <span>${form.watch("calculations.total").toFixed(2)}</span>
            </div>
          </div>
        </div>
      ),
    },
  ];

  const nextStep = () => {
    const fields = form.getValues();
    console.log("Current form values:", fields);

    // Validate current step before proceeding
    let isValid = true;

    switch (currentStep) {
      case 0: // Contact Info
        isValid = !!fields.contactInfo.clientName;
        break;
      case 1: // Category & Template
        isValid = fields.categoryAndTemplate.categoryId > 0 && fields.categoryAndTemplate.templateId > 0;
        break;
      case 2: // Products
        isValid = fields.products.length > 0;
        break;
    }

    if (!isValid) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields before proceeding.",
        variant: "destructive",
      });
      return;
    }

    // Save current progress
    createOrUpdateQuote(fields);

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const previousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const onSubmit = async (data: QuoteFormValues) => {
    console.log("Form submitted with values:", data);

    if (!user?.id) {
      toast({
        title: "Error",
        description: "You must be logged in to create quotes",
        variant: "destructive",
      });
      return;
    }

    if (!company?.id) {
      toast({
        title: "Error",
        description: "Company information is missing",
        variant: "destructive",
      });
      return;
    }

    // Validate that at least one product is added
    if (data.products.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one product to the quote",
        variant: "destructive",
      });
      return;
    }

    try {
      // Log validation state before submission
      console.log("Form validation state:", form.formState);

      // Check if form is valid
      if (!form.formState.isValid) {
        console.error("Form validation errors:", form.formState.errors);
        toast({
          title: "Validation Error",
          description: "Please check all required fields",
          variant: "destructive",
        });
        return;
      }

      await createOrUpdateQuote(data);
      // Llamar a onSuccess después de crear exitosamente el quote
      onSuccess?.();
    } catch (error) {
      console.error("Error submitting form:", error);
      toast({
        title: "Error",
        description: "Failed to create quote. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card className="p-6">
          <div className="flex justify-between items-center mb-6">
            <Steps
              steps={steps.map((step) => ({
                title: step.title,
                description: step.description,
              }))}
              currentStep={currentStep}
            />
            {lastSavedAt && (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Save className="h-4 w-4" />
                Last saved: {lastSavedAt.toLocaleTimeString()}
              </div>
            )}
          </div>

          <div className="mt-8">
            {steps[currentStep].content}
          </div>

          <div className="mt-6 flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={previousStep}
              disabled={currentStep === 0}
            >
              Previous
            </Button>
            {currentStep === steps.length - 1 ? (
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating..." : "Create Quote"}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={nextStep}
              >
                Next
              </Button>
            )}
          </div>
        </Card>
      </form>
    </Form>
  );
}