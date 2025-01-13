import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { QuoteForm } from "@/components/QuoteForm";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { type Quote, type User, type Contact } from "@db/schema";
import { Skeleton } from "@/components/ui/skeleton";

export function QuoteDetail() {
  const { id } = useParams();
  const searchParams = new URLSearchParams(window.location.search);
  const contactId = searchParams.get("contactId");

  const { data: quote, isLoading: isLoadingQuote } = useQuery<Quote>({
    queryKey: [`/api/quotes/${id}`],
    enabled: !!id,
  });

  const { data: contact, isLoading: isLoadingContact } = useQuery<Contact>({
    queryKey: [`/api/contacts/${contactId}`],
    enabled: !!contactId,
  });

  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  // Show loading state
  if (id && (isLoadingQuote || isLoadingContact)) {
    return (
      <div className="container mx-auto py-6 max-w-5xl space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" disabled>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-[400px] w-full" />
        </div>
      </div>
    );
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

  return (
    <div className="container mx-auto py-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Link href={contactId ? `/contacts/${contactId}` : "/quotes"}>
            <Button variant="ghost" className="mr-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {contactId ? "Back to Contact" : "Back to Quotes"}
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">
            {quote?.number ? `Quote #${quote.number}` : 'Loading...'}
          </h1>
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