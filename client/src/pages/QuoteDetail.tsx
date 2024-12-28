import { useEffect } from "react";
import { useLocation, useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { QuoteForm } from "@/components/QuoteForm";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { type Quote, type User, type Contact } from "@db/schema";

export function QuoteDetail() {
  const [, setLocation] = useLocation();
  const params = useParams();
  const searchParams = new URLSearchParams(window.location.search);
  const contactId = searchParams.get("contactId");
  const id = params.id;

  const { data: quote, isLoading: isLoadingQuote, error: quoteError } = useQuery<Quote>({
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

  if (id && isLoadingQuote) {
    return <div>Loading quote...</div>;
  }

  if (quoteError) {
    console.error('Error loading quote:', quoteError);
    return <div>Error loading quote. Please try again.</div>;
  }

  return (
    <div className="container mx-auto py-6 max-w-5xl">
      <div className="flex items-center mb-6">
        <Link href="/quotes">
          <Button variant="ghost" className="mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Quotes
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">
          {id ? `Edit Quote ${quote?.number || ''}` : "New Quote"}
        </h1>
      </div>

      <QuoteForm
        quote={quote}
        user={user}
        defaultContactId={contactId}
        contact={contact}
        onSuccess={() => setLocation("/quotes")}
      />
    </div>
  );
}