import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const variationSchema = z.object({
  name: z.string().min(1, "Name is required"),
  price: z.string().min(1, "Price is required"),
});

const productFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  categoryId: z.string().min(1, "Category is required"),
  basePrice: z.string().min(1, "Base price is required"),
  cost: z.string().min(1, "Cost is required"),
  unit: z.enum(["Square Foot", "Linear Foot", "Unit", "Hours", "Days", "Piece"]),
  isActive: z.boolean(),
  variations: z.array(variationSchema).optional(),
});

type ProductFormData = z.infer<typeof productFormSchema>;
type VariationData = z.infer<typeof variationSchema>;

interface Category {
  id: number;
  name: string;
  description?: string;
}

interface ProductFormProps {
  product?: {
    id: number;
    name: string;
    categoryId: number;
    basePrice: number;
    cost: number;
    unit: string;
    isActive: boolean;
    variations?: VariationData[];
  };
  onSuccess?: () => void;
}

export function ProductForm({ product, onSuccess }: ProductFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [variations, setVariations] = useState<VariationData[]>(
    product?.variations || []
  );
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: product?.name || "",
      categoryId: product?.categoryId?.toString() || "",
      basePrice: product?.basePrice?.toString() || "",
      cost: product?.cost?.toString() || "",
      unit: (product?.unit as ProductFormData["unit"]) || "Square Foot",
      isActive: product?.isActive ?? true,
      variations: product?.variations || [],
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      try {
        const response = await fetch(
          product ? `/api/products/${product.id}` : "/api/products",
          {
            method: product ? "PUT" : "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              ...data,
              categoryId: parseInt(data.categoryId),
              basePrice: parseFloat(data.basePrice),
              cost: parseFloat(data.cost),
              variations: variations.map(v => ({
                ...v,
                price: parseFloat(v.price)
              })),
            }),
            credentials: "include",
          }
        );

        if (!response.ok) {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errorData = await response.json();
            throw new Error(errorData.message || "Failed to save product");
          } else {
            const errorText = await response.text();
            throw new Error("Server error: Please try again later");
          }
        }

        return response.json();
      } catch (error: any) {
        if (error instanceof Error) {
          throw error;
        }
        throw new Error("An unexpected error occurred");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: `Product ${product ? "updated" : "created"} successfully`,
        description: `The product has been ${
          product ? "updated" : "created"
        } in the system.`,
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

  const onSubmit = async (data: ProductFormData) => {
    setIsLoading(true);
    try {
      await mutation.mutateAsync(data);
    } finally {
      setIsLoading(false);
    }
  };

  const addVariation = () => {
    setVariations([...variations, { name: "", price: "" }]);
  };

  const removeVariation = (index: number) => {
    setVariations(variations.filter((_, i) => i !== index));
  };

  const updateVariation = (index: number, field: keyof VariationData, value: string) => {
    const newVariations = [...variations];
    newVariations[index] = { ...newVariations[index], [field]: value };
    setVariations(newVariations);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Product Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter product name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="categoryId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category">
                      {categories.find((c) => c.id.toString() === field.value)
                        ?.name || "Select a category"}
                    </SelectValue>
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem
                      key={category.id}
                      value={category.id.toString()}
                    >
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="basePrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Base Price</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Enter base price"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="cost"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cost (Internal)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Enter cost"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="unit"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Unit</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a unit" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Square Foot">Square Foot</SelectItem>
                  <SelectItem value="Linear Foot">Linear Foot</SelectItem>
                  <SelectItem value="Unit">Unit</SelectItem>
                  <SelectItem value="Hours">Hours</SelectItem>
                  <SelectItem value="Days">Days</SelectItem>
                  <SelectItem value="Piece">Piece</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <FormLabel>Active</FormLabel>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <Label>Variations</Label>
            <Button type="button" variant="outline" size="sm" onClick={addVariation}>
              <Plus className="h-4 w-4 mr-2" /> Add Variation
            </Button>
          </div>

          <div className="space-y-2">
            {variations.map((variation, index) => (
              <div
                key={index}
                className="flex items-end gap-2 border rounded-md p-2"
              >
                <div className="flex-1">
                  <Label>Name</Label>
                  <Input
                    value={variation.name}
                    onChange={(e) =>
                      updateVariation(index, "name", e.target.value)
                    }
                    placeholder="Variation name"
                  />
                </div>
                <div className="flex-1">
                  <Label>Price</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={variation.price}
                    onChange={(e) =>
                      updateVariation(index, "price", e.target.value)
                    }
                    placeholder="Variation price"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mb-[2px]"
                  onClick={() => removeVariation(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : product ? "Update Product" : "Create Product"}
        </Button>
      </form>
    </Form>
  );
}