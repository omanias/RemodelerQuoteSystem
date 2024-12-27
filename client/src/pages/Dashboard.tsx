import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { DashboardMetrics } from "@/components/DashboardMetrics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QuoteStatus } from "@db/schema";
import { useAuth } from "@/hooks/useAuth";
import { startOfMonth, subMonths, format, parseISO } from "date-fns";

interface Quote {
  id: number;
  number: string;
  clientName: string;
  total: number;
  status: QuoteStatus;
  createdAt: string;
}

export function Dashboard() {
  const { user } = useAuth();
  const { data: quotes = [] } = useQuery<Quote[]>({
    queryKey: ["/api/quotes"],
  });

  // Calculate all metrics
  const totalQuotes = quotes.length;
  const pendingQuotes = quotes.filter(q => q.status === QuoteStatus.DRAFT || q.status === QuoteStatus.SENT).length;
  const acceptedQuotes = quotes.filter(q => q.status === QuoteStatus.ACCEPTED).length;
  const rejectedQuotes = quotes.filter(q => q.status === QuoteStatus.REJECTED).length;
  const totalValue = quotes.reduce((acc, q) => acc + Number(q.total), 0);
  const averageValue = totalValue / (totalQuotes || 1);
  const conversionRate = acceptedQuotes / (totalQuotes || 1);

  // Calculate status distribution with values
  const statusDistribution = Object.values(QuoteStatus).map(status => ({
    status,
    count: quotes.filter(q => q.status === status).length,
    value: quotes
      .filter(q => q.status === status)
      .reduce((acc, q) => acc + Number(q.total), 0)
  }));

  // Calculate timeline data for the last 6 months
  const now = new Date();
  const timelineData = Array.from({ length: 6 }, (_, i) => {
    const monthStart = startOfMonth(subMonths(now, i));
    const monthQuotes = quotes.filter(q => {
      const quoteDate = parseISO(q.createdAt);
      return quoteDate >= monthStart && quoteDate < startOfMonth(subMonths(now, i - 1));
    });

    return {
      date: format(monthStart, 'yyyy-MM-dd'),
      count: monthQuotes.length,
      value: monthQuotes.reduce((acc, q) => acc + Number(q.total), 0)
    };
  }).reverse();

  const stats = {
    totalQuotes,
    pendingQuotes,
    acceptedQuotes,
    rejectedQuotes,
    totalValue,
    averageValue,
    conversionRate,
    timelineData,
    statusDistribution
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
                  <Link href="/quotes" className="text-sm font-medium leading-none hover:underline">
                    Quote #{quote.number}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {quote.clientName} - ${Number(quote.total).toLocaleString()}
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

function getStatusVariant(status: QuoteStatus): "success" | "destructive" | "default" | "secondary" {
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