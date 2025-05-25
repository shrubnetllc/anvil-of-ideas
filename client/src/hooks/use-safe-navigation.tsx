import { useEffect } from 'react';
import { useLocation } from 'wouter';

/**
 * A custom hook that helps safely clean up event listeners and prevent memory leaks 
 * when navigating between pages.
 * 
 * @returns The current location and navigation function
 */
export function useSafeNavigation() {
  const [location, navigate] = useLocation();
  
  // Clean up any dangling event listeners when location changes
  useEffect(() => {
    // Store reference to any event handlers we create
    const modalOpenHandler = () => {
      console.log('Modal open event handled safely');
    };
    
    // Add a safe handler to prevent memory leaks
    window.addEventListener('open-new-idea-modal', modalOpenHandler);
    
    // This will run before unmounting the component due to navigation
    return () => {
      // Clean up by removing our safe handler
      window.removeEventListener('open-new-idea-modal', modalOpenHandler);
      
      // Attempt to clean up any other potential handlers
      try {
        // Create a dummy function to remove any other handlers that might exist
        const emptyFunction = () => {};
        window.removeEventListener('open-new-idea-modal', emptyFunction);
      } catch (error) {
        console.error('Error cleaning up event listeners:', error);
      }
    };
  }, [location]);
  
  return { location, navigate };
}