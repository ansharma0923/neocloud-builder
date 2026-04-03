# NeoCloud Builder

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Repo](https://img.shields.io/badge/repo-public-green.svg)](https://github.com/ansharma0923/neocloud-builder)

An AI-native planning workspace for AI data centers and neoclouds. Design rack topologies, GPU/TPU clusters, leaf-spine networks, storage, power/cooling, site layouts, BOMs, and cost estimates — entirely through natural language and file uploads.

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│  Next.js 14 App Router (TypeScript + Tailwind + shadcn)  │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │  Left Panel │  │  Chat Thread │  │   Right Panel   │ │
│  │  (Sidebar)  │  │  + Input     │  │ Plan/Artifacts  │ │
│  └─────────────┘  └──────────────┘  └─────────────────┘ │
└──────────────────────┬───────────────────────────────────┘
                       │ API Routes
┌──────────────────────▼───────────────────────────────────┐
│  Planning Pipeline   │  File Ingestion  │  Artifact Gen  │
│  intent-parser       │  extract+chunk   │  BOM/Summary   │
│  assumption-resolver │  embed+retrieve  │  Diagram Spec  │
│  plan-builder        │                  │  Image Gen     │
│  plan-mutator        │  Model Router    │                │
│  plan-validator      │  (env-based)     │                │
└──────────────────────┬───────────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────────┐
│  PostgreSQL + Prisma ORM  │  Local/S3 Storage Adapter    │
└──────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Auth | NextAuth.js v5 |
| Database | PostgreSQL + Prisma ORM |
| AI | OpenAI API (task-routed) |
| State | Zustand + SWR |
| Validation | Zod |
| Logging | Winston |
| Testing | Vitest |

## Quickstart

```bash
git clone https://github.com/ansharma0923/neocloud-builder.git
cd neocloud-builder
pnpm install
cp .env.example .env.local   # fill in your values
pnpm db:migrate
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Setup

See `.env.example` for all variables. Required:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Auth secret (`openssl rand -base64 32`) |
| `OPENAI_API_KEY` | OpenAI API key |
| `OPENAI_MODEL_FAST` | Model for fast chat (e.g. `gpt-4o-mini`) |
| `OPENAI_MODEL_REASONING` | Model for deep reasoning |
| `OPENAI_MODEL_STRUCTURED` | Model for structured extraction |
| `OPENAI_MODEL_IMAGE` | Model for image generation |

## Provenance Model

Every planning field carries provenance metadata:

| Source Type | Meaning |
|-------------|---------|
| `user_input` | User explicitly stated this value |
| `uploaded_file` | Derived from an uploaded document |
| `llm_inference` | Logically inferred by the model |
| `llm_estimate` | Estimated by the model (not confirmed) |
| `workspace_confirmed` | Previously confirmed by user |
| `system_default` | System-supplied default |

LLM estimates are **never** promoted to confirmed without user action.

## Model Routing

All AI calls go through `getModelForTask(task)` which reads model names from environment variables. No model names are hardcoded. Throws if a required env var is missing.

## Security

Never commit secrets. See [SECURITY.md](SECURITY.md) for vulnerability reporting.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Apache 2.0 — see [LICENSE](LICENSE).
