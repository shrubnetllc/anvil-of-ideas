import { useDocument } from "@/hooks/use-document";
import { useLeanCanvas } from "@/hooks/use-lean-canvas";
import { useSupabaseCanvas } from "@/hooks/use-supabase-data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface DocumentsOverviewTabProps {
    ideaId: number;
    setActiveTab: (tab: string) => void;
}

export function DocumentsOverviewTab({ ideaId, setActiveTab }: DocumentsOverviewTabProps) {
    // Fetch statuses for all documents
    // Note: This will pre-fetch the documents, which is good for UX (instant load when switching tabs)
    const { document: projectRequirements } = useDocument(ideaId, "ProjectRequirements");
    const { document: businessRequirements } = useDocument(ideaId, "BusinessRequirements");
    const { document: functionalRequirements } = useDocument(ideaId, "FunctionalRequirements");

    const { canvas } = useLeanCanvas(ideaId);
    const { data: supabaseData } = useSupabaseCanvas(ideaId);

    const isCanvasCompleted = (canvas && (canvas.problem || canvas.customerSegments || canvas.uniqueValueProposition)) ||
        (supabaseData && supabaseData.data && supabaseData.data.html);

    return (
        <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6">
            <h2 className="text-xl font-bold mb-4">Project Documents</h2>
            <p className="text-neutral-600 mb-6">
                Create and manage various documents for your business idea. Each document helps
                you develop different aspects of your project.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Lean Canvas Card */}
                <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold">Lean Canvas</h3>
                        {isCanvasCompleted ? (
                            <Badge
                                variant="default"
                                className="bg-green-100 text-green-800 hover:bg-green-100"
                            >
                                Completed
                            </Badge>
                        ) : (
                            <Badge variant="outline">Not Created</Badge>
                        )}
                    </div>
                    <p className="text-sm text-neutral-600 mb-3">
                        Business model overview using the Lean Canvas framework
                    </p>
                    <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => setActiveTab("canvas")}
                    >
                        {isCanvasCompleted ? "View Document" : "Create Document"}
                    </Button>
                </div>

                {/* Project Requirements Card */}
                <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold">Project Requirements</h3>
                        {projectRequirements ? (
                            <Badge
                                variant={projectRequirements.status === 'Completed' ? 'default' : 'outline'}
                                className={projectRequirements.status === 'Completed' ? 'bg-green-100 text-green-800 hover:bg-green-100' :
                                    projectRequirements.status === 'Generating' ? 'bg-amber-100 text-amber-800 hover:bg-amber-100' : ''}
                            >
                                {projectRequirements.status}
                            </Badge>
                        ) : (
                            <Badge variant="outline">Not Created</Badge>
                        )}
                    </div>
                    <p className="text-sm text-neutral-600 mb-3">
                        High-level project goals and requirements document
                    </p>
                    <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => setActiveTab("requirements")}
                    >
                        {projectRequirements ? 'View Document' : 'Create Document'}
                    </Button>
                </div>

                {/* Business Requirements Card */}
                <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold">Business Requirements</h3>
                        {businessRequirements ? (
                            <Badge
                                variant={businessRequirements.status === 'Completed' ? 'default' : 'outline'}
                                className={businessRequirements.status === 'Completed' ? 'bg-green-100 text-green-800 hover:bg-green-100' :
                                    businessRequirements.status === 'Generating' ? 'bg-amber-100 text-amber-800 hover:bg-amber-100' : ''}
                            >
                                {businessRequirements.status}
                            </Badge>
                        ) : (
                            <Badge variant="outline">Not Created</Badge>
                        )}
                    </div>
                    <p className="text-sm text-neutral-600 mb-3">
                        Detailed business goals, market analysis, and revenue models
                    </p>
                    <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => setActiveTab("business")}
                    >
                        {businessRequirements ? 'View Document' : 'Create Document'}
                    </Button>
                </div>

                {/* Functional Requirements Card */}
                <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold">Functional Requirements</h3>
                        {functionalRequirements ? (
                            <Badge
                                variant={functionalRequirements.status === 'Completed' ? 'default' : 'outline'}
                                className={functionalRequirements.status === 'Completed' ? 'bg-green-100 text-green-800 hover:bg-green-100' :
                                    functionalRequirements.status === 'Generating' ? 'bg-amber-100 text-amber-800 hover:bg-amber-100' : ''}
                            >
                                {functionalRequirements.status}
                            </Badge>
                        ) : (
                            <Badge variant="outline">Not Created</Badge>
                        )}
                    </div>
                    <p className="text-sm text-neutral-600 mb-3">
                        Technical specifications, features, and system behavior
                    </p>
                    <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => setActiveTab("functional")}
                    >
                        {functionalRequirements ? 'View Document' : 'Create Document'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
