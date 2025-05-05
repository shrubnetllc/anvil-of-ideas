import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ClipboardList, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Home, Settings, CalendarClock, Plus, LogOut } from "lucide-react";

export function Header() {
  const [location, navigate] = useLocation();
  const { user, logoutMutation } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  
  // Check if the current location is at a specific path
  const isActive = (path: string) => location === path;
  
  // Handle scroll event to add shadow when scrolled
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 0) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  if (!user) return null;
  
  const initials = user.username.slice(0, 2).toUpperCase();

  return (
    <header className={`md:hidden sticky top-0 z-10 bg-white ${isScrolled ? 'shadow-sm' : ''}`}>
      <div className="flex items-center justify-between h-16 px-4 border-b border-neutral-200">
        <div className="flex items-center">
          <ClipboardList className="h-8 w-8 text-primary-500" />
          <span className="ml-2 text-lg font-semibold text-neutral-800">Lean Canvas</span>
        </div>
        
        <Sheet open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-6 w-6" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <div className="flex flex-col h-full">
              <div className="flex items-center h-16 px-4 border-b border-neutral-200">
                <div className="flex items-center">
                  <ClipboardList className="h-8 w-8 text-primary-500" />
                  <span className="ml-2 text-lg font-semibold text-neutral-800">Lean Canvas</span>
                </div>
              </div>
              
              <nav className="flex-1 px-2 py-4 space-y-1">
                <a 
                  className={`flex items-center px-2 py-2 text-sm font-medium rounded-md group
                    ${isActive('/') 
                      ? 'text-primary-500 bg-primary-50' 
                      : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800'}`}
                  onClick={() => {
                    navigate('/');
                    setIsMobileNavOpen(false);
                  }}
                >
                  <Home className="mr-3 h-5 w-5" />
                  Dashboard
                </a>
                
                <a 
                  className={`flex items-center px-2 py-2 text-sm font-medium rounded-md group
                    ${isActive('/new') 
                      ? 'text-primary-500 bg-primary-50' 
                      : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800'}`}
                  onClick={() => {
                    navigate('/new');
                    setIsMobileNavOpen(false);
                  }}
                >
                  <Plus className="mr-3 h-5 w-5" />
                  New Idea
                </a>
                
                <a 
                  className={`flex items-center px-2 py-2 text-sm font-medium rounded-md group
                    ${isActive('/activity') 
                      ? 'text-primary-500 bg-primary-50' 
                      : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800'}`}
                  onClick={() => {
                    navigate('/activity');
                    setIsMobileNavOpen(false);
                  }}
                >
                  <CalendarClock className="mr-3 h-5 w-5" />
                  Activity
                </a>
                
                <a 
                  className={`flex items-center px-2 py-2 text-sm font-medium rounded-md group
                    ${isActive('/settings') 
                      ? 'text-primary-500 bg-primary-50' 
                      : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800'}`}
                  onClick={() => {
                    navigate('/settings');
                    setIsMobileNavOpen(false);
                  }}
                >
                  <Settings className="mr-3 h-5 w-5" />
                  Settings
                </a>
              </nav>
              
              <div className="border-t border-neutral-200 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Avatar className="h-9 w-9 bg-primary-100 text-primary-700">
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-neutral-700">{user.username}</p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-neutral-500 hover:text-neutral-700"
                    onClick={() => {
                      logoutMutation.mutate();
                      setIsMobileNavOpen(false);
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
