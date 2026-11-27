# System architecture

```mermaid
flowchart LR
    UI[React dashboard] --> Proxy[Vite or Caddy]
    Proxy --> API[FastAPI dashboard API]
    API --> DB[(PostgreSQL)]
    API --> Q[RabbitMQ]
    Q --> Worker[Generation worker]
    Worker --> Hermes[Hermes Agent]
    Hermes --> LLM[Model provider]
    Worker --> DB
    API -->|Job events| Proxy
    API --> Website[Ultimate Website service]
```

The browser sends authenticated requests to its own origin. FastAPI checks the user's session, submits generation jobs and streams job status updates. The worker applies the project’s generation steps and saves their outputs in PostgreSQL. [Deployment and configuration](https://github.com/shrubnetllc/anvil-api/blob/main/dashboard.md)
