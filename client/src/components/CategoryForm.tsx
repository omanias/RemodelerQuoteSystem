import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, X } from "lucide-react";

const categoryFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
  subcategories: z.array(z.string()).min(1, "At least one subcategory is required"),
});

type CategoryFormData = z.infer<typeof categoryFormSchema>;

interface CategoryFormProps {
  category?: {
    id: number;
    name: string;
    description?: string;
    subcategories?: string[];
  };
  onSuccess?: () => void;
}

export function CategoryForm({ category, onSuccess }: CategoryFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: category?.name || "",
      description: category?.description || "",
      subcategories: category?.subcategories || [""],
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: CategoryFormData) => {
      try {
        const response = await fetch(
          category ? `/api/categories/${category.id}` : "/api/categories",
          {
            method: category ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
            credentials: "include",
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          try {
            const errorJson = JSON.parse(errorText);
            throw new Error(errorJson.message || "Failed to save category");
          } catch {
            throw new Error(errorText || "Failed to save category");
          }
        }

        return response.json();
      } catch (error: any) {
        throw new Error(error.message || "An unexpected error occurred");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({
        title: `Category ${category ? "updated" : "created"} successfully`,
        description: `The category has been ${category ? "updated" : "created"} in the system.`,
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

  const onSubmit = async (data: CategoryFormData) => {
    setIsLoading(true);
    try {
      await mutation.mutateAsync(data);
    } finally {
      setIsLoading(false);
    }
  };

  const addSubcategory = () => {
    const currentSubcategories = form.getValues("subcategories") || [];
    form.setValue("subcategories", [...currentSubcategories, ""], { 
      shouldValidate: true,
      shouldDirty: true 
    });
  };

  const removeSubcategory = (index: number) => {
    const currentSubcategories = form.getValues("subcategories") || [];
    if (currentSubcategories.length > 1) {
      form.setValue(
        "subcategories",
        currentSubcategories.filter((_, i) => i !== index),
        { shouldValidate: true, shouldDirty: true }
      );
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter category name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Enter category description (optional)"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <FormLabel>Subcategories</FormLabel>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addSubcategory}
              className="h-8"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Subcategory
            </Button>
          </div>
          <div className="space-y-2">
            {form.watch("subcategories")?.map((_, index) => (
              <FormField
                key={index}
                control={form.control}
                name={`subcategories.${index}`}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Enter subcategory"
                          {...field}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeSubcategory(index)}
                          className="h-10 w-10"
                          disabled={form.watch("subcategories")?.length <= 1}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
          </div>
        </div>

        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? "Saving..." : category ? "Update Category" : "Create Category"}
        </Button>
      </form>
    </Form>
  );
}