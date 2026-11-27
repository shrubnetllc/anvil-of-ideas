# Anvil of Ideas

Founders use the dashboard to develop a business idea into a Lean Canvas, requirements documents, workflow specifications and estimates. They can edit documents, regenerate individual steps and follow job progress as the worker runs.

The React and TypeScript frontend uses Vite and Tailwind CSS. The Python backend exposes the dashboard API through FastAPI, stores application data in PostgreSQL and queues generation jobs in RabbitMQ. Hermes Agent handles model requests for the generation worker. [Architecture](01-architecture.md) · [Local development](../README.md#local-development)

The `n8n-workflows` documents describe the earlier implementation and its workflow designs.
