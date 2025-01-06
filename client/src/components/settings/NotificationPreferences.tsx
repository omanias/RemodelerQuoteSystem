import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";

const notificationPreferencesSchema = z.object({
  emailNotifications: z.object({
    quoteCreated: z.boolean(),
    quoteSent: z.boolean(),
    quoteAccepted: z.boolean(),
    quoteRejected: z.boolean(),
    quoteRevised: z.boolean(),
    paymentReceived: z.boolean(),
  }),
  inAppNotifications: z.object({
    quoteCreated: z.boolean(),
    quoteSent: z.boolean(),
    quoteAccepted: z.boolean(),
    quoteRejected: z.boolean(),
    quoteRevised: z.boolean(),
    paymentReceived: z.boolean(),
  }),
});

type NotificationPreferencesValues = z.infer<typeof notificationPreferencesSchema>;

const NOTIFICATION_TYPES = [
  { id: "quoteCreated", label: "Quote Created" },
  { id: "quoteSent", label: "Quote Sent" },
  { id: "quoteAccepted", label: "Quote Accepted" },
  { id: "quoteRejected", label: "Quote Rejected" },
  { id: "quoteRevised", label: "Quote Revised" },
  { id: "paymentReceived", label: "Payment Received" },
] as const;

export function NotificationPreferences() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: preferences, isLoading } = useQuery<NotificationPreferencesValues>({
    queryKey: ["/api/settings/notification-preferences"],
  });

  const form = useForm<NotificationPreferencesValues>({
    resolver: zodResolver(notificationPreferencesSchema),
    defaultValues: {
      emailNotifications: {
        quoteCreated: preferences?.emailNotifications.quoteCreated || false,
        quoteSent: preferences?.emailNotifications.quoteSent || false,
        quoteAccepted: preferences?.emailNotifications.quoteAccepted || false,
        quoteRejected: preferences?.emailNotifications.quoteRejected || false,
        quoteRevised: preferences?.emailNotifications.quoteRevised || false,
        paymentReceived: preferences?.emailNotifications.paymentReceived || false,
      },
      inAppNotifications: {
        quoteCreated: preferences?.inAppNotifications.quoteCreated || false,
        quoteSent: preferences?.inAppNotifications.quoteSent || false,
        quoteAccepted: preferences?.inAppNotifications.quoteAccepted || false,
        quoteRejected: preferences?.inAppNotifications.quoteRejected || false,
        quoteRevised: preferences?.inAppNotifications.quoteRevised || false,
        paymentReceived: preferences?.inAppNotifications.paymentReceived || false,
      },
    },
  });

  const updatePreferences = useMutation({
    mutationFn: async (data: NotificationPreferencesValues) => {
      const response = await fetch("/api/settings/notification-preferences", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update notification preferences");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/notification-preferences"] });
      toast({
        title: "Success",
        description: "Notification preferences updated successfully",
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

  const onSubmit = (data: NotificationPreferencesValues) => {
    updatePreferences.mutate(data);
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-6">
          <Card className="p-6">
            <h3 className="text-lg font-medium mb-4">Email Notifications</h3>
            <div className="space-y-4">
              {NOTIFICATION_TYPES.map((type) => (
                <FormField
                  key={`email-${type.id}`}
                  control={form.control}
                  name={`emailNotifications.${type.id}`}
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between space-y-0">
                      <FormLabel className="flex-1">{type.label}</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-medium mb-4">In-App Notifications</h3>
            <div className="space-y-4">
              {NOTIFICATION_TYPES.map((type) => (
                <FormField
                  key={`inapp-${type.id}`}
                  control={form.control}
                  name={`inAppNotifications.${type.id}`}
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between space-y-0">
                      <FormLabel className="flex-1">{type.label}</FormLabel>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              ))}
            </div>
          </Card>
        </div>

        <Button type="submit" disabled={updatePreferences.isPending}>
          Save Changes
        </Button>
      </form>
    </Form>
  );
}
