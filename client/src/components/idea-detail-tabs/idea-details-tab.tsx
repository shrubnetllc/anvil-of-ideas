import { useState, useEffect } from "react";
import { Idea } from "@shared/schema";
import { useIdeas } from "@/hooks/use-ideas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Pencil, Save, X, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface IdeaDetailsTabProps {
    idea: Idea;
}

export function IdeaDetailsTab({ idea }: IdeaDetailsTabProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<Partial<Idea>>({});
    const { updateIdea, isUpdating } = useIdeas();

    // Handle toggling edit mode and initializing form data
    const handleToggleEdit = () => {
        if (!isEditing && idea) {
            // Initialize form data with current idea values when entering edit mode
            setFormData({
                title: idea.title || '',
                idea: idea.idea,
                companyName: idea.companyName || '',
                companyStage: idea.companyStage || '',
                founderName: idea.founderName || '',
                founderEmail: idea.founderEmail || '',
                websiteUrl: idea.websiteUrl || ''
            });
        }
        setIsEditing(!isEditing);
    };

    // Handle form field changes
    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // Handle form submission
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (idea) {
            updateIdea({
                ideaId: idea.id,
                updates: formData
            });
            setIsEditing(false);
        }
    };

    return (
        <div className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-neutral-200 flex justify-between items-center">
                <h2 className="text-xl font-bold text-neutral-900">Idea Details</h2>
                <Button
                    variant={isEditing ? "ghost" : "outline"}
                    size="sm"
                    onClick={handleToggleEdit}
                >
                    {isEditing ? (
                        <>
                            <X className="mr-2 h-4 w-4" />
                            Cancel
                        </>
                    ) : (
                        <>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit Details
                        </>
                    )}
                </Button>
            </div>

            <div className="p-6">
                {isEditing ? (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="title">Project Title</Label>
                                <Input
                                    id="title"
                                    name="title"
                                    value={formData.title}
                                    onChange={handleFormChange}
                                    placeholder="e.g. EcoTrack"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="companyName">Company Name</Label>
                                <Input
                                    id="companyName"
                                    name="companyName"
                                    value={formData.companyName}
                                    onChange={handleFormChange}
                                    placeholder="e.g. EcoTrack Solutions Inc."
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="companyStage">Stage</Label>
                                <Input
                                    id="companyStage"
                                    name="companyStage"
                                    value={formData.companyStage}
                                    onChange={handleFormChange}
                                    placeholder="e.g. Idea, MVP, Seed, Series A"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="websiteUrl">Website URL</Label>
                                <Input
                                    id="websiteUrl"
                                    name="websiteUrl"
                                    value={formData.websiteUrl}
                                    onChange={handleFormChange}
                                    placeholder="https://example.com"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="founderName">Founder Name</Label>
                                <Input
                                    id="founderName"
                                    name="founderName"
                                    value={formData.founderName}
                                    onChange={handleFormChange}
                                    placeholder="Your Name"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="founderEmail">Founder Email</Label>
                                <Input
                                    id="founderEmail"
                                    name="founderEmail"
                                    value={formData.founderEmail}
                                    onChange={handleFormChange}
                                    placeholder="you@example.com"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="idea">Idea Description</Label>
                            <Textarea
                                id="idea"
                                name="idea"
                                value={formData.idea}
                                onChange={handleFormChange}
                                placeholder="Describe your idea in detail..."
                                className="min-h-[150px]"
                                required
                            />
                        </div>

                        <div className="flex justify-end">
                            <Button type="submit" disabled={isUpdating}>
                                {isUpdating ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        Save Changes
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                ) : (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h3 className="text-sm font-medium text-neutral-500 mb-1">Project Title</h3>
                                <p className="text-neutral-900 font-medium">{idea.title || "Untitled Project"}</p>
                            </div>

                            <div>
                                <h3 className="text-sm font-medium text-neutral-500 mb-1">Company Name</h3>
                                <p className="text-neutral-900">{idea.companyName || "-"}</p>
                            </div>

                            <div>
                                <h3 className="text-sm font-medium text-neutral-500 mb-1">Stage</h3>
                                <p className="text-neutral-900">{idea.companyStage || "-"}</p>
                            </div>

                            <div>
                                <h3 className="text-sm font-medium text-neutral-500 mb-1">Website</h3>
                                {idea.websiteUrl ? (
                                    <a
                                        href={idea.websiteUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary hover:underline"
                                    >
                                        {idea.websiteUrl}
                                    </a>
                                ) : (
                                    <p className="text-neutral-900">-</p>
                                )}
                            </div>

                            <div>
                                <h3 className="text-sm font-medium text-neutral-500 mb-1">Founder</h3>
                                <p className="text-neutral-900">
                                    {idea.founderName}
                                    {idea.founderEmail && <span className="text-neutral-500 ml-1">({idea.founderEmail})</span>}
                                </p>
                            </div>

                            <div>
                                <h3 className="text-sm font-medium text-neutral-500 mb-1">Created At</h3>
                                <p className="text-neutral-900">{formatDate(idea.createdAt)}</p>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-sm font-medium text-neutral-500 mb-2">Idea Description</h3>
                            <div className="bg-neutral-50 p-4 rounded-md border border-neutral-100">
                                <p className="text-neutral-700 whitespace-pre-wrap">{idea.idea}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
