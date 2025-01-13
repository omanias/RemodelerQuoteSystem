import { useState, useEffect } from "react";
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
import { Plus, X, Loader2 } from "lucide-react";

const categoryFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
  subcategories: z.array(z.string()).default([]),
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
  const [formChanged, setFormChanged] = useState(false);
  const [subcategories, setSubcategories] = useState<string[]>(
    category?.subcategories || []
  );

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: category?.name || "",
      description: category?.description || "",
      subcategories: category?.subcategories || [],
    },
  });

  // Track form changes with proper TypeScript types
  useEffect(() => {
    const subscription = form.watch((_, { name, type }) => {
      if (type === 'change') {
        setFormChanged(true);
      }
    });
    return () => subscription.unsubscribe();
  }, [form.watch]);

  // Track subcategories changes
  useEffect(() => {
    const currentSubcategories = JSON.stringify(subcategories);
    const originalSubcategories = JSON.stringify(category?.subcategories || []);
    if (currentSubcategories !== originalSubcategories) {
      setFormChanged(true);
    }
  }, [subcategories, category?.subcategories]);

  const mutation = useMutation({
    mutationFn: async (data: CategoryFormData) => {
      const formattedData = {
        ...data,
        subcategories,
      };

      const response = await fetch(
        category ? `/api/categories/${category.id}` : "/api/categories",
        {
          method: category ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formattedData),
          credentials: "include",
        }
      );

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({
        title: `Category ${category ? "updated" : "created"} successfully`,
        description: `The category has been ${category ? "updated" : "created"} in the system.`,
      });
      setFormChanged(false);
      setIsLoading(false);
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setIsLoading(false);
    },
  });

  const onSubmit = async (data: CategoryFormData) => {
    setIsLoading(true);
    try {
      await mutation.mutateAsync(data);
    } catch {
      // Error is handled in mutation.onError
      setIsLoading(false);
    }
  };

  const addSubcategory = () => {
    setSubcategories([...subcategories, ""]);
  };

  const removeSubcategory = (index: number) => {
    setSubcategories(subcategories.filter((_, i) => i !== index));
  };

  const updateSubcategory = (index: number, value: string) => {
    const newSubcategories = [...subcategories];
    newSubcategories[index] = value;
    setSubcategories(newSubcategories);
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
            {subcategories.map((subcategory, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={subcategory}
                  onChange={(e) => updateSubcategory(index, e.target.value)}
                  placeholder="Enter subcategory"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeSubcategory(index)}
                  className="h-10 w-10"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

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

        <Button 
          type="submit" 
          disabled={isLoading || !formChanged}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {category ? "Updating..." : "Creating..."}
            </>
          ) : (
            category ? "Update Category" : "Create Category"
          )}
        </Button>
      </form>
    </Form>
  );
}