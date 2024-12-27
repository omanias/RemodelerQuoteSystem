import { useParams } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";

export function ContactDetail() {
  const { id } = useParams();
  
  const { data: contact, isLoading } = useQuery({
    queryKey: [`/api/contacts/${id}`],
    enabled: !!id
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/contacts">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {contact ? `${contact.firstName} ${contact.lastName}` : 'New Contact'}
          </h1>
          <p className="text-muted-foreground">
            {contact ? contact.primaryEmail : 'Create a new contact'}
          </p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="project-history">Project History</TabsTrigger>
          <TabsTrigger value="quotes">Quotes</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Contact Information</h3>
              {/* Contact form will go here */}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="project-history">
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Project History</h3>
            {/* Project history timeline will go here */}
          </div>
        </TabsContent>

        <TabsContent value="quotes">
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Quotes</h3>
            {/* List of quotes will go here */}
          </div>
        </TabsContent>

        <TabsContent value="documents">
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Documents</h3>
            {/* Document manager will go here */}
          </div>
        </TabsContent>

        <TabsContent value="notes">
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Notes</h3>
            {/* Notes section will go here */}
          </div>
        </TabsContent>

        <TabsContent value="tasks">
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Tasks</h3>
            {/* Tasks manager will go here */}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
