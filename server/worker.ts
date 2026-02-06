import { consumeTasks } from "./rabbitmq";
import { storage } from "./storage";

export async function startWorker() {
    console.log("Starting RabbitMQ Worker...");

    await consumeTasks(async (msg) => {
        if (!msg) return;

        try {
            const content = JSON.parse(msg.content.toString());
            console.log(`[Worker] Received task type: ${content.type}`);

            if (content.type === "generate_document") {
                await handleGenerateDocument(content.payload);
            } else if (content.type === "workflow_generation") {
                await handleWorkflowGeneration(content.payload);
            }
        } catch (err) {
            console.error("[Worker] Error processing task:", err);
        }
    });
}

async function handleGenerateDocument(payload: any) {
    const { jobId, documentId, webhookUrl, auth, instructions, ideaId, project_id, leancanvas_id, prd_id, brd_id } = payload;

    console.log(`[Worker] Processing job ${jobId} for document ${documentId}`);

    // Update job status
    await storage.updateJob(jobId, { status: "processing", description: "Calling external generation service..." });

    try {
        // Prepare webhook body
        const webhookBody = {
            job_id: jobId, // Add snake_case alias for n8n compatibility
            ideaId,
            leancanvas_id,
            documentId,
            prd_id,
            project_id,
            brd_id,
            instructions
            // title, description if needed
        };

        const authHeader = `Basic ${Buffer.from(`${auth.username}:${auth.password}`).toString('base64')}`;

        console.log(`[Worker] Calling webhook: ${webhookUrl}`);
        console.log(`[Worker] Webhook Payload:`, JSON.stringify(webhookBody, null, 2));
        const response = await fetch(webhookUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": authHeader
            },
            body: JSON.stringify(webhookBody)
        });

        if (!response.ok) {
            throw new Error(`Webhook failed with status ${response.status}`);
        }

        const responseText = await response.text();
        console.log(`[Worker] Webhook response: ${responseText}`);

        // Parse ID logic (copied/adapted from routes.ts)
        let externalId = null;
        try {
            const json = JSON.parse(responseText);
            externalId = json.id || json.functional_id || json.functionalId || json.brd_id || json.functional_requirements_id;
            if (!externalId) {
                // Try looking for any field with 'id'
                const possibleIdFields = Object.keys(json).filter(key =>
                    key.toLowerCase().includes('id') && typeof json[key] === 'string'
                );
                if (possibleIdFields.length > 0) externalId = json[possibleIdFields[0]];
            }
        } catch (e) {
            // Text fallback
            if (responseText.trim().length < 100) externalId = responseText.trim();
        }

        if (externalId) {
            console.log(`[Worker] Found external ID: ${externalId}`);
            await storage.updateDocument(documentId, { externalId });
            await storage.updateJob(jobId, { status: "processing", description: "Generation request sent to AI agent..." });
        } else {
            console.warn(`[Worker] No external ID found in response.`);
            await storage.updateJob(jobId, { status: "completed", description: "Generation started, but no ID returned." });
        }

    } catch (error: any) {
        console.error(`[Worker] Job ${jobId} failed:`, error);
        await storage.updateJob(jobId, { status: "failed", description: `Error: ${error.message}` });
    }
}

async function handleWorkflowGeneration(payload: any) {

    const { jobId, projectId } = payload; // payload has ideaId, projectId, workflowType, title
    const webhookUrl = process.env.N8N_WF_VECTOR_WEBHOOK_URL;

    if (!webhookUrl) {
        console.error("[Worker] N8N_WF_VECTOR_WEBHOOK_URL not set");
        await storage.updateJob(jobId, { status: "failed", description: "Configuration error" });
        return;
    }

    const username = process.env.N8N_AUTH_USERNAME;
    const password = process.env.N8N_AUTH_PASSWORD;
    const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;

    try {
        await storage.updateJob(jobId, { status: "processing", description: "Initiating workflow generation..." });

        const response = await fetch(webhookUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": authHeader
            },
            body: JSON.stringify({
                "project_id": projectId,
                "job_id": jobId
            })
        });

        if (!response.ok) {
            throw new Error("Failed to call n8n workflow webhook");
        }

        await storage.updateJob(jobId, { status: "completed", description: "Workflow generation initiated." });

    } catch (error: any) {
        console.error(`[Worker] Workflow job ${jobId} failed:`, error);
        await storage.updateJob(jobId, { status: "failed", description: `Error: ${error.message}` });
    }
}
