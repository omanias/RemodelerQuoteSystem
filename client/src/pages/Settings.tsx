import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompanySettings } from "@/components/settings/CompanySettings";
import { QuoteSettings } from "@/components/settings/QuoteSettings";
import { EmailTemplates } from "@/components/settings/EmailTemplates";
import { NotificationPreferences } from "@/components/settings/NotificationPreferences";

export function Settings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your company settings and preferences
        </p>
      </div>

      <Tabs defaultValue="company" className="space-y-4">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="company">Company Settings</TabsTrigger>
          <TabsTrigger value="quotes">Quote Settings</TabsTrigger>
          <TabsTrigger value="email">Email Templates</TabsTrigger>
          <TabsTrigger value="notifications">Notification Preferences</TabsTrigger>
        </TabsList>

        <TabsContent value="company">
          <Card>
            <CardHeader>
              <CardTitle>Company Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <CompanySettings />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quotes">
          <Card>
            <CardHeader>
              <CardTitle>Quote Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <QuoteSettings />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email">
          <Card>
            <CardHeader>
              <CardTitle>Email Templates</CardTitle>
            </CardHeader>
            <CardContent>
              <EmailTemplates />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
            </CardHeader>
            <CardContent>
              <NotificationPreferences />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
