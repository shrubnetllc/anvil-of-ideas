import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { 
  CalendarClock, 
  Home, 
  LogOut, 
  Plus, 
  Settings, 
  Hammer, 
  Flame, 
  Sparkles
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Sidebar() {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  
  if (!user) return null;
  
  const initials = user.username ? user.username.slice(0, 2).toUpperCase() : '';
  
  // Check if the current location is at a specific path
  const isActive = (path: string) => location === path;
  
  // New direct approach that doesn't use custom events
  const handleNewIdeaClick = (e: React.MouseEvent) => {
    e.preventDefault();
    // Instead of using custom events, let's use a direct approach
    // by storing a flag in sessionStorage
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.setItem('open-new-idea-modal', 'true');
      // Force a navigation to Dashboard which will check this flag
      window.location.href = '/';
    }
  };
  
  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:flex-col md:w-64 md:fixed md:inset-y-0 bg-white border-r border-neutral-200">
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center h-16 px-4 border-b border-neutral-200">
            <div className="flex items-center">
              <div className="relative">
                <Hammer className="h-8 w-8 text-primary-500" />
                <Sparkles className="h-4 w-4 absolute -top-1 -right-1 text-amber-400" />
              </div>
              <span className="ml-2 text-lg font-semibold text-neutral-800 bg-gradient-to-r from-primary-500 to-amber-500 bg-clip-text text-transparent">Anvil of Ideas</span>
            </div>
          </div>
          
          <nav className="flex-1 px-2 py-4 space-y-1">
            <Link href="/" className={`flex items-center px-2 py-2 text-sm font-medium rounded-md group
                ${isActive('/') 
                  ? 'text-primary-500 bg-primary-50' 
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800'}`}>
                <Flame className="mr-3 h-5 w-5 text-amber-500" />
                Ideas Forge
            </Link>
            
            <button 
              onClick={handleNewIdeaClick}
              className={`flex items-center px-2 py-2 text-sm font-medium rounded-md group w-full text-left
                text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800`}>
                <Hammer className="mr-3 h-5 w-5 text-primary-500" />
                Forge New Idea
            </button>
            
            <Link href="/activity" className={`flex items-center px-2 py-2 text-sm font-medium rounded-md group
                ${isActive('/activity') 
                  ? 'text-primary-500 bg-primary-50' 
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800'}`}>
                <CalendarClock className="mr-3 h-5 w-5" />
                Activity
            </Link>
            
            <Link href="/settings" className={`flex items-center px-2 py-2 text-sm font-medium rounded-md group
                ${isActive('/settings') 
                  ? 'text-primary-500 bg-primary-50' 
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800'}`}>
                <Settings className="mr-3 h-5 w-5" />
                Settings
            </Link>
          </nav>

          <div className="flex-shrink-0 border-t border-neutral-200 p-4">
            <div className="flex items-center">
              <Avatar className="h-9 w-9 bg-gradient-to-br from-primary to-secondary text-white">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="ml-3">
                <p className="text-sm font-medium text-neutral-700">{user.username}</p>
                <button 
                  className="text-xs font-medium text-neutral-500 hover:text-neutral-700"
                  onClick={() => logoutMutation.mutate()}
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
