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

/**
 * Copy HTML content to clipboard
 * @param elementId ID of the HTML element whose content should be copied
 * @returns Promise resolving to boolean indicating success
 */
export async function copyHtmlToClipboard(elementId: string): Promise<boolean> {
  try {
    const element = document.getElementById(elementId);
    if (!element) {
      console.error(`Element with ID '${elementId}' not found`);
      return false;
    }

    // Try to use the modern clipboard API with HTML
    const htmlContent = element.innerHTML;
    const textContent = element.textContent || '';

    if (navigator.clipboard && window.ClipboardItem) {
      // Modern approach - better HTML formatting for supported browsers
      try {
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const textBlob = new Blob([textContent], { type: 'text/plain' });

        const data = [
          new ClipboardItem({
            'text/html': blob,
            'text/plain': textBlob
          })
        ];

        await navigator.clipboard.write(data);
        return true;
      } catch (e) {
        console.warn('HTML clipboard write failed, falling back to text', e);
        // Fall back to text-only if the HTML approach fails
        await navigator.clipboard.writeText(textContent);
        return true;
      }
    } else if (navigator.clipboard) {
      // Fallback to text-only clipboard API
      await navigator.clipboard.writeText(textContent);
      return true;
    } else {
      // Last resort: selection-based copying
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(element);
      selection?.removeAllRanges();
      selection?.addRange(range);
      const result = document.execCommand('copy');
      selection?.removeAllRanges();
      return result;
    }
  } catch (error) {
    console.error('Failed to copy content to clipboard', error);
    return false;
  }
}
