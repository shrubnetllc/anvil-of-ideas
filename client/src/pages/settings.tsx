import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Send, Settings as SettingsIcon, Mail, AlertCircle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [testEmailAddress, setTestEmailAddress] = useState("");
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [welcomeEmailAddress, setWelcomeEmailAddress] = useState("");
  const [welcomeUsername, setWelcomeUsername] = useState("");
  const [isSendingWelcomeEmail, setIsSendingWelcomeEmail] = useState(false);
  const [notificationEmailAddress, setNotificationEmailAddress] = useState("");
  const [notificationUsername, setNotificationUsername] = useState("");
  const [notificationIdeaTitle, setNotificationIdeaTitle] = useState("");
  const [isSendingNotificationEmail, setIsSendingNotificationEmail] = useState(false);

  const handleSendTestEmail = async () => {
    if (!testEmailAddress) {
      toast({
        title: "Email Address Required",
        description: "Please enter an email address to send the test email.",
        variant: "destructive"
      });
      return;
    }

    setIsSendingTestEmail(true);
    
    try {
      const response = await apiRequest("POST", "/api/email/test", { email: testEmailAddress });
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Test Email Sent",
          description: "The test email was sent successfully.",
          variant: "default"
        });
      } else {
        throw new Error(data.message || "Failed to send test email");
      }
    } catch (error) {
      toast({
        title: "Failed to Send Test Email",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  const handleSendWelcomeEmail = async () => {
    if (!welcomeEmailAddress || !welcomeUsername) {
      toast({
        title: "Missing Information",
        description: "Please enter both email address and username.",
        variant: "destructive"
      });
      return;
    }

    setIsSendingWelcomeEmail(true);
    
    try {
      const response = await apiRequest("POST", "/api/email/welcome", { 
        email: welcomeEmailAddress,
        username: welcomeUsername
      });
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Welcome Email Sent",
          description: "The welcome email was sent successfully.",
          variant: "default"
        });
      } else {
        throw new Error(data.message || "Failed to send welcome email");
      }
    } catch (error) {
      toast({
        title: "Failed to Send Welcome Email",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsSendingWelcomeEmail(false);
    }
  };

  const handleSendNotificationEmail = async () => {
    if (!notificationEmailAddress || !notificationUsername || !notificationIdeaTitle) {
      toast({
        title: "Missing Information",
        description: "Please enter email address, username, and idea title.",
        variant: "destructive"
      });
      return;
    }

    setIsSendingNotificationEmail(true);
    
    try {
      const response = await apiRequest("POST", "/api/email/canvas-generated", { 
        email: notificationEmailAddress,
        username: notificationUsername,
        ideaTitle: notificationIdeaTitle
      });
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Notification Email Sent",
          description: "The canvas generation notification email was sent successfully.",
          variant: "default"
        });
      } else {
        throw new Error(data.message || "Failed to send notification email");
      }
    } catch (error) {
      toast({
        title: "Failed to Send Notification Email",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsSendingNotificationEmail(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-y-auto bg-neutral-50 px-6 py-8">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center mb-6">
              <SettingsIcon className="h-6 w-6 mr-2 text-primary" />
              <h1 className="text-2xl font-semibold text-neutral-900">Settings</h1>
            </div>
            
            <Tabs defaultValue="email" className="w-full">
              <TabsList>
                <TabsTrigger value="email">Email</TabsTrigger>
                <TabsTrigger value="account">Account</TabsTrigger>
                <TabsTrigger value="notifications">Notifications</TabsTrigger>
              </TabsList>
              
              <TabsContent value="email" className="space-y-6 mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Mail className="h-5 w-5 mr-2 text-primary" />
                      Email Service Test
                    </CardTitle>
                    <CardDescription>
                      Test the email functionality by sending test emails
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-lg font-medium mb-4">Test Email</h3>
                        <div className="grid gap-4">
                          <div className="grid gap-2">
                            <Label htmlFor="test-email">Email Address</Label>
                            <Input
                              id="test-email"
                              placeholder="Enter email address"
                              value={testEmailAddress}
                              onChange={(e) => setTestEmailAddress(e.target.value)}
                            />
                          </div>
                          <Button 
                            onClick={handleSendTestEmail}
                            disabled={isSendingTestEmail || !testEmailAddress}
                          >
                            {isSendingTestEmail ? 'Sending...' : 'Send Test Email'}
                          </Button>
                        </div>
                      </div>
                      
                      <Separator />
                      
                      <div>
                        <h3 className="text-lg font-medium mb-4">Welcome Email</h3>
                        <div className="grid gap-4">
                          <div className="grid gap-2">
                            <Label htmlFor="welcome-email">Email Address</Label>
                            <Input
                              id="welcome-email"
                              placeholder="Enter email address"
                              value={welcomeEmailAddress}
                              onChange={(e) => setWelcomeEmailAddress(e.target.value)}
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="welcome-username">Username</Label>
                            <Input
                              id="welcome-username"
                              placeholder="Enter username"
                              value={welcomeUsername}
                              onChange={(e) => setWelcomeUsername(e.target.value)}
                            />
                          </div>
                          <Button 
                            onClick={handleSendWelcomeEmail}
                            disabled={isSendingWelcomeEmail || !welcomeEmailAddress || !welcomeUsername}
                          >
                            {isSendingWelcomeEmail ? 'Sending...' : 'Send Welcome Email'}
                          </Button>
                        </div>
                      </div>
                      
                      <Separator />
                      
                      <div>
                        <h3 className="text-lg font-medium mb-4">Canvas Generation Notification</h3>
                        <div className="grid gap-4">
                          <div className="grid gap-2">
                            <Label htmlFor="notification-email">Email Address</Label>
                            <Input
                              id="notification-email"
                              placeholder="Enter email address"
                              value={notificationEmailAddress}
                              onChange={(e) => setNotificationEmailAddress(e.target.value)}
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="notification-username">Username</Label>
                            <Input
                              id="notification-username"
                              placeholder="Enter username"
                              value={notificationUsername}
                              onChange={(e) => setNotificationUsername(e.target.value)}
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="notification-idea-title">Idea Title</Label>
                            <Input
                              id="notification-idea-title"
                              placeholder="Enter idea title"
                              value={notificationIdeaTitle}
                              onChange={(e) => setNotificationIdeaTitle(e.target.value)}
                            />
                          </div>
                          <Button 
                            onClick={handleSendNotificationEmail}
                            disabled={isSendingNotificationEmail || !notificationEmailAddress || !notificationUsername || !notificationIdeaTitle}
                          >
                            {isSendingNotificationEmail ? 'Sending...' : 'Send Notification Email'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="bg-neutral-50 border-t px-6 py-4">
                    <div className="flex items-center text-sm text-neutral-500">
                      <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                      Using Mailgun email service
                    </div>
                  </CardFooter>
                </Card>
              </TabsContent>
              
              <TabsContent value="account" className="space-y-6 mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Account Settings</CardTitle>
                    <CardDescription>
                      Manage your account settings and preferences
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-neutral-500">Account settings will be implemented in a future update.</p>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="notifications" className="space-y-6 mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Notification Preferences</CardTitle>
                    <CardDescription>
                      Manage how and when you receive notifications
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-neutral-500">Notification preferences will be implemented in a future update.</p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}