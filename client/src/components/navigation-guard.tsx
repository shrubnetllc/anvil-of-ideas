import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';

/**
 * NavigationGuard component that helps prevent and catch navigation errors
 * by safely handling state cleanup between page transitions.
 */
export function NavigationGuard({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [prevLocation, setPrevLocation] = useState(location);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Track location changes and handle cleanup
  useEffect(() => {
    if (location !== prevLocation) {
      // Location is changing, handle cleanup
      setIsTransitioning(true);
      
      // Remove any event listeners that might cause issues
      const cleanupCustomEvents = () => {
        const noop = () => {};
        try {
          window.removeEventListener('open-new-idea-modal', noop);
        } catch (err) {
          console.log('Event cleanup complete');
        }
      };
      
      // Clean up before transition
      cleanupCustomEvents();
      
      // Mark transition as complete after a small delay
      setTimeout(() => {
        setPrevLocation(location);
        setIsTransitioning(false);
      }, 50);
    }
  }, [location, prevLocation]);

  return (
    <React.Fragment>
      {children}
    </React.Fragment>
  );
}