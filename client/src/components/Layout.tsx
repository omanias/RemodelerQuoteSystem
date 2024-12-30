import { useAuth } from "@/hooks/useAuth";
import { Sidebar, SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { CompanySwitcher } from "@/components/CompanySwitcher";
import { useQuery } from "@tanstack/react-query";
import { 
  LayoutDashboard, FileText, Package,
  LogOut, Settings, Users, UserCircle2,
  Building2
} from "lucide-react";

type UserRole = "SUPER_ADMIN" | "MULTI_ADMIN" | "ADMIN" | "MANAGER" | "SALES_REP";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  // Fetch current company data
  const { data: currentCompany } = useQuery({
    queryKey: ["/api/companies/current"],
    enabled: !!user,
  });

  if (!user) return null;

  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Quotes", href: "/quotes", icon: FileText },
    { name: "Contacts", href: "/contacts", icon: UserCircle2 },
    { name: "Products", href: "/products", icon: Package },
  ];

  // Show additional menu items for admin roles
  if (["SUPER_ADMIN", "MULTI_ADMIN", "ADMIN"].includes(user.role as UserRole)) {
    navigation.push({ name: "Users", href: "/users", icon: Users });
    navigation.push({ name: "Settings", href: "/settings", icon: Settings });
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen">
        <Sidebar className="w-64 h-full">
          <div className="px-3 py-4 flex flex-col h-full">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-6 w-6 text-primary" />
                <h1 className="text-2xl font-bold text-primary">QuoteBuilder</h1>
              </div>

              {currentCompany && (
                <div className="text-sm text-muted-foreground px-2">
                  {currentCompany.name}
                </div>
              )}

              {/* Add CompanySwitcher for SUPER_ADMIN and MULTI_ADMIN */}
              {(user.role === "SUPER_ADMIN" || user.role === "MULTI_ADMIN") && (
                <div>
                  <CompanySwitcher />
                </div>
              )}
            </div>

            <nav className="flex-1 space-y-1 mt-6">
              {navigation.map((item) => {
                const isActive = location === item.href;
                return (
                  <Link key={item.name} href={item.href}>
                    <Button
                      variant={isActive ? "secondary" : "ghost"}
                      className="w-full justify-start"
                    >
                      <item.icon className="mr-3 h-5 w-5" />
                      {item.name}
                    </Button>
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto border-t pt-4">
              <div className="flex items-center px-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-primary truncate">
                    {user.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{user.role}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => logout()}
                  className="ml-2"
                >
                  <LogOut className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        </Sidebar>

        <main className="flex-1 overflow-auto bg-background">
          <div className="container mx-auto py-6 px-4">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}