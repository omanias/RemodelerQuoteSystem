import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Link, useLocation } from "wouter";
import { Plus, Search } from "lucide-react";
import { LeadStatus } from "@db/schema";
import { ContactHoverCard } from "@/components/ContactHoverCard";

export function Contacts() {
  const [searchQuery, setSearchQuery] = useState("");
  const [location, navigate] = useLocation();

  const { data: contacts = [] } = useQuery({
    queryKey: ["/api/contacts"],
  });

  // Filter contacts based on search query
  const filteredContacts = contacts.filter((contact: any) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      contact.firstName?.toLowerCase().includes(searchLower) ||
      contact.lastName?.toLowerCase().includes(searchLower) ||
      contact.primaryEmail?.toLowerCase().includes(searchLower) ||
      contact.primaryPhone?.toLowerCase().includes(searchLower)
    );
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case LeadStatus.NEW:
        return "bg-blue-100 text-blue-800";
      case LeadStatus.CONTACTED:
        return "bg-yellow-100 text-yellow-800";
      case LeadStatus.QUOTE_SENT:
        return "bg-purple-100 text-purple-800";
      case LeadStatus.PROJECT_STARTED:
        return "bg-green-100 text-green-800";
      case LeadStatus.COMPLETED:
        return "bg-gray-100 text-gray-800";
      case LeadStatus.LOST:
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contacts</h1>
          <p className="text-muted-foreground">
            Manage your contacts and leads
          </p>
        </div>

        <Link href="/contacts/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" /> New Contact
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Filters</CardTitle>
          <CardDescription>Filter contacts by common criteria</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
                prefix={<Search className="mr-2 h-4 w-4 text-muted-foreground" />}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Property</TableHead>
              <TableHead>Lead Source</TableHead>
              <TableHead>Timeline</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredContacts.map((contact: any) => (
              <TableRow 
                key={contact.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => navigate(`/contacts/${contact.id}`)}
              >
                <TableCell>
                  <ContactHoverCard
                    contact={{
                      firstName: contact.firstName,
                      lastName: contact.lastName,
                      primaryEmail: contact.primaryEmail,
                      primaryPhone: contact.primaryPhone,
                      primaryAddress: contact.primaryAddress,
                      leadStatus: contact.leadStatus,
                      assignedUser: contact.assignedUser,
                      createdAt: contact.createdAt,
                      profileImage: contact.profileImage,
                    }}
                  >
                    <div>
                      <div className="font-medium">
                        {contact.firstName} {contact.lastName}
                      </div>
                      {contact.assignedUser && (
                        <div className="text-sm text-muted-foreground">
                          Rep: {contact.assignedUser.name}
                        </div>
                      )}
                    </div>
                  </ContactHoverCard>
                </TableCell>
                <TableCell>
                  <Badge className={getStatusColor(contact.leadStatus)}>
                    {contact.leadStatus}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div>{contact.primaryEmail}</div>
                    <div className="text-sm text-muted-foreground">
                      {contact.primaryPhone}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div>{contact.propertyType}</div>
                    <div className="text-sm text-muted-foreground">
                      {contact.primaryAddress}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{contact.leadSource}</Badge>
                </TableCell>
                <TableCell>
                  {contact.projectTimeline || "Not specified"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}