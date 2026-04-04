# Contributing to NeoCloud Builder

## Prerequisites

- Node.js 20+

## Local Setup

### One-time database setup

Create a `.env` file in the project root with:
```
DATABASE_URL="file:./dev.db"
```

Also create `.env.local` with all variables from `.env.example`.

Then run:
```
npx prisma migrate dev --name init
npx prisma generate
```

This creates a local SQLite database file at `prisma/dev.db`. No PostgreSQL or Docker required.

### Full setup

```bash
# 1. Clone the repo
git clone https://github.com/ansharma0923/neocloud-builder.git
cd neocloud-builder

# 2. Install dependencies
npm install

# 3. Set up environment variables (see Database setup above)
cp .env.example .env.local
# Edit .env.local — fill in OPENAI_API_KEY and NEXTAUTH_SECRET

# 4. Run migrations and generate Prisma client
npm run db:migrate
npm run db:generate

# 5. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

See `.env.example` for all required variables. At minimum you need:
- `DATABASE_URL` — SQLite path for local dev (`file:./dev.db`); PostgreSQL connection string for production
- `NEXTAUTH_SECRET` — random secret (`openssl rand -base64 32`)
- `OPENAI_API_KEY` — OpenAI API key
- All `OPENAI_MODEL_*` variables

## Running Tests

```bash
npm test              # all tests
npm run test:unit     # unit tests only
npm run test:integration  # integration tests only
```

## Contribution Flow

1. Fork and create a feature branch: `git checkout -b feat/your-feature`
2. Make changes and write/update tests
3. Run `npm run lint` and `npm test`
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
