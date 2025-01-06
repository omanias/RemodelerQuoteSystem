import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const emailTemplateSchema = z.object({
  quoteCreated: z.string(),
  quoteSent: z.string(),
  quoteAccepted: z.string(),
  quoteRejected: z.string(),
  quoteRevised: z.string(),
  paymentReceived: z.string(),
});

type EmailTemplateValues = z.infer<typeof emailTemplateSchema>;

const TEMPLATE_VARIABLES = [
  { label: "Client Name", value: "{{clientName}}" },
  { label: "Quote Number", value: "{{quoteNumber}}" },
  { label: "Quote Total", value: "{{quoteTotal}}" },
  { label: "Company Name", value: "{{companyName}}" },
  { label: "Sales Rep Name", value: "{{salesRepName}}" },
];

export function EmailTemplates() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: templates, isLoading } = useQuery<EmailTemplateValues>({
    queryKey: ["/api/settings/email-templates"],
  });

  const form = useForm<EmailTemplateValues>({
    resolver: zodResolver(emailTemplateSchema),
    defaultValues: {
      quoteCreated: templates?.quoteCreated || "",
      quoteSent: templates?.quoteSent || "",
      quoteAccepted: templates?.quoteAccepted || "",
      quoteRejected: templates?.quoteRejected || "",
      quoteRevised: templates?.quoteRevised || "",
      paymentReceived: templates?.paymentReceived || "",
    },
  });

  const updateTemplates = useMutation({
    mutationFn: async (data: EmailTemplateValues) => {
      const response = await fetch("/api/settings/email-templates", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update email templates");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/email-templates"] });
      toast({
        title: "Success",
        description: "Email templates updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EmailTemplateValues) => {
    updateTemplates.mutate(data);
  };

  const insertVariable = (variable: string, fieldName: keyof EmailTemplateValues) => {
    const textarea = document.querySelector(`textarea[name="${fieldName}"]`) as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = form.getValues(fieldName);
      const newText = text.substring(0, start) + variable + text.substring(end);
      form.setValue(fieldName, newText);
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Available Variables</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {TEMPLATE_VARIABLES.map((variable) => (
                <Button
                  key={variable.value}
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => {
                    const activeField = document.activeElement as HTMLTextAreaElement;
                    if (activeField?.name) {
                      insertVariable(variable.value, activeField.name as keyof EmailTemplateValues);
                    }
                  }}
                >
                  {variable.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <FormField
            control={form.control}
            name="quoteCreated"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quote Created Template</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    rows={4}
                    placeholder="Enter the email template for when a quote is created..."
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="quoteSent"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quote Sent Template</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    rows={4}
                    placeholder="Enter the email template for when a quote is sent..."
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="quoteAccepted"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quote Accepted Template</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    rows={4}
                    placeholder="Enter the email template for when a quote is accepted..."
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="quoteRejected"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quote Rejected Template</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    rows={4}
                    placeholder="Enter the email template for when a quote is rejected..."
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="quoteRevised"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quote Revised Template</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    rows={4}
                    placeholder="Enter the email template for when a quote is revised..."
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="paymentReceived"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Received Template</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    rows={4}
                    placeholder="Enter the email template for when a payment is received..."
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button type="submit" disabled={updateTemplates.isPending}>
          Save Changes
        </Button>
      </form>
    </Form>
  );
}
