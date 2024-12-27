import { useParams, useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus } from "lucide-react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LeadStatus, LeadSource, PropertyType, QuoteStatus } from "@db/schema";
import { useToast } from "@/hooks/use-toast";

const contactFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  primaryEmail: z.string().email("Invalid email address"),
  secondaryEmail: z.string().email("Invalid email address").optional().or(z.literal("")),
  primaryPhone: z.string().min(1, "Phone number is required"),
  secondaryPhone: z.string().optional(),
  leadStatus: z.enum([LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.QUOTE_SENT, LeadStatus.PROJECT_STARTED, LeadStatus.COMPLETED, LeadStatus.LOST]),
  leadSource: z.enum([LeadSource.WEBSITE, LeadSource.REFERRAL, LeadSource.SOCIAL_MEDIA, LeadSource.HOME_SHOW, LeadSource.ADVERTISEMENT, LeadSource.OTHER]),
  propertyType: z.enum([PropertyType.SINGLE_FAMILY, PropertyType.MULTI_FAMILY, PropertyType.COMMERCIAL]),
  primaryAddress: z.string().min(1, "Address is required"),
  projectTimeline: z.string(),
  budget: z.string(),
  notes: z.string().optional(),
});

type ContactFormValues = z.infer<typeof contactFormSchema>;

export function ContactDetail() {
  const { id } = useParams();
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: contact, isLoading: isLoadingContact } = useQuery({
    queryKey: [`/api/contacts/${id}`],
    enabled: !!id
  });

  // Fetch associated quotes for this contact
  const { data: quotes = [], isLoading: isLoadingQuotes } = useQuery({
    queryKey: [`/api/contacts/${id}/quotes`],
    enabled: !!id
  });

  const createContact = useMutation({
    mutationFn: async (data: ContactFormValues) => {
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      toast({
        title: "Success",
        description: "Contact created successfully",
      });
      navigate('/contacts');
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateContact = useMutation({
    mutationFn: async (data: ContactFormValues) => {
      const response = await fetch(`/api/contacts/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/contacts/${id}`] });
      toast({
        title: "Success",
        description: "Contact updated successfully",
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

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: contact || {
      firstName: "",
      lastName: "",
      primaryEmail: "",
      secondaryEmail: "",
      primaryPhone: "",
      secondaryPhone: "",
      leadStatus: LeadStatus.NEW,
      leadSource: LeadSource.WEBSITE,
      propertyType: PropertyType.SINGLE_FAMILY,
      primaryAddress: "",
      projectTimeline: "",
      budget: "",
      notes: "",
    },
  });

  const onSubmit = async (data: ContactFormValues) => {
    if (id) {
      await updateContact.mutateAsync(data);
    } else {
      await createContact.mutateAsync(data);
    }
  };

  if (isLoadingContact) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
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
        {id && (
          <Link href={`/quotes/new?contactId=${id}`}>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Quote
            </Button>
          </Link>
        )}
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="quotes">Quotes</TabsTrigger>
          <TabsTrigger value="project-history">Project History</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="primaryEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primary Email</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="secondaryEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Secondary Email</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="primaryPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primary Phone</FormLabel>
                        <FormControl>
                          <Input {...field} type="tel" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="secondaryPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Secondary Phone</FormLabel>
                        <FormControl>
                          <Input {...field} type="tel" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="leadStatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lead Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.values(LeadStatus).map((status) => (
                              <SelectItem key={status} value={status}>
                                {status}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="leadSource"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lead Source</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select source" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.values(LeadSource).map((source) => (
                              <SelectItem key={source} value={source}>
                                {source}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="propertyType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Property Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select property type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.values(PropertyType).map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="primaryAddress"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Textarea {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="projectTimeline"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Timeline</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="budget"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Budget</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Initial Notes</FormLabel>
                        <FormControl>
                          <Textarea {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="col-span-2 flex justify-end">
                    <Button type="submit">
                      {id ? 'Update Contact' : 'Create Contact'}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quotes">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle>Quotes</CardTitle>
              <Link href={`/quotes/new?contactId=${id}`}>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Quote
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {isLoadingQuotes ? (
                <div className="text-center py-4">Loading quotes...</div>
              ) : quotes.length === 0 ? (
                <div className="text-center py-4">No quotes available</div>
              ) : (
                <div className="space-y-4">
                  {quotes.map((quote: any) => (
                    <div
                      key={quote.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div>
                        <div className="font-medium">Quote #{quote.number}</div>
                        <div className="text-sm text-muted-foreground">
                          Status: {quote.status}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Total: ${parseFloat(quote.total).toFixed(2)}
                        </div>
                      </div>
                      <Link href={`/quotes/${quote.id}`}>
                        <Button variant="outline" size="sm">
                          View Quote
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="project-history">
          <Card>
            <CardHeader>
              <CardTitle>Project History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-8">
                {/* Timeline component will go here */}
                <p className="text-muted-foreground">No project history available</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Document upload and list will go here */}
                <p className="text-muted-foreground">No documents available</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes">
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Notes form and list will go here */}
                <p className="text-muted-foreground">No notes available</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <CardTitle>Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Tasks form and list will go here */}
                <p className="text-muted-foreground">No tasks available</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}