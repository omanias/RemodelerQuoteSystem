import { useQuery } from "@tanstack/react-query";
import { DashboardMetrics } from "@/components/DashboardMetrics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QuoteStatus } from "@db/schema";
import { useAuth } from "@/hooks/useAuth";

interface Quote {
  id: number;
  number: string;
  clientName: string;
  total: number;
  status: QuoteStatus;
}

export function Dashboard() {
  const { user } = useAuth();
  const { data: quotes = [] } = useQuery<Quote[]>({
    queryKey: ["/api/quotes"],
  });

  const stats = {
    totalQuotes: quotes.length || 0,
    pendingQuotes: quotes.filter(q => q.status === QuoteStatus.DRAFT || q.status === QuoteStatus.SENT).length || 0,
    acceptedQuotes: quotes.filter(q => q.status === QuoteStatus.ACCEPTED).length || 0,
    totalValue: quotes.reduce((acc, q) => acc + Number(q.total), 0) || 0,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome back, {user?.name}</h1>
        <p className="text-muted-foreground">
          Here's an overview of your quotes and performance
        </p>
      </div>

      <DashboardMetrics stats={stats} />

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            {quotes?.slice(0, 5).map((quote) => (
              <div key={quote.id} className="flex items-center">
                <div className="ml-4 space-y-1">
                  <p className="text-sm font-medium leading-none">
                    Quote #{quote.number}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {quote.clientName} - ${quote.total}
                  </p>
                </div>
                <div className="ml-auto">
                  <Badge variant={getStatusVariant(quote.status)}>
                    {quote.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function getStatusVariant(status: string): "success" | "destructive" | "default" | "secondary" {
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