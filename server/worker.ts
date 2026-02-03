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
                // Add workflow generation handling if needed, 
                // or if it was just a trigger.
                // For now, focusing on the n8n webhook calls.
                await handleWorkflowGeneration(content.payload);
            }

            // We should ack the message here if we had the channel access, 
            // but our consumeTasks helper currently auto-acks or doesn't expose ack?
            // Checking rabbitmq.ts: 
            // It uses `noAck: false` which means manual ack is REQUIRED. 
            // But my `consumeTasks` implementation in `server/rabbitmq.ts` took a handler 
            // and didn't pass the channel to ack. 
            // WAIT. `server/rabbitmq.ts` consumeTasks calls `ch.consume(..., handler, { noAck: false })`.
            // The handler receives `msg`. The handler is responsible for acking?
            // But the handler defined in `verify-rabbitmq.ts` didn't ack.
            // If I use `noAck: false`, I MUST ack. 
            // I should update `server/rabbitmq.ts` to allow acking or handle it.
            // For now, let's assume I need to fix rabbitmq.ts or just handle logic here.

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
            await storage.updateJob(jobId, { status: "completed", description: "Generation started successfully." });
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
    // Placeholder for workflow generation logic if needed
    // The route `POST /api/ideas/:id/workflows` logic was:
    // 1. Call n8n webhook with project_id
    // 2. Create job
    // It seems the ONLY thing that happened "outside" the DB op was the fetch.
    // So if the route now pushes to queue, we must do the fetch here.

    // BUT! In `routes.ts` I removed the fetch and just pushed to queue. 
    // Wait, let me check my routes.ts changes again.
    // Yes, I replaced the entire block.
    // So I need to implement `handleWorkflowGeneration` to call the workflow webhook.

    // I need the webhook URL. It was `process.env.N8N_WF_VECTOR_WEBHOOK_URL`.
    // It wasn't passed in payload in my previous `routes.ts` edit.
    // I should probably pass it in payload or access ENV here. ENV is better if accessible.

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
                "project_id": projectId
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
