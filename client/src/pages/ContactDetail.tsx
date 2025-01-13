import { useState, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
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
import { LeadStatus, LeadSource, PropertyType } from "@db/schema";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

// Define the Contact interface to match API response
interface Contact {
  id: number;
  firstName: string;
  lastName: string;
  primaryEmail: string;
  secondaryEmail?: string;
  primaryPhone: string;
  mobilePhone?: string;
  leadStatus: LeadStatus;
  leadSource: LeadSource;
  propertyType: PropertyType;
  primaryAddress: string;
  projectAddress?: string;
  projectTimeline?: string;
  budgetRangeMin?: number;
  budgetRangeMax?: number;
  productInterests: string;
  notes?: string;
  assignedUserId?: number;
  companyId?: number;
  createdAt: string;
  updatedAt: string;
}

// Define types for the note
interface Note {
  id: number;
  content: string;
  contactId: number;
  userId: number;
  type: 'CONTACT' | 'QUOTE';
  quoteId?: number;
  createdAt: string;
  updatedAt: string;
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
}

const contactFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  primaryEmail: z.string().email("Invalid email address"),
  secondaryEmail: z.string().email("Invalid email address").optional().or(z.literal("")),
  primaryPhone: z.string().min(1, "Phone number is required"),
  mobilePhone: z.string().optional(),
  leadStatus: z.enum([LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.QUOTE_SENT, LeadStatus.PROJECT_STARTED, LeadStatus.COMPLETED, LeadStatus.LOST]),
  leadSource: z.enum([LeadSource.WEBSITE, LeadSource.REFERRAL, LeadSource.SOCIAL_MEDIA, LeadSource.HOME_SHOW, LeadSource.ADVERTISEMENT, LeadSource.OTHER]),
  propertyType: z.enum([PropertyType.SINGLE_FAMILY, PropertyType.MULTI_FAMILY, PropertyType.COMMERCIAL]),
  primaryAddress: z.string().min(1, "Address is required"),
  projectAddress: z.string().optional(),
  projectTimeline: z.string(),
  budgetRangeMin: z.number().optional(),
  budgetRangeMax: z.number().optional(),
  productInterests: z.string().min(1, "Product interests are required"),
  notes: z.string().optional(),
  assignedUserId: z.number().optional(),
  companyId: z.number().optional(),
});

type ContactFormValues = z.infer<typeof contactFormSchema>;

const noteFormSchema = z.object({
  content: z.string().min(1, "Note content is required"),
});

type NoteFormValues = z.infer<typeof noteFormSchema>;

export function ContactDetail() {
  const { id } = useParams();
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: contact, isLoading: isLoadingContact } = useQuery<Contact>({
    queryKey: [`/api/contacts/${id}`],
    enabled: !!id,
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
        body: JSON.stringify({
          ...data,
          assignedUserId: 1,
          companyId: 1,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create contact');
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
        body: JSON.stringify({
          ...data,
          assignedUserId: contact?.assignedUserId || 1,
          companyId: contact?.companyId || 1,
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update contact');
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

  const defaultValues: ContactFormValues = {
    firstName: "",
    lastName: "",
    primaryEmail: "",
    secondaryEmail: "",
    primaryPhone: "",
    mobilePhone: "",
    leadStatus: LeadStatus.NEW,
    leadSource: LeadSource.WEBSITE,
    propertyType: PropertyType.SINGLE_FAMILY,
    primaryAddress: "",
    projectAddress: "",
    projectTimeline: "",
    budgetRangeMin: undefined,
    budgetRangeMax: undefined,
    productInterests: "",
    notes: "",
    assignedUserId: undefined,
    companyId: undefined,
  };

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues,
  });

  // Update form when contact data changes
  useEffect(() => {
    if (contact) {
      form.reset({
        firstName: contact.firstName || "",
        lastName: contact.lastName || "",
        primaryEmail: contact.primaryEmail || "",
        secondaryEmail: contact.secondaryEmail || "",
        primaryPhone: contact.primaryPhone || "",
        mobilePhone: contact.mobilePhone || "",
        leadStatus: contact.leadStatus || LeadStatus.NEW,
        leadSource: contact.leadSource || LeadSource.WEBSITE,
        propertyType: contact.propertyType || PropertyType.SINGLE_FAMILY,
        primaryAddress: contact.primaryAddress || "",
        projectAddress: contact.projectAddress || "",
        projectTimeline: contact.projectTimeline || "",
        budgetRangeMin: contact.budgetRangeMin,
        budgetRangeMax: contact.budgetRangeMax,
        productInterests: contact.productInterests || "",
        notes: contact.notes || "",
        assignedUserId: contact.assignedUserId,
        companyId: contact.companyId,
      });
    }
  }, [contact, form]);

  const onSubmit = async (data: ContactFormValues) => {
    if (id) {
      await updateContact.mutateAsync(data);
    } else {
      await createContact.mutateAsync(data);
    }
  };

  // Add notes query
  const { data: notes = [], isLoading: isLoadingNotes } = useQuery<Note[]>({
    queryKey: [`/api/contacts/${id}/notes`],
    enabled: !!id
  });

  // Add note mutation
  const addNote = useMutation({
    mutationFn: async (data: NoteFormValues) => {
      const response = await fetch(`/api/contacts/${id}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add note');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/contacts/${id}/notes`] });
      toast({
        title: "Success",
        description: "Note added successfully",
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

  const noteForm = useForm<NoteFormValues>({
    resolver: zodResolver(noteFormSchema),
    defaultValues: {
      content: "",
    },
  });

  const onAddNote = async (data: NoteFormValues) => {
    await addNote.mutateAsync(data);
    noteForm.reset();
  };

  // Add delete contact mutation
  const deleteContact = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/contacts/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete contact');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      toast({
        title: "Success",
        description: "Contact deleted successfully",
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


  if (isLoadingContact) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
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

        {contact && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="icon">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the contact
                  and all associated data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteContact.mutate()}>
                  Delete Contact
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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
                    name="mobilePhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mobile Phone</FormLabel>
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
                    name="projectAddress"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Project Address (if different from primary)</FormLabel>
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
                    name="budgetRangeMin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Minimum Budget</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="budgetRangeMax"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Maximum Budget</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="productInterests"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Product Interests</FormLabel>
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
              {id && (
                <Link href={`/quotes/new?contactId=${id}`}>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Quote
                  </Button>
                </Link>
              )}
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
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle>Notes</CardTitle>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Note
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Note</DialogTitle>
                  </DialogHeader>
                  <Form {...noteForm}>
                    <form onSubmit={noteForm.handleSubmit(onAddNote)} className="space-y-4">
                      <FormField
                        control={noteForm.control}
                        name="content"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Note Content</FormLabel>
                            <FormControl>
                              <Textarea {...field} rows={4} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit">Add Note</Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {isLoadingNotes ? (
                  <div className="text-center py-4">Loading notes...</div>
                ) : notes.length === 0 ? (
                  <p className="text-muted-foreground">No notes available</p>
                ) : (
                  <div className="space-y-4">
                    {notes.map((note) => (
                      <div
                        key={note.id}
                        className="flex flex-col space-y-2 p-4 border rounded-lg"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Avatar>
                              <AvatarFallback>
                                {note.user.name.split(' ').map((n) => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{note.user.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {new Date(note.createdAt).toLocaleString()}
                              </div>
                            </div>
                          </div>
                          <Badge variant="outline">{note.type}</Badge>
                        </div>
                        <p className="text-sm">{note.content}</p>
                      </div>
                    ))}
                  </div>
                )}
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