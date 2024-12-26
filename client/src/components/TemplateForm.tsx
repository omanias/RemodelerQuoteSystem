import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

interface TemplateFormProps {
  onSuccess?: () => void;
}

export function TemplateForm({ onSuccess }: TemplateFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const form = useForm({
    defaultValues: {
      name: "",
      category: "",
      content: "",
      isDefault: false,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data) => {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          content: JSON.parse(data.content),
        }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({
        title: "Success",
        description: "Template created successfully",
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

  const onSubmit = (data: any) => {
    mutation.mutate(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <label>Template Name</label>
          <Input {...form.register("name")} />
        </div>

        <div className="space-y-2">
          <label>Category</label>
          <Input {...form.register("category")} />
        </div>

        <div className="space-y-2">
          <label>Content (JSON)</label>
          <Textarea {...form.register("content")} rows={10} />
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            checked={form.watch("isDefault")}
            onCheckedChange={(checked) => form.setValue("isDefault", checked)}
          />
          <label>Set as Default Template</label>
        </div>

        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Creating..." : "Create Template"}
        </Button>
      </form>
    </Form>
  );
}
