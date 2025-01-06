import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const templateSchema = z.object({
  email: z.object({
    quoteCreated: z.string(),
    quoteSent: z.string(),
    quoteAccepted: z.string(),
    quoteRejected: z.string(),
    quoteRevised: z.string(),
    paymentReceived: z.string(),
  }),
  sms: z.object({
    quoteCreated: z.string(),
    quoteSent: z.string(),
    quoteAccepted: z.string(),
    quoteRejected: z.string(),
    quoteRevised: z.string(),
    paymentReceived: z.string(),
  }),
});

type TemplateValues = z.infer<typeof templateSchema>;

const TEMPLATE_VARIABLES = [
  { label: "Client Name", value: "{{clientName}}" },
  { label: "Quote Number", value: "{{quoteNumber}}" },
  { label: "Quote Total", value: "{{quoteTotal}}" },
  { label: "Company Name", value: "{{companyName}}" },
  { label: "Sales Rep Name", value: "{{salesRepName}}" },
];

const TEMPLATE_TYPES = [
  { id: "quoteCreated", label: "Quote Created" },
  { id: "quoteSent", label: "Quote Sent" },
  { id: "quoteAccepted", label: "Quote Accepted" },
  { id: "quoteRejected", label: "Quote Rejected" },
  { id: "quoteRevised", label: "Quote Revised" },
  { id: "paymentReceived", label: "Payment Received" },
] as const;

export function MessageTemplates() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: templates, isLoading } = useQuery<TemplateValues>({
    queryKey: ["/api/settings/message-templates"],
  });

  const form = useForm<TemplateValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      email: {
        quoteCreated: templates?.email.quoteCreated || "",
        quoteSent: templates?.email.quoteSent || "",
        quoteAccepted: templates?.email.quoteAccepted || "",
        quoteRejected: templates?.email.quoteRejected || "",
        quoteRevised: templates?.email.quoteRevised || "",
        paymentReceived: templates?.email.paymentReceived || "",
      },
      sms: {
        quoteCreated: templates?.sms?.quoteCreated || "",
        quoteSent: templates?.sms?.quoteSent || "",
        quoteAccepted: templates?.sms?.quoteAccepted || "",
        quoteRejected: templates?.sms?.quoteRejected || "",
        quoteRevised: templates?.sms?.quoteRevised || "",
        paymentReceived: templates?.sms?.paymentReceived || "",
      },
    },
  });

  const updateTemplates = useMutation({
    mutationFn: async (data: TemplateValues) => {
      const response = await fetch("/api/settings/message-templates", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update message templates");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/message-templates"] });
      toast({
        title: "Success",
        description: "Message templates updated successfully",
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

  const onSubmit = (data: TemplateValues) => {
    updateTemplates.mutate(data);
  };

  const insertVariable = (variable: string, fieldName: string) => {
    const textarea = document.querySelector(`textarea[name="${fieldName}"]`) as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = form.getValues(fieldName);
      const newText = text.substring(0, start) + variable + text.substring(end);
      form.setValue(fieldName as any, newText);
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
                      insertVariable(variable.value, activeField.name);
                    }
                  }}
                >
                  {variable.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="email" className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="email">Email Templates</TabsTrigger>
            <TabsTrigger value="sms">SMS Templates</TabsTrigger>
          </TabsList>

          <TabsContent value="email" className="mt-6">
            <div className="space-y-6">
              {TEMPLATE_TYPES.map((type) => (
                <FormField
                  key={`email-${type.id}`}
                  control={form.control}
                  name={`email.${type.id}`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{type.label} Template</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          rows={4}
                          placeholder={`Enter the email template for when a quote is ${type.id.toLowerCase()}...`}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="sms" className="mt-6">
            <div className="space-y-6">
              {TEMPLATE_TYPES.map((type) => (
                <FormField
                  key={`sms-${type.id}`}
                  control={form.control}
                  name={`sms.${type.id}`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{type.label} Template</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          rows={2}
                          placeholder={`Enter the SMS template for when a quote is ${type.id.toLowerCase()}...`}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <Button type="submit" disabled={updateTemplates.isPending}>
          Save Changes
        </Button>
      </form>
    </Form>
  );
}