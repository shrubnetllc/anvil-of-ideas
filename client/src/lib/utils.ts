import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date) {
  if (!date) return 'N/A';
  return format(new Date(date), 'MMM d, yyyy');
}

/**
 * Convert JSON data to CSV format
 */
export function jsonToCSV(data: Record<string, any>): string {
  if (!data) return '';
  
  // Extract keys from the object, filtering out html and markdown which are too large for CSV
  const keys = Object.keys(data).filter(key => 
    key !== 'html' && key !== 'markdown' && key !== 'llmOutput' && key !== 'llmInput'
  );
  
  // Create CSV header row
  const header = keys.map(key => {
    // Convert camelCase to Title Case with spaces
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }).join(',');
  
  // Create CSV data row
  const dataRow = keys.map(key => {
    let value = data[key];
    
    // Handle different data types
    if (value === null || value === undefined) {
      return '';
    } else if (typeof value === 'string') {
      // Escape quotes and wrap in quotes to handle commas within text
      return `"${value.replace(/"/g, '""')}"`;
    } else {
      return `"${String(value).replace(/"/g, '""')}"`;
    }
  }).join(',');
  
  return `${header}\n${dataRow}`;
}

/**
 * Download data as a CSV file
 */
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
