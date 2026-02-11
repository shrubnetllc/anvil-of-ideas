# Anvil of Ideas - Frontend Documentation

This document provides a high-level overview of the frontend architecture, core layout, and key pages for the Anvil of Ideas platform.

## Technology Stack

The frontend is built as a modern, responsive Single Page Application (SPA).

- **Framework**: [React](https://reactjs.org/) (with TypeScript)
- **Routing**: [Wouter](https://github.com/molecula/wouter) (Minimalist routing)
- **Data Fetching**: [TanStack Query](https://tanstack.com/query/latest) (Caching and state synchronization)
- **UI Components**: [Radix UI](https://www.radix-ui.com/) (Headless primitive components)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) (Utility-first CSS)
- **Icons**: [Lucide React](https://lucide.dev/)

## Core Layout

The application uses a consistent layout shell defined in `App.tsx` and shared components.

- **Sidebar** (`/client/src/components/sidebar.tsx`): Main navigation menu for desktop and mobile (via Sheet).
- **Header** (`/client/src/components/header.tsx`): Displays user profile, theme toggle, and page context.
- **Main Area**: Responsive container that shifts according to the sidebar state.

## Page Overview

### 1. Dashboard (`/client/src/pages/dashboard.tsx`)
The primary entry point for authenticated users.
- **Idea Listing**: Displays a grid of `IdeaCard` components.
- **Management**: Search input, status filtering (Draft, Generating, Completed), and sorting.
- **Action**: The "Forge New Idea" button triggers the creation modal.

### 2. Idea Creation (`/client/src/components/new-idea-modal.tsx`)
A guided multi-step form for creating new ideas.
- **Information Capture**: Collects idea description, target audience, and founder details.
- **Hand-off**: Once submitted, it initiates the backend generation process and navigates the user to the dashboard or detail view.

### 3. Idea Details (`/client/src/pages/idea-detail.tsx`)
A comprehensive view of a specific project, organized by tabs.
- **Documents Tab**: An overview of all generated artifacts.
- **Specialized Tabs**: Dedicated views for Lean Canvas, Project Requirements, Business Requirements (BRD), Functional Requirements (FRD), and Workflows.
- **Advanced Features**: Includes tabs for "Front End Spec", "Back End Spec", and "Ultimate Website" previews.
- **Polling**: Implements automatic status checking when an idea is in the "Generating" state.

## State Management

- **Authentication** (`/client/src/hooks/use-auth.tsx`): Manages user session state and provides login/logout functionality.
- **Data Hooks** (`/client/src/hooks/use-ideas.tsx`): Custom hooks for fetching and mutating idea and canvas data, wrapping TanStack Query for consistent behavior and error handling.
- **Query Client**: Centralized in `/client/src/lib/queryClient.ts` for managing API interactions and cache invalidation.

---
*For specific component implementation details, refer to the source files in the `/client/src` directory.*
