import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { UserPlus, Loader2, UserMinus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { UserRole, UserStatus } from "@db/schema";
import { useAuth } from "@/hooks/useAuth";

interface User {
  id: number;
  name: string;
  email: string;
  role: keyof typeof UserRole;
  status: keyof typeof UserStatus;
  companyId: number | null;
}

interface CompanyUsersProps {
  companyId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CompanyUsers({ companyId, open, onOpenChange }: CompanyUsersProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Check if user has permission to manage company users
  const canManageUsers = user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.MULTI_ADMIN;

  // Fetch company users
  const { data: users = [], isLoading: loadingUsers } = useQuery<User[]>({
    queryKey: [`/api/companies/${companyId}/users`],
    enabled: open && canManageUsers,
  });

  // Fetch available users (users not assigned to any company)
  const { data: availableUsers = [], isLoading: loadingAvailable } = useQuery<User[]>({
    queryKey: ['/api/users'],
    select: (users) => users.filter(user => !user.companyId || user.companyId === companyId),
    enabled: open && canManageUsers,
  });

  // Add user to company
  const addUser = useMutation({
    mutationFn: async (userId: number) => {
      const response = await fetch(`/api/companies/${companyId}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/companies/${companyId}/users`] });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: "Success",
        description: "User added to company successfully",
      });
      setSelectedUserId("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Remove user from company
  const removeUser = useMutation({
    mutationFn: async (userId: number) => {
      const response = await fetch(`/api/companies/${companyId}/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/companies/${companyId}/users`] });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: "Success",
        description: "User removed from company successfully",
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

  const handleAddUser = () => {
    if (selectedUserId) {
      addUser.mutate(parseInt(selectedUserId));
    }
  };

  const handleRemoveUser = (userId: number) => {
    if (confirm("Are you sure you want to remove this user from the company?")) {
      removeUser.mutate(userId);
    }
  };

  if (!canManageUsers) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Access Denied</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            You don't have permission to manage company users.
          </p>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Manage Company Users</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Select
              value={selectedUserId}
              onValueChange={setSelectedUserId}
            >
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Select user to add" />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    {user.name} ({user.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleAddUser}
              disabled={!selectedUserId || addUser.isPending}
            >
              {addUser.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4 mr-2" />
              )}
              Add User
            </Button>
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingUsers ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      No users found in this company
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{user.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            user.status === "ACTIVE"
                              ? "bg-green-100 text-green-800 hover:bg-green-200"
                              : "bg-red-100 text-red-800 hover:bg-red-200"
                          }
                        >
                          {user.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveUser(user.id)}
                          disabled={user.role === "SUPER_ADMIN" || removeUser.isPending}
                        >
                          <UserMinus className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}