# Internal Business Tools Template

A Next.js template for building internal business tools with authentication, role-based access control, task management, and integrations.

## Features

- **Authentication** - Email/password auth with NextAuth.js, admin impersonation
- **Role-based Access** - ADMIN, MEMBER, VIEWER roles with page-level access control
- **Project Management** - Organize work by projects with team member assignments
- **Task Management** - Tasks with priorities, statuses, due dates, assignees, attachments, blocking relationships, saved views (table/kanban)
- **Action Items** - Lightweight action items per project with status tracking
- **Recurring Tasks** - Daily/weekly/monthly recurring task automation
- **Calculations** - Flow-based calculation builder
- **AI Chat** - Built-in AI assistant (OpenAI/Anthropic)
- **Notifications** - Slack notifications per project per event type
- **Integrations** - Slack, Linear, GitHub, Gmail
- **Command Palette** - Quick search across all entities
- **Embeddable Form** - Generic form for lead capture or data collection

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Auth**: NextAuth.js (Credentials provider)
- **UI**: Tailwind CSS, Radix UI, shadcn/ui components
- **Charts**: ECharts
- **Animations**: Framer Motion

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- Docker (for local PostgreSQL)

### Setup

1. Clone the repository

2. Install dependencies:
```bash
pnpm install
```

3. Start the local PostgreSQL database:
```bash
docker compose up -d
```

4. Copy the environment file and configure:
```bash
cp .env.example .env
```

5. Push the database schema:
```bash
npx prisma db push
```

6. Create your first admin user (via Prisma Studio or a seed script):
```bash
npx prisma studio
```

7. Start the dev server:
```bash
pnpm dev
```

### Environment Variables

See `.env.example` for all available configuration options. Required:

- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - Secret for JWT signing
- `NEXTAUTH_URL` - Your app URL

Optional integrations:
- `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` - AI Chat
- `SLACK_BOT_TOKEN` - Slack notifications
- `LINEAR_API_KEY` - Linear integration
- `GITHUB_TOKEN` - GitHub integration

## Project Structure

```
app/
  dashboard/           # Authenticated dashboard pages
    tasks/             # Task management
    action-items/      # Action items
    recurring-tasks/   # Recurring task automation
    calculation/       # Calculation builder
    users/             # User management (admin)
    notifications/     # Notification settings (admin)
    integrations/      # Third-party integrations (admin)
    profile/           # User profile settings
  api/                 # API routes
    ai-chat/           # AI chat endpoints
    cron/              # Cron job endpoints
    upload/            # File upload
  embed/               # Embeddable form
components/            # Shared UI components
lib/
  actions.ts           # Server actions
  fetchers.ts          # Data fetching functions
  prisma.ts            # Prisma client
prisma/
  schema.prisma        # Database schema
```

## Roles

| Role | Access |
|------|--------|
| ADMIN | Full access to all pages and settings |
| MEMBER | Tasks, action items, recurring tasks, profile |
| VIEWER | Tasks (read), action items (read), profile |
