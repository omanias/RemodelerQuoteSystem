import { z } from "zod";

export enum QuoteStatus {
  DRAFT = "DRAFT",
  SENT = "SENT",
  ACCEPTED = "ACCEPTED",
  REJECTED = "REJECTED",
  REVISED = "REVISED"
}

export enum PaymentMethod {
  CASH = "CASH",
  CREDIT_CARD = "CREDIT_CARD",
  BANK_TRANSFER = "BANK_TRANSFER",
  PAYMENT_PLAN = "PAYMENT_PLAN"
}

export interface Product {
  id: number;
  name: string;
  unit: string;
  basePrice: number;
  variations?: Array<{
    name: string;
    price: number;
  }>;
}

export interface SelectedProduct {
  productId: number;
  quantity: number;
  variation?: string;
  unitPrice: number;
  basePrice: number;
}

export interface Quote {
  id: number;
  number: string;
  clientName: string;
  status: keyof typeof QuoteStatus;
  total: number;
  downPaymentValue: number | null;
  remainingBalance: number | null;
  createdAt: string;
  content: {
    products: Array<SelectedProduct>;
    calculations?: {
      tax: number;
      total: number;
      discount: number;
      subtotal: number;
      downPayment: number;
      remainingBalance: number;
    };
  };
  templateId: number;
  categoryId: number;
  contactId: number | null;
  clientEmail: string;
  clientPhone: string;
  clientAddress: string;
  notes: string;
  paymentMethod: keyof typeof PaymentMethod | null;
  discountType: "PERCENTAGE" | "FIXED" | null;
  discountValue: number | null;
  discountCode: string;
  downPaymentType: "PERCENTAGE" | "FIXED" | null;
  taxRate: number | null;
  subtotal: number;
  userId: number;
  companyId: number;
  updatedAt: string;
}

export const quoteFormSchema = z.object({
  contactId: z.string().optional(),
  templateId: z.string().optional(),
  categoryId: z.string().optional(),
  clientName: z.string().min(1, "Client name is required"),
  clientEmail: z.string().email("Invalid email address").optional().default(""),
  clientPhone: z.string().optional().default(""),
  clientAddress: z.string().optional().default(""),
  status: z.enum(Object.keys(QuoteStatus) as [string, ...string[]]),
  content: z.object({
    products: z.array(z.object({
      productId: z.number(),
      quantity: z.number(),
      variation: z.string().optional(),
      unitPrice: z.number()
    }))
  }),
  subtotal: z.number().min(0),
  total: z.number().min(0),
  notes: z.string().default(""),
  paymentMethod: z.enum(Object.keys(PaymentMethod) as [string, ...string[]]).optional(),
  discountType: z.enum(["PERCENTAGE", "FIXED"]).optional(),
  discountValue: z.number().min(0).optional(),
  discountCode: z.string().default(""),
  downPaymentType: z.enum(["PERCENTAGE", "FIXED"]).optional(),
  downPaymentValue: z.number().min(0).optional(),
  taxRate: z.number().min(0).optional(),
  remainingBalance: z.number().min(0).optional()
});

export type QuoteFormValues = z.infer<typeof quoteFormSchema>;