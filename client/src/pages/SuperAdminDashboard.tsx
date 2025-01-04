import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Building2, Users, FileText } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface CompanyMetrics {
  id: number;
  name: string;
  userCount: number;
  quoteCount: number;
  activeUsers: number;
  recentQuotes: number;
}

export function SuperAdminDashboard() {
  const { user } = useAuth();

  // Only SUPER_ADMIN and MULTI_ADMIN can access this page
  if (!user || !["SUPER_ADMIN", "MULTI_ADMIN"].includes(user.role)) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p>You don't have permission to view this page.</p>
        </CardContent>
      </Card>
    );
  }

  const { data: companyMetrics = [] } = useQuery<CompanyMetrics[]>({
    queryKey: ["/api/admin/company-metrics"],
  });

  // Transform data for the chart
  const chartData = companyMetrics.map(company => ({
    name: company.name,
    users: company.userCount,
    quotes: company.quoteCount,
    activeUsers: company.activeUsers,
  }));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Super Admin Dashboard</h1>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Companies</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{companyMetrics.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {companyMetrics.reduce((sum, company) => sum + company.userCount, 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Quotes</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {companyMetrics.reduce((sum, company) => sum + company.quoteCount, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Company Comparison Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Company Comparison</CardTitle>
          <CardDescription>
            Compare key metrics across companies
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="users" fill="#8884d8" name="Total Users" />
                <Bar dataKey="quotes" fill="#82ca9d" name="Total Quotes" />
                <Bar dataKey="activeUsers" fill="#ffc658" name="Active Users" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Company Metrics Table */}
      <Card>
        <CardHeader>
          <CardTitle>Company Details</CardTitle>
          <CardDescription>
            Detailed metrics for each company
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company Name</TableHead>
                <TableHead>Total Users</TableHead>
                <TableHead>Active Users</TableHead>
                <TableHead>Total Quotes</TableHead>
                <TableHead>Recent Quotes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companyMetrics.map((company) => (
                <TableRow key={company.id}>
                  <TableCell className="font-medium">{company.name}</TableCell>
                  <TableCell>{company.userCount}</TableCell>
                  <TableCell>{company.activeUsers}</TableCell>
                  <TableCell>{company.quoteCount}</TableCell>
                  <TableCell>{company.recentQuotes}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
