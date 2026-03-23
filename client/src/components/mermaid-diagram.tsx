import React, { useEffect, useId, useState } from "react";
import mermaid from "mermaid";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

type Props = {
    code: string;              // the mermaid definition text
    open: boolean;             // whether the modal is open
    onOpenChange: (open: boolean) => void;
    title?: string;            // optional title for the modal
};

interface ParsedDiagram {
    label: string;
    code: string;
}

let mermaidInitialized = false;

function cleanupMermaidElements(idPrefix: string) {
    // Remove the rendered SVG element mermaid leaves in the body
    const orphan = document.getElementById(idPrefix);
    if (orphan) orphan.remove();
    // Remove the wrapper div (d + id) mermaid creates
    const wrapper = document.getElementById('d' + idPrefix);
    if (wrapper) wrapper.remove();
    // Remove any stray mermaid error elements appended to body
    document.querySelectorAll('.mermaid-error, [id^="' + idPrefix + '"]').forEach(el => {
        if (el.parentElement === document.body) el.remove();
    });
}

/**
 * Split mermaid code that contains multiple diagrams delimited by
 * %%Step N: <label> comments into individual diagrams.
 * If no delimiters are found, returns the entire code as a single diagram.
 */
export function parseDiagrams(code: string): ParsedDiagram[] {
    const stepRegex = /^%%\s*Step\s+\d+:\s*(.+)$/gm;
    const matches = [...code.matchAll(stepRegex)];

    if (matches.length === 0) {
        return [{ label: "", code: code.trim() }];
    }

    const diagrams: ParsedDiagram[] = [];
    for (let i = 0; i < matches.length; i++) {
        const label = matches[i][1].trim();
        const start = matches[i].index! + matches[i][0].length;
        const end = i + 1 < matches.length ? matches[i + 1].index! : code.length;
        const diagramCode = code.slice(start, end).trim();
        if (diagramCode) {
            diagrams.push({ label, code: diagramCode });
        }
    }

    return diagrams;
}

export function MermaidDiagram({ code, open, onOpenChange, title = "Workflow Diagram" }: Props) {
    const id = useId(); // unique per component instance
    const [svgs, setSvgs] = useState<{ label: string; svg: string }[]>([]);

    useEffect(() => {
        if (!mermaidInitialized) {
            mermaid.initialize({
                startOnLoad: false,
                theme: 'default',
                securityLevel: 'loose',
            });
            mermaidInitialized = true;
        }
    }, []);

    useEffect(() => {
        if (!open || !code) return;

        let cancelled = false;
        const cleanId = `mermaid-${id.replace(/:/g, "-")}`;

        async function render() {
            const diagrams = parseDiagrams(code);
            const results: { label: string; svg: string }[] = [];

            for (let i = 0; i < diagrams.length; i++) {
                const diagramId = `${cleanId}-${i}`;
                try {
                    const { svg } = await mermaid.render(diagramId, diagrams[i].code);
                    results.push({ label: diagrams[i].label, svg });
                } catch (e: any) {
                    console.error(`Mermaid render error (${diagrams[i].label}):`, e);
                    results.push({
                        label: diagrams[i].label,
                        svg: `<pre style="color:red; white-space: pre-wrap;">Mermaid error: ${String(e?.message ?? e)}</pre>`,
                    });
                } finally {
                    cleanupMermaidElements(diagramId);
                }
            }

            if (!cancelled) setSvgs(results);
        }

        render();
        return () => {
            cancelled = true;
            // Clean up all possible sub-diagram elements
            const diagrams = parseDiagrams(code);
            for (let i = 0; i < diagrams.length; i++) {
                cleanupMermaidElements(`${cleanId}-${i}`);
            }
        };
    }, [code, id, open]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl w-[90vw] max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <ScrollArea className="flex-1 overflow-auto p-4 bg-white rounded border">
                    <div className="space-y-6">
                        {svgs.map((entry, i) => (
                            <div key={i}>
                                {entry.label && (
                                    <h4 className="text-sm font-semibold text-neutral-700 mb-2">
                                        Step {i + 1}: {entry.label}
                                    </h4>
                                )}
                                <div
                                    className="flex justify-center"
                                    dangerouslySetInnerHTML={{ __html: entry.svg }}
                                />
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
