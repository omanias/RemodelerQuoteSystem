import { useState } from "react";
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
import { Plus, Minus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  variations?: Record<string, any>[];
}

// Schema for the form
const quoteFormSchema = z.object({
  // Step 1: Contact Information
  contactInfo: z.object({
    contactId: z.string().optional(),
    clientName: z.string().min(1, "Client name is required"),
    clientEmail: z.string().email().optional().nullable(),
    clientPhone: z.string().optional().nullable(),
    clientAddress: z.string().optional().nullable(),
  }),
  // Step 2: Category and Template
  categoryAndTemplate: z.object({
    categoryId: z.number().min(1, "Category is required"),
    templateId: z.number().min(1, "Template is required"),
  }),
  // Step 3: Products
  products: z.array(z.object({
    productId: z.number(),
    quantity: z.number().min(1),
    variation: z.string().optional(),
    unitPrice: z.number(),
  })),
  // Step 4: Calculations
  calculations: z.object({
    subtotal: z.number(),
    discountType: z.enum(["PERCENTAGE", "FIXED"]).optional().nullable(),
    discountValue: z.number().optional().nullable(),
    downPaymentType: z.enum(["PERCENTAGE", "FIXED"]).optional().nullable(),
    downPaymentValue: z.number().optional().nullable(),
    taxRate: z.number().optional().nullable(),
    total: z.number(),
  }),
});

type QuoteFormValues = z.infer<typeof quoteFormSchema>;

interface Props {
  onSuccess: () => void;
  defaultValues?: Partial<QuoteFormValues>;
}

export function MultiStepQuoteBuilder({ onSuccess, defaultValues }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [showNewContactForm, setShowNewContactForm] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current user
  const { data: user } = useQuery({
    queryKey: ["/api/auth/user"],
  });

  // Get current company
  const { data: company } = useQuery({
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

  // Create quote mutation
  const { mutate: createQuote, isLoading: isCreating } = useMutation({
    mutationFn: async (data: QuoteFormValues) => {
      if (!user?.id || !company?.id) {
        throw new Error("User or company information is missing");
      }

      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          companyId: company.id,
          status: "DRAFT",
          clientName: data.contactInfo.clientName,
          clientEmail: data.contactInfo.clientEmail,
          clientPhone: data.contactInfo.clientPhone,
          clientAddress: data.contactInfo.clientAddress,
          categoryId: data.categoryAndTemplate.categoryId,
          templateId: data.categoryAndTemplate.templateId,
          content: {
            products: data.products.map(product => ({
              ...product,
              quantity: Number(product.quantity),
              unitPrice: Number(product.unitPrice),
            })),
          },
          subtotal: Number(data.calculations.subtotal),
          total: Number(data.calculations.total),
          discountType: data.calculations.discountType,
          discountValue: data.calculations.discountValue ? Number(data.calculations.discountValue) : null,
          downPaymentType: data.calculations.downPaymentType,
          downPaymentValue: data.calculations.downPaymentValue ? Number(data.calculations.downPaymentValue) : null,
          taxRate: data.calculations.taxRate ? Number(data.calculations.taxRate) : null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create quote");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({
        title: "Success",
        description: "Quote created successfully",
      });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create quote. Please try again.",
        variant: "destructive",
      });
    },
  });

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

    form.setValue("calculations.subtotal", subtotal);
    form.setValue("calculations.total", total);
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
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const previousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const onSubmit = (data: QuoteFormValues) => {
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

    createQuote(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card className="p-6">
          <Steps
            steps={steps.map((step) => ({
              title: step.title,
              description: step.description,
            }))}
            currentStep={currentStep}
          />

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
              <Button type="submit" disabled={isCreating}>
                {isCreating ? "Creating..." : "Create Quote"}
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