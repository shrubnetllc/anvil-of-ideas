import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "./hooks/use-auth";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import IdeaDetail from "@/pages/idea-detail";
import Settings from "@/pages/settings";
// Using direct import instead of alias to avoid path issues
import EmailVerification from "./pages/email-verification";
import { ProtectedRoute } from "./lib/protected-route";
import ErrorBoundary from "@/components/error-boundary";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={Dashboard} />
      <ProtectedRoute path="/ideas/:id" component={IdeaDetail} />
      <ProtectedRoute path="/settings" component={Settings} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/confirm-email/:userId/:token" component={EmailVerification} />
      <Route path="/verify" component={EmailVerification} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="light">
          <TooltipProvider>
            <AuthProvider>
              <Toaster />
              <Router />
            </AuthProvider>
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
