# System Architecture

# High Level Architecture

flowchart LR
    UI[Anvil App Frontend]
    API[Anvil App API]
    DB[(Supabase)]
    N8N[n8n]
    LLM[LLM Providers]
    UW[Ultimate Website]
    PD[Ultimate Pitch Deck]
    CF[ComfyUI Image Generator]

    UI --> API
    API --> DB
    API --> N8N
    N8N --> LLM
    LLM --> N8N
    N8N --> DB
    N8N --> UW
    N8N --> PD
    UW --> CF
    DB --> API
    