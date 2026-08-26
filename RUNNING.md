# Running locally (Phase 3B)

## First-time setup

```
npm install
cp .env.example .env      # adjust ADMIN_USERNAME/ADMIN_PASSWORD if you like
npm run server:migrate    # creates server/prisma/dev.db and applies migrations
npm run server:seed       # seeds ingredients/menus/orders + the admin user
```

## Day to day

Two processes, in separate terminals:

```
npm run server   # backend API on http://localhost:3001
npm run dev      # frontend on http://localhost:5173 (proxies /api to the backend)
```

Log in at `http://localhost:5173` with the `ADMIN_USERNAME`/`ADMIN_PASSWORD` from `.env`
(defaults: `admin` / `changeme123`).

## Environment variables (`.env`, see `.env.example`)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | SQLite file path for Prisma, e.g. `file:./server/prisma/dev.db` |
| `PORT` | Backend port (default 3001) |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Used only by `server/prisma/seed.ts` to create the one V1 admin user |

## Mock vs real backend

`src/repository/index.ts` is the single switch point. By default the frontend uses the real API
repository. Set `VITE_REPOSITORY=mock` (e.g. in a `.env.local` read by Vite, or inline:
`VITE_REPOSITORY=mock npm run dev`) to run entirely against the in-memory mock instead — no
backend process needed, no login/setup wizard (the mock has no auth concept and its seed store
is already marked set-up). This is what `npm test` (the frontend vitest suite) exercises.

## Tests

```
npm run typecheck && npm run typecheck:server   # tsc --noEmit, both projects
npm run build                                    # vite build
npm test                                         # frontend: domain + mock-repository tests
npm run test:server                              # backend: real Prisma-backed repository + auth tests
```

`test:server` spins up its own throwaway SQLite file (`server/prisma/test.db`, gitignored),
pushes the schema, and reseeds it fresh on every run — it never touches `dev.db`.

## Resetting the dev database

```
npx prisma migrate reset --force   # drops + recreates dev.db, reapplies migrations
npm run server:seed                # re-seed
```

Prisma's CLI will refuse this for an AI agent without your explicit consent — run it yourself,
or say so explicitly if asking an agent to run it.
