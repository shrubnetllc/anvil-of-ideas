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

let mermaidInitialized = false;

export function MermaidDiagram({ code, open, onOpenChange, title = "Workflow Diagram" }: Props) {
    const id = useId(); // unique per component instance
    const [svg, setSvg] = useState<string>("");

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

        async function render() {
            try {
                // Ensure we have a clean ID for mermaid
                const cleanId = `mermaid-${id.replace(/:/g, "-")}`;
                const { svg } = await mermaid.render(cleanId, code);
                if (!cancelled) setSvg(svg);
            } catch (e: any) {
                console.error("Mermaid render error:", e);
                if (!cancelled) setSvg(`<pre style="color:red; white-space: pre-wrap;">Mermaid error: ${String(e?.message ?? e)}</pre>`);
            }
        }

        render();
        return () => {
            cancelled = true;
        };
    }, [code, id, open]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl w-[90vw] max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <ScrollArea className="flex-1 overflow-auto p-4 bg-white rounded border">
                    <div
                        className="flex justify-center"
                        dangerouslySetInnerHTML={{ __html: svg }}
                    />
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
