import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { QuoteForm } from "@/components/QuoteForm";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { QuoteStatus } from "@db/schema";
import { Plus, MoreVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function Quotes() {
  const [open, setOpen] = useState(false);
  const [editQuote, setEditQuote] = useState<any>(null);
  const [deleteQuote, setDeleteQuote] = useState<any>(null);
  const { toast } = useToast();

  const { data: quotes = [], refetch } = useQuery({
    queryKey: ["/api/quotes"],
  });

  const { data: user } = useQuery({
    queryKey: ["/api/auth/user"],
  });

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/quotes/${deleteQuote.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      toast({
        title: "Quote deleted",
        description: "The quote has been deleted successfully.",
      });

      refetch();
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quotes</h1>
          <p className="text-muted-foreground">
            Create and manage quotes for your clients
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> New Quote
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Create New Quote</DialogTitle>
            </DialogHeader>
            <QuoteForm onSuccess={() => setOpen(false)} user={user} />
          </DialogContent>
        </Dialog>
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
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotes?.map((quote: any) => (
              <TableRow key={quote.id}>
                <TableCell>{quote.number}</TableCell>
                <TableCell>{quote.clientName}</TableCell>
                <TableCell>
                  <Badge variant={getStatusVariant(quote.status)}>
                    {quote.status}
                  </Badge>
                </TableCell>
                <TableCell>${quote.total}</TableCell>
                <TableCell>${quote.downPaymentValue || 0}</TableCell>
                <TableCell>${quote.remainingBalance || 0}</TableCell>
                <TableCell>
                  {new Date(quote.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <Dialog>
                        <DialogTrigger asChild>
                          <DropdownMenuItem
                            onSelect={(e) => {
                              e.preventDefault();
                              setEditQuote(quote);
                            }}
                          >
                            Edit
                          </DropdownMenuItem>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl">
                          <DialogHeader>
                            <DialogTitle>Edit Quote</DialogTitle>
                          </DialogHeader>
                          <QuoteForm
                            quote={editQuote}
                            onSuccess={() => setEditQuote(null)}
                            user={user}
                          />
                        </DialogContent>
                      </Dialog>
                      <DropdownMenuItem
                        className="text-destructive"
                        onSelect={() => setDeleteQuote(quote)}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
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

function getStatusVariant(status: string) {
  switch (status) {
    case QuoteStatus.ACCEPTED:
      return "success";
    case QuoteStatus.REJECTED:
      return "destructive";
    case QuoteStatus.SENT:
      return "default";
    default:
      return "secondary";
  }
}