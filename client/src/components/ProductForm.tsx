import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

interface ProductFormProps {
  onSuccess?: () => void;
}

export function ProductForm({ onSuccess }: ProductFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const form = useForm({
    defaultValues: {
      name: "",
      category: "",
      basePrice: "",
      unit: "",
      isActive: true,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data) => {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Success",
        description: "Product created successfully",
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
          <label>Product Name</label>
          <Input {...form.register("name")} />
        </div>

        <div className="space-y-2">
          <label>Category</label>
          <Input {...form.register("category")} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label>Base Price</label>
            <Input {...form.register("basePrice")} type="number" step="0.01" />
          </div>
          <div className="space-y-2">
            <label>Unit</label>
            <Input {...form.register("unit")} />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            checked={form.watch("isActive")}
            onCheckedChange={(checked) => form.setValue("isActive", checked)}
          />
          <label>Active</label>
        </div>

        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Creating..." : "Create Product"}
        </Button>
      </form>
    </Form>
  );
}
