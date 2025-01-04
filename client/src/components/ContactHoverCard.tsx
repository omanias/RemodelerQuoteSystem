import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Phone, Mail, MapPin, CalendarClock, UserCircle } from "lucide-react";

interface ContactHoverPreviewProps {
  children: React.ReactNode;
  contact: {
    firstName: string;
    lastName: string;
    primaryEmail: string;
    primaryPhone: string;
    primaryAddress: string;
    leadStatus: string;
    assignedUser?: {
      name: string;
    };
    createdAt: string;
    profileImage?: string;
  };
}

export function ContactHoverCard({ children, contact }: ContactHoverPreviewProps) {
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        {children}
      </HoverCardTrigger>
      <HoverCardContent className="w-80">
        <div className="flex justify-between space-x-4">
          <Avatar className="h-12 w-12">
            <AvatarImage src={contact.profileImage} />
            <AvatarFallback>{contact.firstName[0]}{contact.lastName[0]}</AvatarFallback>
          </Avatar>
          <div className="space-y-1 flex-1">
            <h4 className="text-sm font-semibold">{contact.firstName} {contact.lastName}</h4>
            <div className="flex items-center text-sm text-muted-foreground gap-1">
              <UserCircle className="h-3 w-3" />
              <span>Assigned to: {contact.assignedUser?.name || 'Unassigned'}</span>
            </div>
            <div className="flex items-center text-sm text-muted-foreground gap-1">
              <CalendarClock className="h-3 w-3" />
              <span>Added {new Date(contact.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span>{contact.primaryEmail}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span>{contact.primaryPhone}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">{contact.primaryAddress}</span>
          </div>
        </div>
        <div className="mt-4">
          <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset">
            {contact.leadStatus}
          </span>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
