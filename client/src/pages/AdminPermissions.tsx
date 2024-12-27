import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

// Types based on our schema
type TablePermission = {
  id: number;
  tableName: string;
  roleId: string;
  permissionType: string;
  isAllowed: boolean;
};

type Role = "ADMIN" | "MANAGER" | "SALES_REP";

const TABLES = ["quotes", "products", "categories", "users", "templates"];
const ROLES: Role[] = ["ADMIN", "MANAGER", "SALES_REP"];
const PERMISSIONS = ["VIEW", "CREATE", "EDIT", "DELETE"];

export function AdminPermissions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<Role>("SALES_REP");

  // Fetch permissions
  const { data: permissions = [], isLoading } = useQuery<TablePermission[]>({
    queryKey: ["/api/permissions"],
  });

  // Update permission mutation
  const updatePermission = useMutation({
    mutationFn: async ({
      tableName,
      roleId,
      permissionType,
      isAllowed,
    }: Partial<TablePermission>) => {
      const response = await fetch("/api/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableName, roleId, permissionType, isAllowed }),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/permissions"] });
      toast({
        title: "Permissions updated",
        description: "The permissions have been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating permissions",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Check if a specific permission is allowed
  const isPermissionAllowed = (
    tableName: string,
    role: string,
    permissionType: string
  ) => {
    return permissions.some(
      (p) =>
        p.tableName === tableName &&
        p.roleId === role &&
        p.permissionType === permissionType &&
        p.isAllowed
    );
  };

  // Handle permission toggle
  const handlePermissionToggle = (
    tableName: string,
    role: string,
    permissionType: string,
    currentState: boolean
  ) => {
    updatePermission.mutate({
      tableName,
      roleId: role,
      permissionType,
      isAllowed: !currentState,
    });
  };

  // Bulk actions
  const handleBulkAction = (
    tableName: string,
    role: string,
    action: "grant" | "revoke"
  ) => {
    PERMISSIONS.forEach((permission) => {
      updatePermission.mutate({
        tableName,
        roleId: role,
        permissionType: permission,
        isAllowed: action === "grant",
      });
    });
  };

  if (isLoading) {
    return <div>Loading permissions...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Permission Management</CardTitle>
          <CardDescription>
            Manage access permissions for different roles and tables
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-2">
              {ROLES.map((role) => (
                <Button
                  key={role}
                  variant={selectedRole === role ? "default" : "outline"}
                  onClick={() => setSelectedRole(role)}
                >
                  {role}
                </Button>
              ))}
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Table</TableHead>
                  {PERMISSIONS.map((permission) => (
                    <TableHead key={permission}>{permission}</TableHead>
                  ))}
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {TABLES.map((table) => (
                  <TableRow key={table}>
                    <TableCell className="font-medium capitalize">
                      {table}
                    </TableCell>
                    {PERMISSIONS.map((permission) => (
                      <TableCell key={permission}>
                        <Checkbox
                          checked={isPermissionAllowed(
                            table,
                            selectedRole,
                            permission
                          )}
                          onCheckedChange={(checked) =>
                            handlePermissionToggle(
                              table,
                              selectedRole,
                              permission,
                              !!checked
                            )
                          }
                        />
                      </TableCell>
                    ))}
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleBulkAction(table, selectedRole, "grant")
                          }
                        >
                          Grant All
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleBulkAction(table, selectedRole, "revoke")
                          }
                        >
                          Revoke All
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
