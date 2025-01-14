import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
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
import { Plus } from "lucide-react";

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
              <Form {...form}>
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
              </Form>
            </div>
          )}
        </div>
      ),
    },
    // Additional steps will be implemented in the next iteration
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

  return (
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
        <Button
          type="button"
          onClick={nextStep}
          disabled={currentStep === steps.length - 1}
        >
          Next
        </Button>
      </div>
    </Card>
  );
}