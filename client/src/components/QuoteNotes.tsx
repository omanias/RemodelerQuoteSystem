import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface Note {
  id: number;
  content: string;
  createdAt: string;
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
  contact?: {
    id: number;
    firstName: string;
    lastName: string;
  };
}

interface QuoteNotesProps {
  quoteId: number;
  contactId?: number;
}

export function QuoteNotes({ quoteId, contactId }: QuoteNotesProps) {
  const [newNote, setNewNote] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: notes = [] } = useQuery<Note[]>({
    queryKey: [`/api/quotes/${quoteId}/notes`],
  });

  const createNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await fetch(`/api/quotes/${quoteId}/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content, contactId }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/quotes/${quoteId}/notes`] });
      if (contactId) {
        queryClient.invalidateQueries({ queryKey: [`/api/contacts/${contactId}/notes`] });
      }
      setNewNote("");
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    await createNoteMutation.mutateAsync(newNote.trim());
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Add a note..."
          className="flex-1"
        />
        <Button type="submit" disabled={!newNote.trim() || createNoteMutation.isPending}>
          Add Note
        </Button>
      </form>

      <div className="space-y-2">
        {notes.map((note) => (
          <Card key={note.id}>
            <CardContent className="pt-4">
              <div className="space-y-1">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{note.user.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  {note.contact && (
                    <span className="text-sm text-muted-foreground">
                      Re: {note.contact.firstName} {note.contact.lastName}
                    </span>
                  )}
                </div>
                <p className="text-sm">{note.content}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
