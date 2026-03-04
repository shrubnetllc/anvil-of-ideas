import { useState } from "react";
import { CanvasSection } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { PencilIcon } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useLeanCanvas } from "@/hooks/use-lean-canvas";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface CanvasSectionProps {
  ideaId: string;
  section: CanvasSection;
  content: string | null;
  isEditing?: boolean;
}

export function CanvasSectionComponent({ ideaId, section, content, isEditing: parentEditing }: CanvasSectionProps) {
  const { updateSection, isUpdating } = useLeanCanvas(ideaId);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editedContent, setEditedContent] = useState(content || "");
  if (!section) return null;

  const formatSectionTitle = (section: string) => {
    return section
      .replace(/([A-Z])/g, ' $1')
      .trim();
  };

  const handleSave = () => {
    updateSection(section, editedContent);
    setIsEditDialogOpen(false);
  };

  const handleCancel = () => {
    setEditedContent(content || "");
    setIsEditDialogOpen(false);
  };

  const formatContent = (content: string | null) => {
    if (!content) return null;

    const hasBulletPoints = content.includes('•') || content.includes('-') || content.includes('*');

    if (hasBulletPoints) {
      const lines = content
        .split(/[\n\r]+/)
        .map(line => line.trim())
        .filter(line => line.length > 0);

      return (
        <ul className="text-sm text-neutral-700 space-y-2">
          {lines.map((line, index) => (
            <li key={index}>
              {line.startsWith('•') || line.startsWith('-') || line.startsWith('*')
                ? line
                : `• ${line}`}
            </li>
          ))}
        </ul>
      );
    } else {
      return <p className="text-sm text-neutral-700">{content}</p>;
    }
  };

  return (
    <>
      <div className="bg-neutral-50 rounded-lg p-4 border border-neutral-200">
        <div className="flex justify-between items-start mb-3">
          <h3 className="font-semibold text-neutral-900">{formatSectionTitle(section)}</h3>
          {parentEditing && (
            <Button variant="ghost" size="icon" className="h-6 w-6 text-neutral-400 hover:text-neutral-600" onClick={() => {
              setEditedContent(content || "");
              setIsEditDialogOpen(true);
            }}>
              <PencilIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
        {formatContent(content)}
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={(open) => !open && handleCancel()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit {formatSectionTitle(section)}</DialogTitle>
            <DialogDescription>
              Update the content of this section. Use bullet points (• or -) for lists.
            </DialogDescription>
          </DialogHeader>

          <Textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            placeholder={`Enter details for ${formatSectionTitle(section)}`}
            rows={8}
            className="resize-none"
          />

          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isUpdating}>
              {isUpdating ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
