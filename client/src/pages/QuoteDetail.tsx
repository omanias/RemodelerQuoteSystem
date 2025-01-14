import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { QuoteForm } from "@/components/QuoteForm";
import { QuoteStatus } from "@/components/QuoteForm";

interface Quote {
  id: number;
  number: string;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  clientAddress: string | null;
  status: QuoteStatus;
  total: number;
  subtotal: number;
  downPaymentValue: number | null;
  remainingBalance: number | null;
  createdAt: string;
  contactId: number | null;
  categoryId: number;
  templateId: number;
  content: {
    products: Array<{
      id: number;
      name: string;
      unit: string;
      basePrice: number;
      price: number;
      quantity: number;
      variation?: string;
      variations?: Array<{
        name: string;
        price: number;
      }>;
    }>;
    calculations?: {
      tax: number;
      total: number;
      discount: number;
      subtotal: number;
      downPayment: number;
      remainingBalance: number;
    };
  };
  paymentMethod: string | null;
  discountType: "PERCENTAGE" | "FIXED" | null;
  discountValue: number | null;
  discountCode: string | null;
  downPaymentType: "PERCENTAGE" | "FIXED" | null;
  taxRate: number | null;
  notes: string | null;
}

export function QuoteDetail() {
  const params = useParams();
  const searchParams = new URLSearchParams(window.location.search);
  const contactId = searchParams.get("contactId");
  const id = params.id;

  const { data: quote, isLoading: isLoadingQuote } = useQuery<Quote>({
    queryKey: [`/api/quotes/${id}`],
    enabled: !!id,
  });

  const { data: contact } = useQuery<{
    id: number;
    firstName: string;
    lastName: string;
    primaryEmail: string;
    primaryPhone: string;
    primaryAddress: string;
  }>({
    queryKey: [`/api/contacts/${contactId}`],
    enabled: !!contactId,
  });

  const { data: user } = useQuery<{
    id: number;
    name: string;
    email: string;
    role: string;
  }>({
    queryKey: ["/api/auth/user"],
  });

  if (id && (isLoadingQuote || !quote)) {
    return <div className="container mx-auto py-6">Loading quote...</div>;
  }

  // If no ID is provided, show the quote creation form
  if (!id) {
    return (
      <div className="container mx-auto py-6 max-w-5xl">
        <div className="flex items-center mb-6">
          <Link href="/quotes">
            <Button variant="ghost" className="mr-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Quotes
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">New Quote</h1>
        </div>

        <QuoteForm
          user={user}
          defaultContactId={contactId}
          contact={contact}
          onSuccess={() => window.location.href = "/quotes"}
        />
      </div>
    );
  }

  // If we have an ID, directly show the quote form in edit mode
  return (
    <div className="container mx-auto py-6 max-w-5xl">
      <div className="flex items-center mb-6">
        <Link href={contactId ? `/contacts/${contactId}` : "/quotes"}>
          <Button variant="ghost" className="mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {contactId ? "Back to Contact" : "Back to Quotes"}
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Edit Quote {quote?.number}</h1>
        </div>
      </div>

      <QuoteForm
        quote={quote}
        user={user}
        defaultContactId={contactId}
        contact={contact}
        onSuccess={() => window.location.href = "/quotes"}
      />
    </div>
  );
}