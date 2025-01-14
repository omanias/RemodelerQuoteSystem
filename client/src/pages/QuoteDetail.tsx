import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { MultiStepQuoteBuilder } from "@/components/MultiStepQuoteBuilder";
import { Quote } from "@/types/quote";

interface Contact {
  id: number;
  firstName: string;
  lastName: string;
  primaryEmail: string;
  primaryPhone: string;
  primaryAddress: string;
}

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
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

  const { data: contact } = useQuery<Contact>({
    queryKey: [`/api/contacts/${contactId}`],
    enabled: !!contactId,
  });

  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  if (id && isLoadingQuote) {
    return <div>Loading quote...</div>;
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

        <MultiStepQuoteBuilder
          onSuccess={() => window.location.href = "/quotes"}
          defaultValues={
            contact
              ? {
                  contactInfo: {
                    contactId: contact.id.toString(),
                    clientName: `${contact.firstName} ${contact.lastName}`,
                    clientEmail: contact.primaryEmail,
                    clientPhone: contact.primaryPhone,
                    clientAddress: contact.primaryAddress,
                  },
                }
              : undefined
          }
        />
      </div>
    );
  }

  // If we have an ID, show the quote in edit mode
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

      <MultiStepQuoteBuilder
        onSuccess={() => window.location.href = "/quotes"}
        defaultValues={quote ? {
          contactInfo: {
            clientName: quote.clientName,
            clientEmail: quote.clientEmail || null,
            clientPhone: quote.clientPhone || null,
            clientAddress: quote.clientAddress || null,
          },
          categoryAndTemplate: {
            categoryId: quote.categoryId,
            templateId: quote.templateId,
          },
          products: quote.content.products,
          calculations: {
            subtotal: Number(quote.subtotal),
            total: Number(quote.total),
            discountType: quote.discountType as any,
            discountValue: quote.discountValue ? Number(quote.discountValue) : null,
            downPaymentType: quote.downPaymentType as any,
            downPaymentValue: quote.downPaymentValue ? Number(quote.downPaymentValue) : null,
            taxRate: quote.taxRate ? Number(quote.taxRate) : null,
          },
        } : undefined}
      />
    </div>
  );
}