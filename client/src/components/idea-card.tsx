import { useState } from "react";
import { useLocation } from "wouter";
import { Idea } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { CalendarIcon, MoreHorizontal, ExternalLink, ZapIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useIdeas } from "@/hooks/use-ideas";

interface IdeaCardProps {
  idea: Idea;
  onGenerate: () => void;
}

export function IdeaCard({ idea, onGenerate }: IdeaCardProps) {
  const [, navigate] = useLocation();
  const { deleteIdea } = useIdeas();
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  
  const formatTimeAgo = (date: string | Date) => {
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true });
    } catch (e) {
      return "Unknown time";
    }
  };
  
  const getStatusClasses = (status: string) => {
    switch(status) {
      case 'Completed':
        return 'bg-green-100 text-secondary-500';
      case 'Generating':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-neutral-100 text-neutral-800';
    }
  };
  
  const handleViewClick = () => {
    navigate(`/ideas/${idea.id}`);
  };
  
  const handleGenerateClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onGenerate();
  };
  
  const handleDelete = () => {
    deleteIdea(idea.id);
    setShowDeleteAlert(false);
  };
  
  return (
    <>
      <Card className="border border-neutral-200 shadow-sm overflow-hidden hover:shadow-md transition duration-200">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusClasses(idea.status)}`}>
              {idea.status}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-neutral-400 hover:text-neutral-500">
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleViewClick}>View Details</DropdownMenuItem>
                {idea.status === 'Draft' && (
                  <DropdownMenuItem onClick={() => onGenerate()}>Generate Canvas</DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => setShowDeleteAlert(true)} className="text-red-600">
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          <h3 className="text-lg font-semibold text-neutral-900 mb-2">
            {idea.companyName || idea.idea.split(' ').slice(0, 3).join(' ') + '...'}
          </h3>
          
          <p className="text-sm text-neutral-600 line-clamp-3 mb-4">
            {idea.idea}
          </p>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center text-xs text-neutral-500">
              <CalendarIcon className="h-4 w-4 mr-1" />
              <span>{formatTimeAgo(idea.createdAt)}</span>
            </div>
            
            {idea.status === 'Draft' ? (
              <Button 
                variant="link" 
                size="sm" 
                className="text-xs h-6 p-0 text-primary-600 hover:text-primary-800"
                onClick={handleGenerateClick}
              >
                Generate Canvas
                <ZapIcon className="ml-1 h-3 w-3" />
              </Button>
            ) : idea.status === 'Generating' ? (
              <div className="inline-flex items-center text-xs font-medium text-neutral-500">
                Processing...
                <svg className="ml-1 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            ) : (
              <Button 
                variant="link" 
                size="sm" 
                className="text-xs h-6 p-0 text-primary-600 hover:text-primary-800"
                onClick={handleViewClick}
              >
                View Canvas
                <ExternalLink className="ml-1 h-3 w-3" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      
      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this idea?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the idea and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
