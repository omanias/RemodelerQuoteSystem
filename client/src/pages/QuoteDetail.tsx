import { useEffect, useState } from "react";
import { useLocation, useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { QuoteForm } from "@/components/QuoteForm";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { type Quote, type User, type Contact } from "@db/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function QuoteDetail() {
  const [, setLocation] = useLocation();
  const params = useParams();
  const searchParams = new URLSearchParams(window.location.search);
  const contactId = searchParams.get("contactId");
  const id = params.id;
  const [isEditing, setIsEditing] = useState(false);

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

  // If we have an ID, show the quote details view with edit option
  return (
    <div className="container mx-auto py-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Link href="/quotes">
            <Button variant="ghost" className="mr-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Quotes
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Quote {quote?.number}</h1>
            {quote?.status && (
              <Badge variant={quote.status === 'ACCEPTED' ? 'default' : 'secondary'}>
                {quote.status}
              </Badge>
            )}
          </div>
        </div>
        <Button 
          variant={isEditing ? "ghost" : "default"}
          onClick={() => setIsEditing(!isEditing)}
        >
          {isEditing ? "Cancel Edit" : "Edit Quote"}
        </Button>
      </div>

      {isEditing ? (
        <QuoteForm
          quote={quote}
          user={user}
          defaultContactId={contactId}
          contact={contact}
          onSuccess={() => {
            setIsEditing(false);
            setLocation(`/quotes/${id}`);
          }}
        />
      ) : (
        <div className="space-y-6">
          {quote && (
            <>
              <Card>
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-4">Client Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Name</p>
                      <p className="font-medium">{quote.clientName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium">{quote.clientEmail}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Phone</p>
                      <p className="font-medium">{quote.clientPhone || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Address</p>
                      <p className="font-medium">{quote.clientAddress || 'N/A'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-4">Quote Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total</p>
                      <p className="font-medium">${Number(quote.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Created</p>
                      <p className="font-medium">{new Date(quote.createdAt).toLocaleDateString()}</p>
                    </div>
                    {quote.downPaymentValue && (
                      <div>
                        <p className="text-sm text-muted-foreground">Down Payment</p>
                        <p className="font-medium">${Number(quote.downPaymentValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      </div>
                    )}
                    {quote.remainingBalance && (
                      <div>
                        <p className="text-sm text-muted-foreground">Remaining Balance</p>
                        <p className="font-medium">${Number(quote.remainingBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
}