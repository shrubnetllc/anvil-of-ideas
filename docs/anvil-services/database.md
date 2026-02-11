# Anvil of Ideas - Database Schema Documentation

This document describes the database schema for the Anvil of Ideas platform. The database is powered by PostgreSQL and managed using Drizzle ORM.

## Entity Relations


erDiagram
    USERS ||--o{ IDEAS : owns
    USERS ||--o{ JOBS : executes
    IDEAS ||--o{ JOBS : has
    IDEAS ||--o{ LEAN_CANVAS : has
    IDEAS ||--o{ PROJECT_DOCUMENTS : contains

    USERS {
        serial id PK
        text username
        text password
        text email
        text email_verified
        text verification_token
        timestamp verification_token_expiry
    }

    IDEAS {
        serial id PK
        integer user_id FK
        text title
        text idea
        text founder_name
        text founder_email
        text company_stage
        text website_url
        text company_name
        text status
        timestamp generation_started_at
        timestamp created_at
        timestamp updated_at
    }

    JOBS {
        uuid id PK
        integer idea_id FK
        integer user_id FK
        uuid project_id
        text status
        timestamp created_at
        timestamp updated_at
    }

    LEAN_CANVAS {
        uuid id PK
        integer idea_id FK
        uuid project_id
        text problem
        text customer_segments
        text unique_value_proposition
        text solution
        text channels
        text revenue_streams
        text cost_structure
        text key_metrics
        text unfair_advantage
        text html
        timestamp created_at
        timestamp updated_at
    }

    PROJECT_DOCUMENTS {
        serial id PK
        integer idea_id FK
        text document_type
        text title
        text content
        text html
        text status
        timestamp generation_started_at
        text external_id
        integer version
        timestamp created_at
        timestamp updated_at
    }

    APP_SETTINGS {
        serial id PK
        varchar key
        text value
        timestamp created_at
        timestamp updated_at
    }


## Table Definitions

### 1. `users`
Stores user account information and authentication state.
- **id**: Primary Key.
- **username**: Unique username for login.
- **password**: Hashed password.
- **email**: User's email address.
- **email_verified**: Status of email verification ("true"/"false").
- **verification_token**: Token for email verification links.
- **verification_token_expiry**: Expiration date for the verification token.

### 2. `ideas`
Core entity representing a business idea forged in the anvil.
- **userId**: Foreign Key to `users.id`.
- **status**: Current state of the idea (`Draft`, `Generating`, `Completed`).
- **idea**: The main description of the business concept.
- **company_name / founder_name**: Optional metadata for branding.

### 3. `jobs`
Tracks background processing tasks, primarily for external workflow integrations.
- **projectId**: UUID returned from external services (e.g., n8n).
- **status**: Status of the background job.

### 4. `lean_canvas`
Stores the structured business model components generated for an idea.
- **ideaId**: Foreign Key to `ideas.id`.
- **problem / solution / revenue_streams / etc**: Individual components of the Lean Canvas.
- **html**: Pre-rendered HTML version of the canvas.

### 5. `project_documents`
A versatile storage table for all types of generated documents.
- **document_type**: Discriminator for document content (e.g., `BRD`, `FRD`, `Workflows`).
- **content**: Markdown or JSON structured data.
- **external_id**: Reference to the document in external systems (e.g., Supabase).

### 6. `app_settings`
Key-value storage for global application configuration.
- **key**: Unique identifier for the setting.
- **value**: Configurable value.

---
*The schema is defined in `/shared/schema.ts`.*
