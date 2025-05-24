import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Send, Settings as SettingsIcon, Mail, AlertCircle, CheckCircle, Save, User, RefreshCw, X, Info as InfoIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentTab, setCurrentTab] = useState("email");
  const [testEmailAddress, setTestEmailAddress] = useState("");
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [welcomeEmailAddress, setWelcomeEmailAddress] = useState("");
  const [welcomeUsername, setWelcomeUsername] = useState("");
  const [isSendingWelcomeEmail, setIsSendingWelcomeEmail] = useState(false);
  const [notificationEmailAddress, setNotificationEmailAddress] = useState("");
  const [notificationUsername, setNotificationUsername] = useState("");
  const [notificationIdeaTitle, setNotificationIdeaTitle] = useState("");
  const [isSendingNotificationEmail, setIsSendingNotificationEmail] = useState(false);
  const [emailFromAddress, setEmailFromAddress] = useState("");
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState<boolean | null>(null);
  const [isResendingVerification, setIsResendingVerification] = useState(false);

  // Load email configuration when component mounts
  useEffect(() => {
    // Use a mounted flag to prevent state updates after component unmounts
    let mounted = true;
    
    const loadEmailConfig = async () => {
      if (!mounted) return;
      setIsLoadingConfig(true);
      
      try {
        const response = await apiRequest("GET", "/api/email/config");
        if (!mounted) return;
        
        const data = await response.json();
        if (mounted && data.fromAddress) {
          setEmailFromAddress(data.fromAddress);
        }
      } catch (error) {
        if (!mounted) return;
        
        console.error("Failed to load email configuration:", error);
        toast({
          title: "Configuration Error",
          description: "Failed to load email configuration",
          variant: "destructive"
        });
      } finally {
        if (mounted) {
          setIsLoadingConfig(false);
        }
      }
    };

    const checkEmailVerificationStatus = async () => {
      if (!user || !mounted) return;
      
      try {
        const response = await apiRequest("GET", "/api/email/verification-status");
        if (!mounted) return;
        
        const data = await response.json();
        if (mounted) {
          setIsEmailVerified(data.isVerified);
        }
      } catch (error) {
        if (!mounted) return;
        
        console.error("Failed to check email verification status:", error);
        if (mounted) {
          setIsEmailVerified(null);
        }
      }
    };

    loadEmailConfig();
    checkEmailVerificationStatus();
    
    // Return cleanup function to prevent state updates after unmount
    return () => {
      mounted = false;
    };
  }, [toast, user]);

  const handleSaveEmailConfig = async () => {
    if (!emailFromAddress) {
      toast({
        title: "Missing Information",
        description: "Please enter a valid 'From' email address",
        variant: "destructive"
      });
      return;
    }

    setIsSavingConfig(true);
    
    try {
      const response = await apiRequest("POST", "/api/email/config", { 
        fromAddress: emailFromAddress
      });
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Configuration Saved",
          description: "Email configuration updated successfully",
          variant: "default"
        });
      } else {
        throw new Error(data.message || "Failed to save email configuration");
      }
    } catch (error) {
      toast({
        title: "Configuration Error",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsSavingConfig(false);
    }
  };

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
  
  const handleResendVerification = async () => {
    if (!user || !user.email) {
      toast({
        title: "Missing Information",
        description: "No email address associated with your account.",
        variant: "destructive"
      });
      return;
    }
    
    setIsResendingVerification(true);
    
    try {
      const response = await apiRequest("POST", "/api/resend-verification");
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Verification Email Sent",
          description: "A new verification email has been sent to your email address.",
          variant: "default"
        });
      } else {
        throw new Error(data.message || "Failed to send verification email");
      }
    } catch (error) {
      toast({
        title: "Failed to Resend Verification",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsResendingVerification(false);
    }
  };

  // Simplified tab UI component
  const tabClass = (tabName: string) => 
    `px-4 py-2 text-sm font-medium ${
      currentTab === tabName 
        ? "border-b-2 border-primary text-primary" 
        : "text-neutral-500 hover:text-neutral-900 hover:border-b border-neutral-300"
    }`;

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
            
            {/* Simple tab navigation */}
            <div className="border-b border-neutral-200 mb-6">
              <div className="flex">
                <button 
                  className={tabClass("email")}
                  onClick={() => setCurrentTab("email")}
                >
                  Email
                </button>
                <button 
                  className={tabClass("account")}
                  onClick={() => setCurrentTab("account")}
                >
                  Account
                </button>
                <button 
                  className={tabClass("notifications")}
                  onClick={() => setCurrentTab("notifications")}
                >
                  Notifications
                </button>
              </div>
            </div>
            
            {/* Email Tab Content */}
            {currentTab === "email" && (
              <div className="space-y-6">
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Mail className="h-5 w-5 mr-2 text-primary" />
                      Email Configuration
                    </CardTitle>
                    <CardDescription>
                      Configure email service settings
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="text-lg font-medium mb-4">Email Service Settings</h3>
                      <div className="grid gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="email-from">From Address</Label>
                          <Input
                            id="email-from"
                            placeholder="Anvil of Ideas <no-reply@anvilofideas.com>"
                            value={emailFromAddress}
                            onChange={(e) => setEmailFromAddress(e.target.value)}
                            disabled={isLoadingConfig}
                          />
                          <p className="text-sm text-neutral-500">
                            Format: "Display Name &lt;email@example.com&gt;" or just "email@example.com"
                          </p>
                        </div>
                        <Button 
                          onClick={handleSaveEmailConfig}
                          disabled={isSavingConfig || !emailFromAddress || isLoadingConfig}
                        >
                          {isSavingConfig ? (
                            <span className="flex items-center">
                              <span className="mr-2">Saving</span>
                              <AlertCircle className="h-4 w-4 animate-spin" />
                            </span>
                          ) : (
                            <span className="flex items-center">
                              <Save className="h-4 w-4 mr-2" />
                              Save Configuration
                            </span>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="bg-neutral-50 border-t px-6 py-4">
                    <div className="flex items-center text-sm text-neutral-500">
                      <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                      Email configuration is stored in the database
                    </div>
                  </CardFooter>
                </Card>
                
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
              </div>
            )}
            
            {/* Account Tab Content */}
            {currentTab === "account" && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <User className="h-5 w-5 mr-2 text-primary" />
                      Account Information
                    </CardTitle>
                    <CardDescription>
                      View and manage your account details and verification status
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div className="grid gap-2">
                        <Label htmlFor="username">Username</Label>
                        <Input id="username" value={user?.username || ''} disabled />
                      </div>
                      
                      <div className="grid gap-2">
                        <Label htmlFor="email" className="flex items-center gap-2">
                          Email Address
                          {isEmailVerified === null ? (
                            <Skeleton className="h-5 w-20" />
                          ) : isEmailVerified ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" /> Verified
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" /> Unverified
                            </Badge>
                          )}
                        </Label>
                        <Input id="email" value={user?.email || ''} disabled />
                        {!isEmailVerified && user?.email && (
                          <div className="mt-2">
                            <p className="text-sm text-amber-700 mb-2">
                              Your email address hasn't been verified. Please check your inbox for a verification email or click the button below to resend it.
                            </p>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={handleResendVerification} 
                              disabled={isResendingVerification}
                              className="flex items-center gap-1"
                            >
                              {isResendingVerification ? (
                                <>
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                  Sending...
                                </>
                              ) : (
                                <>
                                  <RefreshCw className="h-4 w-4" />
                                  Resend Verification Email
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="bg-neutral-50 border-t px-6 py-4">
                    <div className="flex items-center text-sm text-neutral-500">
                      <InfoIcon className="h-4 w-4 mr-2 text-blue-500" />
                      Email verification helps secure your account and enables full access to all features
                    </div>
                  </CardFooter>
                </Card>
              </div>
            )}
            
            {/* Notifications Tab Content */}
            {currentTab === "notifications" && (
              <div className="space-y-6">
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
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}