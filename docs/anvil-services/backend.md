# Anvil of Ideas - Backend Documentation

This document provides a high-level overview of the backend architecture, core components, and API structure for the Anvil of Ideas platform.

## Architecture Overview

The backend is built using a modern, scalable stack designed for rapid development and secure data handling.

- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **ORM**: Drizzle ORM (Type-safe SQL)
- **Database**: PostgreSQL (hosted on Neon/Supabase)
- **Authentication**: Passport.js with Local Strategy and Express Sessions

The application follows a monolithic structure where the Express server handles API requests, authentication, and background tasks (like generation timeouts).

## Core Components

### 1. Storage Layer (`/server/storage.ts`)
The `IStorage` interface defines all data operations. Currently, `DatabaseStorage` is the primary implementation using Drizzle ORM.
- **RLS Integration**: Database operations use PostgreSQL Row Level Security (RLS) via the `withRLS` helper to ensure users only access their own data.
- **Session Management**: Sessions are stored in PostgreSQL using `connect-pg-simple`.

### 2. Authentication (`/server/auth.ts`)
- **Passport.js**: Manages user login, logout, and session persistence.
- **Hashing**: Passwords are hashed using `scrypt` with unique salts.
- **Email Verification**: Handles email verification tokens and link generation.

### 3. API Routes (`/server/routes.ts`)
The main entry point for API definition. It handles:
- Idea management (CRUD)
- Lean Canvas generation & updates
- Document management (BRD, FRD, Workflows)
- Webhook callbacks from external generation services (n8n/Supabase)

### 4. Database Security (`/server/db-security.ts`)
Contains the logic for applying RLS context to database transactions.
- `withRLS`: Sets the `role` and `request.jwt.claim.sub` in the Postgres session.
- `signSupabaseToken`: Generates JWTs for direct Supabase client interaction.

## API Endpoint Reference

### Authentication
- `POST /api/register`: Register a new user.
- `POST /api/login`: Authenticate and start a session.
- `POST /api/logout`: End the current session.
- `GET /api/user`: Get the currently authenticated user.

### Ideas
- `GET /api/ideas`: List all ideas for the current user.
- `POST /api/ideas`: Create a new idea.
- `GET /api/ideas/:id`: Get details for a specific idea.
- `PATCH /api/ideas/:id`: Update idea details.
- `DELETE /api/ideas/:id`: Delete an idea and its related data.

### Documents & Generation
- `POST /api/ideas/:id/generate`: Trigger Lean Canvas generation.
- `GET /api/ideas/:id/canvas`: Retrieve the Lean Canvas for an idea.
- `POST /api/ideas/:id/generate-business-requirements`: Trigger BRD generation.
- `POST /api/ideas/:id/generate-functional-requirements`: Trigger FRD generation.
- `GET /api/ideas/:id/documents`: List all documents related to an idea.

### External Integration (Webhooks)
- `POST /api/webhook/canvas`: Callback for Lean Canvas generation results.
- `POST /api/webhook/business-requirements-result`: Callback for BRD results.
- `POST /api/webhook/requirements-result`: Callback for FRD results.

## Data Model Overview

The schema is defined in `/shared/schema.ts` and includes:

- **Users**: User credentials and verification status.
- **Ideas**: Core project information and status.
- **Lean Canvas**: Structured data for the business model.
- **Project Documents**: Generic storage for BRD, FRD, Workflows, etc.
- **Jobs**: Tracking of background generation tasks.
- **App Settings**: Global configuration key-value pairs.

---
*For specific implementation details, refer to the source files in the `/server` directory.*
