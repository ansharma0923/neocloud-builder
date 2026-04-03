# Contributing to NeoCloud Builder

## Prerequisites

- Node.js 20+
- pnpm (`npm install -g pnpm`)
- PostgreSQL 15+

## Local Setup

```bash
# 1. Clone the repo
git clone https://github.com/ansharma0923/neocloud-builder.git
cd neocloud-builder

# 2. Install dependencies
pnpm install

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your values

# 4. Set up the database
pnpm db:migrate

# 5. Start the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

See `.env.example` for all required variables. At minimum you need:
- `DATABASE_URL` — PostgreSQL connection string
- `NEXTAUTH_SECRET` — random secret (`openssl rand -base64 32`)
- `OPENAI_API_KEY` — OpenAI API key
- All `OPENAI_MODEL_*` variables

## Running Tests

```bash
pnpm test              # all tests
pnpm test:unit         # unit tests only
pnpm test:integration  # integration tests only
```

## Contribution Flow

1. Fork and create a feature branch: `git checkout -b feat/your-feature`
2. Make changes and write/update tests
3. Run `pnpm lint` and `pnpm test`
4. Open a PR against `main` with a clear description

## PR Format

- Title: `feat:`, `fix:`, `chore:`, `docs:`, or `refactor:` prefix
- Description: what changed and why
- Reference any related issues

## Commit Conventions

Follow [Conventional Commits](https://www.conventionalcommits.org/):
- `feat: add artifact export`
- `fix: correct BOM total calculation`
- `docs: update setup instructions`
