import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, FileText, Package, FileEdit, 
  LogOut, Settings, Users 
} from "lucide-react";
import { auth } from "@/lib/firebase";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [location] = useLocation();

  if (!user) return null;

  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Quotes", href: "/quotes", icon: FileText },
    { name: "Products", href: "/products", icon: Package },
    { name: "Templates", href: "/templates", icon: FileEdit },
  ];

  if (user.role === "ADMIN") {
    navigation.push({ name: "Users", href: "/users", icon: Users });
    navigation.push({ name: "Settings", href: "/settings", icon: Settings });
  }

  return (
    <div className="flex h-screen">
      <Sidebar className="w-64 h-full">
        <div className="px-3 py-4 flex flex-col h-full">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-primary">QuoteBuilder</h1>
          </div>

          <nav className="flex-1 space-y-1">
            {navigation.map((item) => {
              const isActive = location === item.href;
              return (
                <Link key={item.name} href={item.href}>
                  <a
                    className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <item.icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </a>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto px-3 py-4">
            <div className="flex items-center">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-primary truncate">
                  {user.name}
                </p>
                <p className="text-xs text-muted-foreground">{user.role}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => auth.signOut()}
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
  );
}