# Dashboard backend

The ASGI entry point for the dashboard is `app.dashboard.main:app` in `shrubnetllc/anvil-api`. The frontend sends same-origin requests to these FastAPI routes through Vite during development and Caddy in production.

- Account routes handle login, logout and email verification. Sessions are stored in PostgreSQL.
- Idea routes manage project details, generated documents, the editable Lean Canvas and workflow results.
- Job routes accept full generation and step regeneration requests and stream status changes to the dashboard over server-sent events.
- Administration routes provision accounts and manage settings.

The generation worker consumes RabbitMQ jobs, calls Hermes Agent and persists outputs in PostgreSQL. [Backend setup](https://github.com/shrubnetllc/anvil-api/blob/main/dashboard.md)
