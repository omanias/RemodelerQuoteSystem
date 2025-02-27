import { useState, useEffect } from "react";
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
import { Plus, X, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";

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
    variations?: Array<{
      name: string;
      price: string | number;
    }>;
  };
  onSuccess?: () => void;
}

export function ProductForm({ product, onSuccess }: ProductFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formChanged, setFormChanged] = useState(false);
  const [variations, setVariations] = useState<VariationData[]>(
    product?.variations?.map(v => ({
      name: v.name,
      price: typeof v.price === 'number' ? v.price.toString() : v.price
    })) || []
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
      variations: variations,
    },
  });

  // Track form changes
  useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
      if (type === 'change') {
        setFormChanged(true);
      }
    });
    return () => subscription.unsubscribe();
  }, [form.watch]);

  // Track variations changes
  useEffect(() => {
    if (JSON.stringify(variations) !== JSON.stringify(product?.variations || [])) {
      setFormChanged(true);
    }
  }, [variations, product?.variations]);

  const mutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      const formattedData = {
        ...data,
        categoryId: parseInt(data.categoryId),
        basePrice: parseFloat(data.basePrice),
        cost: parseFloat(data.cost),
        variations: variations.map(v => ({
          name: v.name,
          price: parseFloat(v.price)
        })),
      };

      const url = product ? `/api/products/${product.id}` : "/api/products";
      const method = product ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formattedData),
        credentials: "include",
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message;
        } catch {
          errorMessage = errorText;
        }
        throw new Error(errorMessage || `Failed to ${product ? 'update' : 'create'} product`);
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: `Product ${product ? "updated" : "created"} successfully`,
        description: `The product has been ${product ? "updated" : "created"} successfully.`,
      });
      setIsSubmitting(false);
      setFormChanged(false);
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
      setIsSubmitting(false);
    },
  });

  const onSubmit = async (data: ProductFormData) => {
    try {
      setIsSubmitting(true);
      await mutation.mutateAsync({
        ...data,
        variations: variations,
      });
    } catch (error) {
      setIsSubmitting(false);
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 w-full max-w-2xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="col-span-1 md:col-span-2">
                <FormLabel>Product Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter product name" {...field} className="w-full" />
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
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a category" />
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

          <FormField
            control={form.control}
            name="unit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unit</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
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
                    className="w-full"
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
                    className="w-full"
                  />
                </FormControl>
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
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <Label>Variations</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addVariation}
              className="whitespace-nowrap"
            >
              <Plus className="h-4 w-4 mr-2" /> Add Variation
            </Button>
          </div>

          <div className="space-y-2">
            {variations.map((variation, index) => (
              <div
                key={index}
                className="grid grid-cols-1 md:grid-cols-2 gap-2 items-end border rounded-md p-3"
              >
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={variation.name}
                    onChange={(e) =>
                      updateVariation(index, "name", e.target.value)
                    }
                    placeholder="Variation name"
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Price</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      value={variation.price}
                      onChange={(e) =>
                        updateVariation(index, "price", e.target.value)
                      }
                      placeholder="Variation price"
                      className="w-full"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeVariation(index)}
                      className="shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Button 
          type="submit" 
          disabled={isSubmitting || !formChanged}
          className="w-full"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {product ? "Updating..." : "Creating..."}
            </>
          ) : (
            product ? "Update Product" : "Create Product"
          )}
        </Button>
      </form>
    </Form>
  );
}