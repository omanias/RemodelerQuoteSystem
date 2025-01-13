import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { SignatureCanvas } from "./SignatureCanvas";
import { toast } from "@/hooks/use-toast";
import type { Quote, QuoteStatus } from "@db/schema";

interface QuoteStatusActionsProps {
  quote: Quote;
}

export function QuoteStatusActions({ quote }: QuoteStatusActionsProps) {
  const [showSignature, setShowSignature] = useState(false);
  const queryClient = useQueryClient();

  const updateQuoteStatus = useMutation({
    mutationFn: async ({ status, signature }: { status: keyof typeof QuoteStatus, signature?: { data: string; timestamp: string; metadata: any } }) => {
      const response = await fetch(`/api/quotes/${quote.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status,
          signature,
        }),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: [`/api/quotes/${quote.id}`] });
      toast({
        title: "Success",
        description: "Quote status updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleStatusChange = async (status: keyof typeof QuoteStatus) => {
    if (status === "ACCEPTED") {
      setShowSignature(true);
    } else {
      updateQuoteStatus.mutate({ status });
    }
  };

  const handleSignatureSave = (signature: { data: string; timestamp: string; metadata: any }) => {
    updateQuoteStatus.mutate({
      status: "ACCEPTED",
      signature,
    });
  };

  return (
    <>
      <div className="flex gap-2">
        {quote.status === "DRAFT" && (
          <Button onClick={() => handleStatusChange("SENT")}>Send Quote</Button>
        )}
        {quote.status === "SENT" && (
          <>
            <Button onClick={() => handleStatusChange("ACCEPTED")} variant="default" className="bg-green-600 hover:bg-green-700">
              Accept
            </Button>
            <Button onClick={() => handleStatusChange("REJECTED")} variant="destructive">
              Reject
            </Button>
          </>
        )}
        {quote.status === "REJECTED" && (
          <Button onClick={() => handleStatusChange("REVISED")}>Revise Quote</Button>
        )}
      </div>

      <SignatureCanvas
        isOpen={showSignature}
        onClose={() => setShowSignature(false)}
        onSave={handleSignatureSave}
        title="Sign Quote"
        description="Please sign below to accept this quote"
      />
    </>
  );
}