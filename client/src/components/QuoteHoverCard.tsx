import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Card } from "@/components/ui/card";
import { CalendarClock, FileText, DollarSign, User, Tag, CheckCircle } from "lucide-react";

interface QuoteHoverPreviewProps {
  children: React.ReactNode;
  quote: {
    number: string;
    status: string;
    clientName: string;
    total: number;
    createdAt: string;
    user: {
      name: string;
    };
    category: {
      name: string;
    };
  };
}

export function QuoteHoverCard({ children, quote }: QuoteHoverPreviewProps) {
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        {children}
      </HoverCardTrigger>
      <HoverCardContent className="w-80">
        <div className="flex justify-between space-x-4">
          <div className="space-y-1">
            <h4 className="text-sm font-semibold">Quote {quote.number}</h4>
            <div className="flex items-center text-sm text-muted-foreground gap-1">
              <User className="h-3 w-3" />
              <span>Created by: {quote.user.name}</span>
            </div>
            <div className="flex items-center text-sm text-muted-foreground gap-1">
              <CalendarClock className="h-3 w-3" />
              <span>Created {new Date(quote.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span>Client: {quote.clientName}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Tag className="h-4 w-4 text-muted-foreground" />
            <span>Category: {quote.category.name}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span>Total: ${quote.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>
        <div className="mt-4">
          <span 
            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${
              quote.status === 'ACCEPTED' ? 'bg-green-50 text-green-700 ring-green-600/20' :
              quote.status === 'REJECTED' ? 'bg-red-50 text-red-700 ring-red-600/20' :
              'bg-gray-50 text-gray-700 ring-gray-600/20'
            }`}
          >
            {quote.status}
          </span>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
