import { useEffect, useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from '@/components/ui/button';

export default function EmailVerification() {
  const params = useParams<{ userId: string; token: string }>();
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // The verification will happen automatically through our route at /confirm-email/:userId/:token
    // which will redirect to /?verified=true or /?verified=false
    // We can just check for verified param in the URL
    const urlParams = new URLSearchParams(window.location.search);
    const verified = urlParams.get('verified');
    
    if (verified === 'true') {
      setStatus('success');
      // We're already redirected to the main page with a query parameter
      setTimeout(() => {
        // Remove query param after showing success message
        setLocation('/');
      }, 3000);
    } else if (verified === 'false') {
      setError('Verification failed. The link may have expired or already been used.');
      setStatus('error');
    } else if (params.userId && params.token) {
      // If we have userId and token in the path, we'll wait for server to process
      // Keep status as loading since the redirect will happen automatically
      setStatus('loading');
    } else {
      setError('Invalid verification link');
      setStatus('error');
    }
  }, [params.userId, params.token, setLocation]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-neutral-50">
      <Card className="w-[450px] shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Email Verification</CardTitle>
          <CardDescription>
            {status === 'loading' ? 'Verifying your email address...' : 
              status === 'success' ? 'Your email has been verified!' : 
              'Verification failed'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-6">
          {status === 'loading' && (
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-16 w-16 text-primary animate-spin" />
              <p className="text-lg text-center text-neutral-600">Please wait while we verify your email address...</p>
            </div>
          )}
          
          {status === 'success' && (
            <div className="flex flex-col items-center space-y-4">
              <CheckCircle className="h-16 w-16 text-green-500" />
              <p className="text-lg text-center text-neutral-600">
                Thank you for verifying your email address! You now have full access to all features.
              </p>
              <p className="text-sm text-center text-neutral-500">
                You will be redirected to the dashboard in a few seconds...
              </p>
              <Button 
                onClick={() => setLocation('/')} 
                className="mt-4"
              >
                Go to Dashboard
              </Button>
            </div>
          )}
          
          {status === 'error' && (
            <div className="flex flex-col items-center space-y-4">
              <XCircle className="h-16 w-16 text-red-500" />
              <p className="text-lg text-center text-neutral-600">
                {error || 'There was a problem verifying your email.'}
              </p>
              <p className="text-sm text-center text-neutral-500">
                This might be because:
              </p>
              <ul className="text-sm text-center text-neutral-500 list-disc list-inside">
                <li>The verification link has expired</li>
                <li>The verification link was already used</li>
                <li>The verification link is invalid</li>
              </ul>
              <div className="flex flex-col space-y-2 w-full max-w-[250px] mt-2">
                <Button 
                  onClick={() => setLocation('/auth')} 
                  variant="outline"
                >
                  Return to Login
                </Button>
                <Button 
                  onClick={() => setLocation('/settings')} 
                >
                  Go to Account Settings
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}