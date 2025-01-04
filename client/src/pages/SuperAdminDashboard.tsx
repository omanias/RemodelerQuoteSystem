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
  LineChart,
  Line,
} from "recharts";
import {
  Building2, Users, FileText,
  TrendingUp, Activity, Settings
} from "lucide-react";
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

  // Only SUPER_ADMIN can access this page
  if (!user || user.role !== "SUPER_ADMIN") {
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

  // Calculate platform-wide metrics
  const totalCompanies = companyMetrics.length;
  const totalUsers = companyMetrics.reduce((sum, company) => sum + company.userCount, 0);
  const totalActiveUsers = companyMetrics.reduce((sum, company) => sum + company.activeUsers, 0);
  const totalQuotes = companyMetrics.reduce((sum, company) => sum + company.quoteCount, 0);
  const activeCompanies = companyMetrics.filter(company => company.activeUsers > 0).length;
  const userAdoptionRate = totalUsers > 0 ? (totalActiveUsers / totalUsers * 100).toFixed(1) : 0;

  // Transform data for the charts
  const activityData = companyMetrics.map(company => ({
    name: company.name,
    users: company.userCount,
    activeUsers: company.activeUsers,
    quotes: company.quoteCount,
    recentQuotes: company.recentQuotes,
    engagementRate: company.userCount > 0
      ? ((company.activeUsers / company.userCount) * 100).toFixed(1)
      : 0,
  }));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Platform Overview</h1>
      </div>

      {/* Key Platform Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Companies</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCompanies}</div>
            <p className="text-xs text-muted-foreground">
              {activeCompanies} active companies
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">User Adoption</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userAdoptionRate}%</div>
            <p className="text-xs text-muted-foreground">
              {totalActiveUsers} active out of {totalUsers} users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Platform Activity</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalQuotes}</div>
            <p className="text-xs text-muted-foreground">
              Total quotes generated
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Company Engagement Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Company Engagement Metrics</CardTitle>
          <CardDescription>
            User adoption and activity across companies
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="users" fill="#8884d8" name="Total Users" />
                <Bar yAxisId="left" dataKey="activeUsers" fill="#82ca9d" name="Active Users" />
                <Bar yAxisId="right" dataKey="engagementRate" fill="#ffc658" name="Engagement Rate (%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Company Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Company Performance</CardTitle>
          <CardDescription>
            Detailed metrics and engagement analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Total Users</TableHead>
                <TableHead>Active Users</TableHead>
                <TableHead>Engagement Rate</TableHead>
                <TableHead>Total Quotes</TableHead>
                <TableHead>Recent Activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activityData.map((company) => (
                <TableRow key={company.name}>
                  <TableCell className="font-medium">{company.name}</TableCell>
                  <TableCell>{company.users}</TableCell>
                  <TableCell>{company.activeUsers}</TableCell>
                  <TableCell>{company.engagementRate}%</TableCell>
                  <TableCell>{company.quotes}</TableCell>
                  <TableCell>{company.recentQuotes} quotes this month</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}