import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation as useLocationWouter } from "wouter";
import { QuoteForm } from "./QuoteForm";
import { QuoteStatus, PaymentMethod } from "@db/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, MoreVertical, FileText, Download, ArrowLeft, FileEdit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Quote {
  id: number;
  number: string;
  clientName: string;
  status: keyof typeof QuoteStatus;
  total: string | number;
  downPaymentValue: string | number | null;
  remainingBalance: string | number | null;
  createdAt: string;
  content: {
    products: Array<{
      productId: number;
      quantity: number;
      variation?: string;
      unitPrice: number;
    }>;
  };
  templateId: number;
  categoryId: number;
  contactId: number | null;
  clientEmail: string | null;
  clientPhone: string | null;
  clientAddress: string | null;
  notes: string | null;
  paymentMethod: keyof typeof PaymentMethod | null;
  discountType: "PERCENTAGE" | "FIXED" | null;
  discountValue: number | null;
  discountCode: string | null;
  downPaymentType: "PERCENTAGE" | "FIXED" | null;
  taxRate: number | null;
  subtotal: number;
  userId: number;
  companyId: number;
  updatedAt: string;
}

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
  email: string;
  name: string;
  role: string;
}

// Helper function to safely format monetary values
function formatMoney(value: string | number | null): string {
  if (value === null) return '-';
  const numericValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numericValue)) return '-';
  return numericValue.toLocaleString('en-US', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function Quotes() {
  const [location, setLocation] = useLocationWouter();
  const [deleteQuote, setDeleteQuote] = useState<Quote | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Extract quoteId from URL if present for editing
  const urlParams = new URLSearchParams(location.split('?')[1] || "");
  const contactId = urlParams.get('contactId');
  const quoteId = location.match(/\/quotes\/(\d+)/)?.[1];

  const { data: quotes = [] } = useQuery<Quote[]>({
    queryKey: ["/api/quotes"],
  });

  const { data: quote } = useQuery<Quote>({
    queryKey: [`/api/quotes/${quoteId}`],
    enabled: !!quoteId,
  });

  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  const { data: contact } = useQuery<Contact>({
    queryKey: [`/api/contacts/${contactId}`],
    enabled: !!contactId
  });

  const handleDelete = async () => {
    if (!deleteQuote) return;

    try {
      const response = await fetch(`/api/quotes/${deleteQuote.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });

      toast({
        title: "Quote deleted",
        description: "The quote has been deleted successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleteQuote(null);
    }
  };

  const handleExportPDF = async (quote: Quote) => {
    try {
      const response = await fetch(`/api/quotes/${quote.id}/export/pdf`);

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quote-${quote.number}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success",
        description: "Quote exported to PDF successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleExportCSV = async () => {
    try {
      const response = await fetch('/api/quotes/export/csv');

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'quotes.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success",
        description: "Quotes exported to CSV successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // If we're editing a quote or creating a new one
  if (quoteId || location === '/quotes/new' || location.startsWith('/quotes/new?')) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation('/quotes')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {quoteId ? 'Edit Quote' : 'New Quote'}
            </h1>
            {contact && (
              <p className="text-muted-foreground">
                {quoteId ? 'Editing' : 'Creating'} quote for {contact.firstName} {contact.lastName}
              </p>
            )}
          </div>
        </div>
        <QuoteForm
          quote={quote}
          onSuccess={() => setLocation('/quotes')}
          user={user}
          defaultContactId={contactId}
          contact={contact}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quotes</h1>
          <p className="text-muted-foreground">
            Create and manage quotes for your clients
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="mr-2 h-4 w-4" />
            Export All (CSV)
          </Button>

          <Button variant="outline" onClick={() => setLocation('/templates')}>
            <FileEdit className="mr-2 h-4 w-4" />
            Templates
          </Button>

          <Button onClick={() => setLocation('/quotes/new')}>
            <Plus className="mr-2 h-4 w-4" /> New Quote
          </Button>
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quote #</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Down Payment</TableHead>
              <TableHead>Remaining</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotes.map((quote) => (
              <TableRow key={quote.id}>
                <TableCell>{quote.number}</TableCell>
                <TableCell>{quote.clientName}</TableCell>
                <TableCell>
                  <Badge variant={getStatusVariant(quote.status)}>
                    {quote.status}
                  </Badge>
                </TableCell>
                <TableCell>${formatMoney(quote.total)}</TableCell>
                <TableCell>${formatMoney(quote.downPaymentValue)}</TableCell>
                <TableCell>${formatMoney(quote.remainingBalance)}</TableCell>
                <TableCell>
                  {new Date(quote.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleExportPDF(quote)}
                      title="Export as PDF"
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => setLocation(`/quotes/${quote.id}`)}
                          className="cursor-pointer"
                        >
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive cursor-pointer"
                          onClick={() => setDeleteQuote(quote)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={!!deleteQuote}
        onOpenChange={(open) => !open && setDeleteQuote(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete Quote #{deleteQuote?.number} and remove it from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function getStatusVariant(status: string): "default" | "destructive" | "secondary" | "outline" {
  switch (status) {
    case "ACCEPTED":
      return "default";
    case "REJECTED":
      return "destructive";
    case "SENT":
      return "outline";
    default:
      return "secondary";
  }
}